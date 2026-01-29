import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnhancePhotoRequest {
  imageUrl: string;           // Public URL of the original photo
  photoId?: string;           // Optional: vehicle_photos ID to update
  background?: 'white' | 'gradient' | 'transparent';  // Background style
  outputFormat?: 'png' | 'jpg';
}

interface EnhancePhotoResponse {
  success: boolean;
  enhancedUrl?: string;       // URL of the enhanced image (base64 data URI or hosted)
  originalUrl: string;
  processingTimeMs: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth check - validate JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('Unauthorized access attempt to enhance-hero-photo');
      return new Response(
        JSON.stringify({ 
          success: false, 
          originalUrl: '', 
          processingTimeMs: Date.now() - startTime,
          error: 'Unauthorized' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.warn('Invalid JWT token in enhance-hero-photo');
      return new Response(
        JSON.stringify({ 
          success: false, 
          originalUrl: '', 
          processingTimeMs: Date.now() - startTime,
          error: 'Unauthorized' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated request from user: ${userId}`);

    const { imageUrl, photoId, background = 'white', outputFormat = 'png' } = await req.json() as EnhancePhotoRequest;
    
    const PHOTOROOM_API_KEY = Deno.env.get('PHOTOROOM_API_KEY');
    if (!PHOTOROOM_API_KEY) {
      throw new Error('PHOTOROOM_API_KEY is not configured');
    }

    console.log('Enhancing hero photo:', imageUrl.substring(0, 50));

    // Fetch the original image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const imageBlob = await imageResponse.blob();
    
    // Prepare form data for Photoroom API
    const formData = new FormData();
    formData.append('image_file', imageBlob, 'photo.jpg');
    
    // Background settings
    if (background === 'white') {
      formData.append('bg_color', 'white');
    } else if (background === 'gradient') {
      // Light gray gradient effect
      formData.append('bg_color', '#f5f5f5');
    }
    // transparent = no bg_color specified
    
    formData.append('format', outputFormat);
    formData.append('size', 'auto');  // Maintain original size
    
    // Call Photoroom API - Remove Background endpoint
    const photoroomResponse = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'x-api-key': PHOTOROOM_API_KEY,
      },
      body: formData
    });

    if (!photoroomResponse.ok) {
      const errorText = await photoroomResponse.text();
      console.error('Photoroom API error:', photoroomResponse.status, errorText);
      
      if (photoroomResponse.status === 402) {
        throw new Error('Photoroom API credits exhausted');
      }
      if (photoroomResponse.status === 401) {
        throw new Error('Invalid Photoroom API key');
      }
      throw new Error(`Photoroom API error: ${photoroomResponse.status}`);
    }

    // Get the enhanced image as blob
    const enhancedBlob = await photoroomResponse.blob();
    
    // Convert to base64 for return (or could upload to storage)
    const arrayBuffer = await enhancedBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    const enhancedDataUri = `data:${mimeType};base64,${base64}`;

    const processingTimeMs = Date.now() - startTime;
    console.log(`Hero photo enhanced in ${processingTimeMs}ms`);

    const response: EnhancePhotoResponse = {
      success: true,
      enhancedUrl: enhancedDataUri,
      originalUrl: imageUrl,
      processingTimeMs
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Hero photo enhancement error:', error);
    
    const response: EnhancePhotoResponse = {
      success: false,
      originalUrl: '',
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Failed to enhance photo'
    };
    
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
