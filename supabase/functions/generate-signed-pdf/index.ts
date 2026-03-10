import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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
    // Validate auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the user token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      originalPdfPath,
      signatureImageDataUrl,
      signerName,
      operatorName,
      docRef,
      bookingDetails,
      timestamp,
      acknowledgements,
    } = await req.json();

    if (!originalPdfPath || !signatureImageDataUrl || !signerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: originalPdfPath, signatureImageDataUrl, signerName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download original PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from("customer-documents")
      .download(originalPdfPath);

    if (downloadError || !pdfData) {
      console.error("PDF download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download original PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the PDF
    const pdfBytes = await pdfData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Decode signature image (data URL -> bytes)
    const signatureBase64 = signatureImageDataUrl.split(",")[1];
    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    // Add signature page
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const textColor = rgb(0.1, 0.1, 0.1);
    const mutedColor = rgb(0.4, 0.4, 0.4);
    let y = 720;

    // Title
    page.drawText("SIGNATURE PAGE", {
      x: 50,
      y,
      size: 18,
      font: boldFont,
      color: textColor,
    });
    y -= 30;

    // Divider line
    page.drawLine({
      start: { x: 50, y },
      end: { x: 562, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 30;

    // Document reference
    if (docRef) {
      page.drawText(`Document Reference: ${docRef}`, {
        x: 50, y, size: 10, font, color: mutedColor,
      });
      y -= 20;
    }

    // Booking details
    if (bookingDetails) {
      const details = [
        bookingDetails.vehicleName && `Vehicle: ${bookingDetails.vehicleName}`,
        bookingDetails.customerName && `Renter: ${bookingDetails.customerName}`,
        bookingDetails.startDate && bookingDetails.endDate &&
          `Rental Period: ${bookingDetails.startDate} — ${bookingDetails.endDate}`,
        bookingDetails.totalValue && `Total Value: $${Number(bookingDetails.totalValue).toLocaleString()}`,
      ].filter(Boolean);

      for (const detail of details) {
        page.drawText(detail as string, {
          x: 50, y, size: 10, font, color: textColor,
        });
        y -= 18;
      }
      y -= 10;
    }

    // Agreement text
    page.drawText("By signing below, I acknowledge that I have read and agree to the terms", {
      x: 50, y, size: 10, font, color: textColor,
    });
    y -= 16;
    page.drawText("and conditions outlined in this rental agreement.", {
      x: 50, y, size: 10, font, color: textColor,
    });
    y -= 40;

    // Signature label
    page.drawText("Signature:", {
      x: 50, y, size: 11, font: boldFont, color: textColor,
    });
    y -= 10;

    // Draw signature image (scaled to fit ~300x100)
    const sigDims = signatureImage.scale(
      Math.min(300 / signatureImage.width, 100 / signatureImage.height)
    );
    page.drawImage(signatureImage, {
      x: 50,
      y: y - sigDims.height,
      width: sigDims.width,
      height: sigDims.height,
    });
    y -= sigDims.height + 10;

    // Signature line
    page.drawLine({
      start: { x: 50, y },
      end: { x: 350, y },
      thickness: 0.5,
      color: textColor,
    });
    y -= 20;

    // Printed name
    page.drawText(`Printed Name: ${signerName}`, {
      x: 50, y, size: 11, font, color: textColor,
    });
    y -= 20;

    // Date/time
    const signedDate = timestamp || new Date().toISOString();
    page.drawText(`Date & Time: ${new Date(signedDate).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    })}`, {
      x: 50, y, size: 11, font, color: textColor,
    });
    y -= 40;

    // Operator Representative section
    if (operatorName) {
      page.drawText("Operator Representative:", {
        x: 50, y, size: 11, font: boldFont, color: textColor,
      });
      y -= 20;
      page.drawText(operatorName, {
        x: 50, y, size: 11, font, color: textColor,
      });
      y -= 16;
      page.drawText("Digitally acknowledged", {
        x: 50, y, size: 9, font, color: mutedColor,
      });
      y -= 30;
    }

    // Footer
    const footerRef = docRef ? ` Reference: ${docRef}` : "";
    page.drawText(`This document was digitally signed through Exotiq Vault on ${new Date(signedDate).toLocaleDateString("en-US", { dateStyle: "long" })}.${footerRef}`, {
      x: 50, y: 50, size: 8, font, color: mutedColor,
    });

    // Save the modified PDF
    const signedPdfBytes = await pdfDoc.save();

    // Upload to storage
    const signedFileName = `signed/${user.id}/${docRef || `signed-${Date.now()}`}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("customer-documents")
      .upload(signedFileName, signedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload signed PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Capture IP from request headers
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    return new Response(
      JSON.stringify({
        signedPdfPath: signedFileName,
        clientIp,
        docRef,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-signed-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
