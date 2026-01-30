import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
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

    console.log(`Authenticated request from user: ${user.id}`);

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
    
    // File size validation - 15MB limit
    if (imageBlob.size > 15 * 1024 * 1024) {
      throw new Error('Image too large for enhancement. Maximum size is 15MB.');
    }
    
    console.log(`Image size: ${(imageBlob.size / 1024 / 1024).toFixed(2)}MB`);
    
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
    const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    
    let enhancedUrl: string;
    
    // If photoId provided, upload to storage for better performance
    if (photoId) {
      const fileName = `enhanced/${photoId}_${Date.now()}.${outputFormat}`;
      
      // Use service role client for storage upload
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      const { error: uploadError } = await serviceClient
        .storage
        .from('vehicle-photos')
        .upload(fileName, enhancedBlob, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload enhanced image: ${uploadError.message}`);
      }

      const { data: urlData } = serviceClient.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName);

      enhancedUrl = urlData.publicUrl;
      console.log(`Enhanced image uploaded to storage: ${fileName}`);
    } else {
      // Fallback to base64 if no photoId (shouldn't happen in normal flow)
      const arrayBuffer = await enhancedBlob.arrayBuffer();
      const base64 = base64Encode(arrayBuffer);
      enhancedUrl = `data:${mimeType};base64,${base64}`;
      console.log('Returning base64 data URI (no photoId provided)');
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`Hero photo enhanced in ${processingTimeMs}ms`);

    const response: EnhancePhotoResponse = {
      success: true,
      enhancedUrl,
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
