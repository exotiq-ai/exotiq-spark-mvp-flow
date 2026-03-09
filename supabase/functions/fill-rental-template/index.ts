import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { templateDocumentId, bookingId } = await req.json();

    if (!templateDocumentId || !bookingId) {
      return new Response(
        JSON.stringify({ error: "Missing templateDocumentId or bookingId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch template document
    const { data: templateDoc, error: templateErr } = await supabase
      .from("documents")
      .select("file_url, name")
      .eq("id", templateDocumentId)
      .single();
    if (templateErr || !templateDoc) {
      return new Response(
        JSON.stringify({ error: "Template document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking with related data
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();
    if (bookingErr || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch customer (if linked)
    let customer: Record<string, any> | null = null;
    if (booking.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("id", booking.customer_id)
        .single();
      customer = data;
    }

    // Fetch vehicle (if linked)
    let vehicle: Record<string, any> | null = null;
    if (booking.vehicle_id) {
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", booking.vehicle_id)
        .single();
      vehicle = data;
    }

    // Fetch team name
    let teamName = "";
    if (booking.team_id) {
      const { data } = await supabase
        .from("teams")
        .select("name")
        .eq("id", booking.team_id)
        .single();
      teamName = data?.name || "";
    }

    // Format date helper
    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return "";
      try {
        return new Date(dateStr).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return dateStr;
      }
    };

    const formatCurrency = (val: number | null): string => {
      if (val === null || val === undefined) return "";
      return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    };

    // Build field mapping
    const fieldMap: Record<string, string> = {
      // Customer fields
      customer_name: customer?.full_name || booking.customer_name || "",
      customer_email: customer?.email || booking.customer_email || "",
      customer_phone: customer?.phone || booking.customer_phone || "",
      customer_address: customer?.address || "",
      drivers_license: customer?.drivers_license || "",
      license_expiry: formatDate(customer?.license_expiry),
      date_of_birth: formatDate(customer?.date_of_birth),
      insurance_provider: customer?.insurance_provider || "",
      insurance_policy: customer?.insurance_policy || "",

      // Vehicle fields
      vehicle_name: vehicle?.name || booking.vehicle_name || "",
      vehicle_year: vehicle?.year ? String(vehicle.year) : "",
      vehicle_make: vehicle?.make || "",
      vehicle_model: vehicle?.model || "",
      vehicle_vin: vehicle?.vin || "",
      vehicle_plate: vehicle?.license_plate || "",
      vehicle_color: vehicle?.color || "",

      // Booking fields
      rental_start: formatDate(booking.start_date),
      rental_end: formatDate(booking.end_date),
      daily_rate: formatCurrency(booking.daily_rate),
      total_value: formatCurrency(booking.total_value),
      deposit_amount: formatCurrency(booking.deposit_amount || booking.security_deposit_amount),
      pickup_location: booking.pickup_location || "",
      delivery_address: booking.delivery_address || "",
      dropoff_location: booking.dropoff_location || "",
      mileage_limit: booking.mileage_limit ? String(booking.mileage_limit) : "",

      // Meta
      agreement_date: new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      today_date: new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      operator_name: teamName,
      booking_id: bookingId,
    };

    // Extract storage path from file_url
    const getStoragePath = (fileUrl: string): string => {
      const signMatch = fileUrl.match(/\/object\/sign\/customer-documents\/([^?]+)/);
      if (signMatch) return decodeURIComponent(signMatch[1]);
      const pubMatch = fileUrl.match(/\/object\/public\/customer-documents\/([^?]+)/);
      if (pubMatch) return decodeURIComponent(pubMatch[1]);
      return fileUrl;
    };

    // Download template PDF
    const storagePath = getStoragePath(templateDoc.file_url);
    const { data: pdfData, error: downloadErr } = await supabase.storage
      .from("customer-documents")
      .download(storagePath);

    if (downloadErr || !pdfData) {
      console.error("Download error:", downloadErr);
      return new Response(
        JSON.stringify({ error: "Failed to download template PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load PDF and fill form fields
    const pdfBytes = await pdfData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      let filledCount = 0;
      for (const field of fields) {
        const fieldName = field.getName();
        const value = fieldMap[fieldName];
        if (value !== undefined && value !== "") {
          try {
            // Try as text field
            const textField = form.getTextField(fieldName);
            textField.setText(value);
            filledCount++;
          } catch {
            // Field might not be a text field — skip gracefully
            console.log(`Skipping non-text field: ${fieldName}`);
          }
        }
      }

      // Flatten form fields to prevent editing
      form.flatten();

      console.log(`Filled ${filledCount} of ${fields.length} form fields`);
    } catch (formError) {
      // PDF has no form fields — that's OK, just use as-is
      console.log("No AcroForm fields found in template, using PDF as-is");
    }

    // Save filled PDF
    const filledPdfBytes = await pdfDoc.save();

    // Upload filled PDF
    const filledPath = `filled-templates/${userId}/${bookingId}-${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("customer-documents")
      .upload(filledPath, filledPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ error: "Failed to upload filled PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL for the filled PDF
    const { data: signedUrlData } = await supabase.storage
      .from("customer-documents")
      .createSignedUrl(filledPath, 3600); // 1 hour expiry

    return new Response(
      JSON.stringify({
        filledPdfPath: filledPath,
        filledPdfUrl: signedUrlData?.signedUrl || filledPath,
        fieldsFound: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fill-rental-template error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
