import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzePhotoRequest {
  imageUrl: string;  // Public URL or base64 data URI
  vehicleId?: string;
  filename?: string;
}

interface AnalyzePhotoResponse {
  isVehicle: boolean;
  confidence: number;
  angle: 'front' | 'rear' | 'left_side' | 'right_side' | 'front_quarter' | 'rear_quarter' | 'interior' | 'detail' | 'unknown';
  angleConfidence: number;
  quality: {
    score: number;  // 0-100
    issues: string[];  // e.g., ['too_dark', 'blurry', 'cropped']
  };
  labels: string[];  // Top labels from Vision API
  suggestedVehicleMatch?: {
    make?: string;
    model?: string;
    color?: string;
  };
  rawVisionResponse?: any;  // For debugging
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, vehicleId, filename } = await req.json() as AnalyzePhotoRequest;
    
    const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!GOOGLE_VISION_API_KEY) {
      throw new Error('GOOGLE_VISION_API_KEY is not configured');
    }

    console.log('Analyzing photo:', filename || imageUrl.substring(0, 50));

    // Prepare image content for Vision API
    let imageContent: { source?: { imageUri: string }; content?: string } = {};
    
    if (imageUrl.startsWith('data:')) {
      // Base64 data URI - extract the base64 part
      const base64Data = imageUrl.split(',')[1];
      imageContent = { content: base64Data };
    } else {
      // URL - let Vision API fetch it
      imageContent = { source: { imageUri: imageUrl } };
    }

    // Call Google Cloud Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: imageContent,
            features: [
              { type: 'LABEL_DETECTION', maxResults: 15 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              { type: 'IMAGE_PROPERTIES' },
              { type: 'SAFE_SEARCH_DETECTION' },
            ]
          }]
        })
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', visionResponse.status, errorText);
      throw new Error(`Vision API error: ${visionResponse.status}`);
    }

    const visionData = await visionResponse.json();
    const result = visionData.responses?.[0];
    
    if (!result) {
      throw new Error('No response from Vision API');
    }

    // Extract labels
    const labels = (result.labelAnnotations || []).map((l: any) => l.description.toLowerCase());
    const objects = (result.localizedObjectAnnotations || []).map((o: any) => o.name.toLowerCase());
    
    console.log('Labels detected:', labels);
    console.log('Objects detected:', objects);

    // Determine if it's a vehicle
    const vehicleKeywords = ['car', 'vehicle', 'automobile', 'sports car', 'luxury vehicle', 'sedan', 'coupe', 'suv', 'convertible', 'supercar', 'wheel', 'tire', 'bumper', 'headlight', 'hood', 'trunk'];
    const vehicleLabels = labels.filter((l: string) => vehicleKeywords.some(k => l.includes(k)));
    const vehicleObjects = objects.filter((o: string) => ['car', 'vehicle', 'wheel', 'tire', 'truck'].some(k => o.includes(k)));
    
    const isVehicle = vehicleLabels.length >= 2 || vehicleObjects.length >= 1;
    const vehicleConfidence = Math.min(100, (vehicleLabels.length + vehicleObjects.length * 2) * 15);

    // Determine angle/view
    const angle = classifyAngle(labels, objects, result);
    
    // Assess quality
    const quality = assessQuality(result, labels);

    // Try to extract vehicle info
    const suggestedVehicleMatch = extractVehicleInfo(labels, objects);

    const response: AnalyzePhotoResponse = {
      isVehicle,
      confidence: vehicleConfidence,
      angle: angle.type,
      angleConfidence: angle.confidence,
      quality,
      labels: labels.slice(0, 10),
      suggestedVehicleMatch,
      // Optionally include raw response for debugging (remove in production)
      // rawVisionResponse: result
    };

    console.log('Analysis result:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Photo analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze photo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function classifyAngle(labels: string[], objects: string[], visionResult: any): { type: AnalyzePhotoResponse['angle']; confidence: number } {
  // Check for interior indicators
  const interiorKeywords = ['dashboard', 'steering wheel', 'car seat', 'interior', 'cockpit', 'gauge', 'speedometer', 'console'];
  if (labels.some(l => interiorKeywords.some(k => l.includes(k)))) {
    return { type: 'interior', confidence: 85 };
  }

  // Check for detail shots
  const detailKeywords = ['wheel', 'tire', 'rim', 'headlight', 'taillight', 'badge', 'emblem', 'grille', 'exhaust'];
  const detailMatches = labels.filter(l => detailKeywords.some(k => l.includes(k) && !l.includes('car')));
  if (detailMatches.length >= 2) {
    return { type: 'detail', confidence: 70 };
  }

  // Check for front indicators
  const frontKeywords = ['headlight', 'grille', 'front bumper', 'hood', 'windshield'];
  if (labels.some(l => frontKeywords.some(k => l.includes(k)))) {
    // Check if it might be a quarter view
    const sideIndicators = labels.filter(l => ['door', 'side mirror', 'fender'].some(k => l.includes(k)));
    if (sideIndicators.length > 0) {
      return { type: 'front_quarter', confidence: 65 };
    }
    return { type: 'front', confidence: 75 };
  }

  // Check for rear indicators
  const rearKeywords = ['taillight', 'rear bumper', 'trunk', 'exhaust', 'spoiler', 'rear window'];
  if (labels.some(l => rearKeywords.some(k => l.includes(k)))) {
    const sideIndicators = labels.filter(l => ['door', 'side mirror', 'fender'].some(k => l.includes(k)));
    if (sideIndicators.length > 0) {
      return { type: 'rear_quarter', confidence: 65 };
    }
    return { type: 'rear', confidence: 75 };
  }

  // Check for side indicators
  const sideKeywords = ['door', 'side mirror', 'window', 'fender'];
  if (labels.some(l => sideKeywords.some(k => l.includes(k)))) {
    // Can't easily distinguish left from right without more context
    return { type: 'left_side', confidence: 50 };
  }

  // Default - if it's a car but we can't determine angle
  if (labels.some(l => ['car', 'vehicle', 'automobile'].includes(l))) {
    return { type: 'front_quarter', confidence: 40 };  // Most common photo angle
  }

  return { type: 'unknown', confidence: 0 };
}

