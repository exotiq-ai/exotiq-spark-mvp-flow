// HMRC-compliant VAT invoice generator.
//
// Allocates a sequential invoice number via the next_invoice_number RPC,
// snapshots supplier + customer + line items into tenant_invoices, renders
// a PDF with pdf-lib, and returns it as base64 plus the invoice metadata.
//
// Auth: user must be a member of the booking's team (RLS on bookings enforces
// this when we read with the user's JWT). Service role is used afterwards
// for the atomic invoice-number allocation and immutable snapshot write.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function money(n: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale || "en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} ${currency}`;
  }
}

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
}

function addrLines(name: string | undefined, a: Address | null | undefined): string[] {
  const out: string[] = [];
  if (name) out.push(name);
  if (a?.line1) out.push(a.line1);
  if (a?.line2) out.push(a.line2);
  const cityRegion = [a?.city, a?.region].filter(Boolean).join(", ");
  if (cityRegion) out.push(cityRegion);
  if (a?.postal_code) out.push(a.postal_code);
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User-scoped client to enforce RLS on the read.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking_id } = await req.json().catch(() => ({}));
    if (!booking_id || typeof booking_id !== "string") {
      return new Response(
        JSON.stringify({ error: "booking_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load booking via RLS — caller must belong to the team.
    const { data: booking, error: bErr } = await userClient
      .from("bookings")
      .select(
        "id, team_id, booking_ref, customer_id, customer_name, customer_email, " +
        "vehicle_name, start_date, end_date, daily_rate, subtotal, tax_amount, " +
        "tax_rate_percent, tax_inclusive, currency, total_value, " +
        "invoice_number, invoice_issued_at",
      )
      .eq("id", booking_id)
      .maybeSingle();

    if (bErr || !booking || !booking.team_id) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for atomic write paths.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: team } = await admin
      .from("teams")
      .select("name, country_code, currency, locale, tax_label, tax_rate_percent, tax_inclusive, vat_number, business_address")
      .eq("id", booking.team_id)
      .maybeSingle();

    const customerSnap: Record<string, unknown> = {
      name: booking.customer_name,
      email: booking.customer_email,
    };
    if (booking.customer_id) {
      const { data: cust } = await admin
        .from("customers")
        .select("name, email, address_line1, address_line2, city, state, postal_code, country")
        .eq("id", booking.customer_id)
        .maybeSingle();
      if (cust) Object.assign(customerSnap, cust);
    }

    const currency = booking.currency || team?.currency || "USD";
    const locale = team?.locale || "en-US";
    const taxRate = Number(booking.tax_rate_percent ?? team?.tax_rate_percent ?? 0);
    const taxInclusive = booking.tax_inclusive ?? team?.tax_inclusive ?? false;
    const total = Number(booking.total_value || 0);
    const subtotal = Number(booking.subtotal ?? total);
    const taxAmount = Number(booking.tax_amount ?? 0);
    const taxLabel = team?.tax_label || "VAT";

    // Allocate (or reuse) the invoice number.
    let invoiceNumber = booking.invoice_number;
    let issuedAt = booking.invoice_issued_at;

    if (!invoiceNumber) {
      const { data: nextNum, error: numErr } = await admin.rpc(
        "next_invoice_number",
        { p_team_id: booking.team_id },
      );
      if (numErr || !nextNum) {
        return new Response(
          JSON.stringify({ error: "Could not allocate invoice number", details: numErr?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      invoiceNumber = nextNum as string;
      issuedAt = new Date().toISOString();

      await admin
        .from("bookings")
        .update({ invoice_number: invoiceNumber, invoice_issued_at: issuedAt })
        .eq("id", booking_id);

      const lineItems = [{
        description: `Vehicle rental — ${booking.vehicle_name ?? ""}`.trim(),
        period_start: booking.start_date,
        period_end: booking.end_date,
        unit_price: Number(booking.daily_rate || 0),
        amount_excl_tax: subtotal,
        tax_rate_percent: taxRate,
        tax_amount: taxAmount,
        amount_incl_tax: total,
      }];

      await admin.from("tenant_invoices").upsert({
        team_id: booking.team_id,
        booking_id,
        invoice_number: invoiceNumber,
        issued_at: issuedAt,
        tax_point_date: booking.start_date,
        currency,
        subtotal,
        tax_amount: taxAmount,
        tax_rate_percent: taxRate,
        tax_inclusive: taxInclusive,
        total,
        supplier_snapshot: {
          name: team?.name,
          country_code: team?.country_code,
          vat_number: team?.vat_number,
          address: team?.business_address,
        },
        customer_snapshot: customerSnap,
        line_items: lineItems,
      }, { onConflict: "booking_id" });
    }

    // ---- Render PDF ----
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.1, 0.12, 0.16);
    const sub = rgb(0.42, 0.45, 0.5);

    let y = 800;
    const left = 40;
    const right = 555;
    const draw = (
      text: string,
      x: number,
      yy: number,
      opts: { size?: number; font?: typeof font; color?: typeof ink; align?: "left" | "right" } = {},
    ) => {
      const size = opts.size ?? 10;
      const f = opts.font ?? font;
      const c = opts.color ?? ink;
      let drawX = x;
      if (opts.align === "right") {
        const w = f.widthOfTextAtSize(text, size);
        drawX = x - w;
      }
      page.drawText(text, { x: drawX, y: yy, size, font: f, color: c });
    };

    // Header
    draw("VAT INVOICE", left, y, { size: 22, font: bold });
    draw(`Invoice ${invoiceNumber}`, right, y, { size: 12, font: bold, align: "right" });
    y -= 18;
    draw(`Issued ${new Date(issuedAt!).toLocaleDateString(locale)}`, right, y, { size: 10, color: sub, align: "right" });
    y -= 26;

    // Supplier / customer columns
    const colTop = y;
    draw("From", left, y, { size: 9, color: sub });
    y -= 14;
    for (const line of addrLines(team?.name, team?.business_address as Address)) {
      draw(line, left, y); y -= 12;
    }
    if (team?.vat_number) {
      y -= 4;
      draw(`${taxLabel} no. ${team.vat_number}`, left, y, { size: 9, color: sub }); y -= 12;
    }

    let cy = colTop;
    const cLeft = 320;
    draw("Bill to", cLeft, cy, { size: 9, color: sub });
    cy -= 14;
    const custAddr: Address = {
      line1: (customerSnap.address_line1 as string) || undefined,
      line2: (customerSnap.address_line2 as string) || undefined,
      city: (customerSnap.city as string) || undefined,
      region: (customerSnap.state as string) || undefined,
      postal_code: (customerSnap.postal_code as string) || undefined,
    };
    for (const line of addrLines(customerSnap.name as string, custAddr)) {
      draw(line, cLeft, cy); cy -= 12;
    }
    if (customerSnap.email) {
      draw(String(customerSnap.email), cLeft, cy, { size: 9, color: sub }); cy -= 12;
    }

    y = Math.min(y, cy) - 22;

    // Meta strip
    draw(`Booking ${booking.booking_ref ?? booking.id.slice(0, 8)}`, left, y, { size: 9, color: sub });
    draw(
      `Tax point: ${new Date(booking.start_date).toLocaleDateString(locale)}`,
      right,
      y,
      { size: 9, color: sub, align: "right" },
    );
    y -= 18;

    // Line items table
    page.drawRectangle({ x: left, y: y - 4, width: right - left, height: 22, color: rgb(0.96, 0.97, 0.98) });
    draw("Description", left + 8, y + 4, { size: 9, font: bold });
    draw("Net", left + 320, y + 4, { size: 9, font: bold, align: "right" });
    draw(`${taxLabel} ${taxRate}%`, left + 410, y + 4, { size: 9, font: bold, align: "right" });
    draw("Gross", right - 8, y + 4, { size: 9, font: bold, align: "right" });
    y -= 22;

    const desc = `Vehicle rental — ${booking.vehicle_name ?? ""}`.trim();
    const period = `${new Date(booking.start_date).toLocaleDateString(locale)} → ${new Date(booking.end_date).toLocaleDateString(locale)}`;
    draw(desc, left + 8, y);
    draw(money(subtotal, currency, locale), left + 320, y, { align: "right" });
    draw(money(taxAmount, currency, locale), left + 410, y, { align: "right" });
    draw(money(total, currency, locale), right - 8, y, { align: "right" });
    y -= 12;
    draw(period, left + 8, y, { size: 9, color: sub });
    y -= 24;

    // Totals
    const totalsX = right - 8;
    const labelX = right - 180;
    draw("Subtotal (excl. tax)", labelX, y, { size: 10, color: sub });
    draw(money(subtotal, currency, locale), totalsX, y, { size: 10, align: "right" });
    y -= 14;
    draw(`${taxLabel} (${taxRate}%${taxInclusive ? ", included" : ""})`, labelX, y, { size: 10, color: sub });
    draw(money(taxAmount, currency, locale), totalsX, y, { size: 10, align: "right" });
    y -= 18;
    page.drawLine({
      start: { x: labelX, y: y + 8 },
      end: { x: right, y: y + 8 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
    draw("Total", labelX, y, { size: 12, font: bold });
    draw(money(total, currency, locale), totalsX, y, { size: 12, font: bold, align: "right" });

    // Footer
    draw(
      "This is a VAT invoice issued in accordance with HMRC requirements. Retain for your records.",
      left,
      40,
      { size: 8, color: sub },
    );

    const bytes = await pdf.save();
    const base64 = btoa(String.fromCharCode(...bytes));

    return new Response(
      JSON.stringify({
        invoice_number: invoiceNumber,
        issued_at: issuedAt,
        currency,
        subtotal,
        tax_amount: taxAmount,
        total,
        pdf_base64: base64,
        filename: `invoice-${invoiceNumber}.pdf`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
