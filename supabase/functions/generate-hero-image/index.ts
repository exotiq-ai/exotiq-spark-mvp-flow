import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateHeroRequest {
  vehicleId: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  userId: string;
  teamId?: string;
}

interface GenerateHeroResponse {
  success: boolean;
  imageUrl?: string;
  photoId?: string;
  generatedAt?: string;
  error?: string;
}

/**
 * Convert base64 to Uint8Array for storage upload
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { vehicleId, make, model, year, color, teamId } = await req.json() as GenerateHeroRequest;

    if (!vehicleId || !make || !model) {
      return new Response(
        JSON.stringify({ success: false, error: "vehicleId, make, and model are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({ success: false, error: "Storage service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: require a verified caller. This endpoint performs paid AI image
    // generation and service-role storage writes, so the user identity must come
    // from a validated JWT — never from the request body (which an attacker
    // controls). The frontend's supabase.functions.invoke() attaches the user's
    // access token automatically.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for storage access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build the generation prompt
    const yearStr = year ? `${year} ` : "";
    const colorStr = color || "default factory";
    
    const prompt = `Professional automotive photography of a ${yearStr}${make} ${model} in ${colorStr} color. Front 3/4 angle view (front quarter), showroom setting with clean white and light gray gradient background. Professional studio lighting with soft shadows. High-end commercial photography style. The car should be the main subject, perfectly centered, with a subtle ground shadow beneath. Photorealistic quality, crisp details, pristine condition. No text, no watermarks, no people, no other cars.`;

    console.log(`Generating hero image for ${yearStr}${make} ${model} (${color || 'default color'})...`);
    console.log(`Prompt: ${prompt}`);

    // Call Gemini 2.5 Flash Image (Nano Banana) for image generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Image generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const images = aiResponse.choices?.[0]?.message?.images;

    if (!images || images.length === 0) {
      console.error("No images in AI response:", JSON.stringify(aiResponse));
      return new Response(
        JSON.stringify({ success: false, error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract base64 image data
    const imageData = images[0]?.image_url?.url;
    if (!imageData || !imageData.startsWith("data:image")) {
      console.error("Invalid image data format");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid image format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the base64 data
    const [header, base64Content] = imageData.split(",");
    const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/png";
    const extension = mimeType.split("/")[1] || "png";
    
    // Convert to binary for storage
    const imageBytes = base64ToUint8Array(base64Content);

    // Upload to Supabase storage
    const timestamp = Date.now();
    const storagePath = `${userId}/generated/${vehicleId}/hero-${timestamp}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("vehicle-photos")
      .upload(storagePath, imageBytes, {
        contentType: mimeType,
        cacheControl: "31536000", // 1 year cache
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a signed URL (1 year expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("vehicle-photos")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

    if (signedError || !signedData?.signedUrl) {
      console.error("Failed to create signed URL:", signedError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create image URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageUrl = signedData.signedUrl;
    const generatedAt = new Date().toISOString();

    // Save to vehicle_photos table
    const { data: photoRecord, error: insertError } = await supabase
      .from("vehicle_photos")
      .insert({
        vehicle_id: vehicleId,
        user_id: userId,
        team_id: teamId || null,
        storage_path: storagePath,
        url: imageUrl,
        photo_type: "hero",
        detected_angle: "front_quarter",
        source: "generated",
        generation_prompt: prompt,
        is_vehicle_confirmed: true,
        quality_score: 95,
        quality_issues: [],
        original_filename: `generated-hero-${make}-${model}.${extension}`,
        file_size_bytes: imageBytes.length,
        mime_type: mimeType,
        analyzed_at: generatedAt
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      // Image was uploaded successfully, so return partial success
      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl,
          generatedAt,
          error: "Image saved but database record failed"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also update the vehicle's image_url for immediate display
    await supabase
      .from("vehicles")
      .update({ image_url: imageUrl })
      .eq("id", vehicleId);

    console.log(`Successfully generated hero for ${make} ${model}, saved to ${storagePath}`);

    const result: GenerateHeroResponse = {
      success: true,
      imageUrl,
      photoId: photoRecord?.id,
      generatedAt
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-hero-image error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
