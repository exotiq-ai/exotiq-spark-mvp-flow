import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId, sendToRenter, sendToOperator } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Missing documentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the signed document
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get booking for context
    let booking: Record<string, any> | null = null;
    if (doc.booking_id) {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", doc.booking_id)
        .single();
      booking = data;
    }

    // Get customer email
    let customerEmail: string | null = null;
    if (doc.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("email, full_name")
        .eq("id", doc.customer_id)
        .single();
      customerEmail = data?.email || null;
    }
    if (!customerEmail && booking?.customer_email) {
      customerEmail = booking.customer_email;
    }

    // Get operator email (team owner)
    let operatorEmail: string | null = null;
    if (doc.team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("owner_id")
        .eq("id", doc.team_id)
        .single();
      if (team?.owner_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", team.owner_id)
          .single();
        operatorEmail = profile?.email || null;
      }
    }

    // Download the signed PDF for attachment
    const getStoragePath = (fileUrl: string): string => {
      const signMatch = fileUrl.match(/\/object\/sign\/customer-documents\/([^?]+)/);
      if (signMatch) return decodeURIComponent(signMatch[1]);
      const pubMatch = fileUrl.match(/\/object\/public\/customer-documents\/([^?]+)/);
      if (pubMatch) return decodeURIComponent(pubMatch[1]);
      return fileUrl;
    };

    const storagePath = getStoragePath(doc.file_url);
    const { data: pdfData, error: downloadErr } = await supabase.storage
      .from("customer-documents")
      .download(storagePath);

    let pdfBase64: string | null = null;
    if (pdfData && !downloadErr) {
      const arrayBuffer = await pdfData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      pdfBase64 = btoa(binary);
    }

    const vehicleName = booking?.vehicle_name || "your rental";
    const docRef = doc.doc_ref || "Document";
    const customerName = booking?.customer_name || doc.signed_by_name || "Customer";
    const sentResults: string[] = [];

    // Send to renter
    if (sendToRenter && customerEmail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Exotiq <noreply@exotiq.io>",
          to: [customerEmail],
          subject: `Your Rental Agreement — ${vehicleName}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Your Signed Rental Agreement</h2>
              <p>Hi ${customerName},</p>
              <p>Thank you for signing your rental agreement for <strong>${vehicleName}</strong>.</p>
              <p>Your signed document is attached to this email for your records.</p>
              <p style="color: #666; font-size: 13px;">Reference: ${docRef}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 12px;">This document was digitally signed through Exotiq Vault.</p>
            </div>
          `,
          ...(pdfBase64
            ? {
                attachments: [
                  {
                    filename: `${docRef}-signed-agreement.pdf`,
                    content: pdfBase64,
                  },
                ],
              }
            : {}),
        }),
      });
      const resBody = await res.text();
      if (res.ok) {
        sentResults.push(`renter:${customerEmail}`);
      } else {
        console.error("Resend error (renter):", resBody);
      }
    }

    // Send to operator
    if (sendToOperator && operatorEmail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Exotiq <noreply@exotiq.io>",
          to: [operatorEmail],
          subject: `Signed Agreement — ${customerName} — ${docRef}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Signed Rental Agreement</h2>
              <p><strong>${customerName}</strong> has signed the rental agreement for <strong>${vehicleName}</strong>.</p>
              <p>The signed document is attached and has been filed in your Exotiq Vault.</p>
              <p style="color: #666; font-size: 13px;">Reference: ${docRef}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 12px;">Exotiq Vault — Digital Document Management</p>
            </div>
          `,
          ...(pdfBase64
            ? {
                attachments: [
                  {
                    filename: `${docRef}-signed-agreement.pdf`,
                    content: pdfBase64,
                  },
                ],
              }
            : {}),
        }),
      });
      const resBody = await res.text();
      if (res.ok) {
        sentResults.push(`operator:${operatorEmail}`);
      } else {
        console.error("Resend error (operator):", resBody);
      }
    }

    // Update document with email_sent_at
    if (sentResults.length > 0) {
      await supabase
        .from("documents")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", documentId);
    }

    return new Response(
      JSON.stringify({ sent: sentResults, count: sentResults.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-signed-document error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