function assessQuality(visionResult: any, labels: string[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check image properties for quality indicators
  const imageProps = visionResult.imagePropertiesAnnotation;
  if (imageProps?.dominantColors?.colors) {
    const colors = imageProps.dominantColors.colors;
    
    // Check if image is too dark (dominant colors have low brightness)
    const avgBrightness = colors.reduce((sum: number, c: any) => {
      const r = c.color?.red || 0;
      const g = c.color?.green || 0;
      const b = c.color?.blue || 0;
      return sum + (r + g + b) / 3;
    }, 0) / colors.length;
    
    if (avgBrightness < 50) {
      issues.push('too_dark');
      score -= 20;
    } else if (avgBrightness > 240) {
      issues.push('overexposed');
      score -= 15;
    }
  }

  // Check safe search for inappropriate content
  const safeSearch = visionResult.safeSearchAnnotation;
  if (safeSearch) {
    const riskyLevels = ['LIKELY', 'VERY_LIKELY'];
    if (riskyLevels.includes(safeSearch.adult) || riskyLevels.includes(safeSearch.violence)) {
      issues.push('inappropriate_content');
      score -= 50;
    }
  }

  // Check for blur indicators in labels
  if (labels.some(l => l.includes('blur') || l.includes('motion'))) {
    issues.push('possibly_blurry');
    score -= 15;
  }

  // Bonus for good car photos
  const goodIndicators = ['sports car', 'luxury vehicle', 'supercar', 'exotic car'];
  if (labels.some(l => goodIndicators.some(k => l.includes(k)))) {
    score = Math.min(100, score + 10);
  }

  return { score: Math.max(0, score), issues };
}

function extractVehicleInfo(labels: string[], objects: string[]): AnalyzePhotoResponse['suggestedVehicleMatch'] | undefined {
  const allText = [...labels, ...objects].join(' ').toLowerCase();
  
  // Common car makes that Vision API might detect
  const makes = ['ferrari', 'lamborghini', 'porsche', 'mercedes', 'bmw', 'audi', 'mclaren', 'aston martin', 'bentley', 'rolls-royce', 'maserati', 'bugatti', 'pagani', 'koenigsegg'];
  const detectedMake = makes.find(m => allText.includes(m));

  // Color detection from labels
  const colors = ['red', 'blue', 'black', 'white', 'silver', 'yellow', 'orange', 'green', 'gray', 'grey'];
  const detectedColor = colors.find(c => labels.some(l => l.includes(c)));

  if (detectedMake || detectedColor) {
    return {
      make: detectedMake,
      color: detectedColor
    };
  }

  return undefined;
}
