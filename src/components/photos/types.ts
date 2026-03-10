// Vehicle Photo Management Types
// These match the database schema in supabase/migrations/20260129000000_vehicle_photos.sql

export type PhotoType = 'hero' | 'exterior' | 'interior' | 'detail' | 'document';

export type DetectedAngle = 
  | 'front' 
  | 'rear' 
  | 'left_side' 
  | 'right_side' 
  | 'front_quarter' 
  | 'rear_quarter' 
  | 'interior' 
  | 'detail' 
  | 'unknown';

export type UnmatchedPhotoStatus = 'pending' | 'matched' | 'skipped' | 'rejected';

export type BatchStatus = 'pending' | 'processing' | 'review_needed' | 'completed' | 'failed';

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  user_id: string;
  team_id: string | null;
  
  // Photo storage
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  
  // Classification
  photo_type: PhotoType;
  detected_angle: DetectedAngle | null;
  
  // AI analysis
  ai_analysis: AIAnalysisResult | null;
  is_vehicle_confirmed: boolean;
  quality_score: number;
  quality_issues: string[] | null;
  
  // Hero enhancement (deprecated — PhotoRoom sunset)
  /** @deprecated No longer used after PhotoRoom sunset */
  is_enhanced?: boolean;
  /** @deprecated No longer used after PhotoRoom sunset */
  enhanced_url?: string | null;
  /** @deprecated No longer used after PhotoRoom sunset */
  enhancement_settings?: Record<string, any> | null;
  
  // Metadata
  original_filename: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  
  // Display
  display_order: number;
  is_visible: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
  enhanced_at: string | null;
}

export interface PhotoUploadBatch {
  id: string;
  user_id: string;
  team_id: string | null;
  
  batch_name: string | null;
  source: 'upload' | 'import' | 'cloud_sync';
  
  total_files: number;
  processed_files: number;
  matched_files: number;
  unmatched_files: number;
  failed_files: number;
  
  status: BatchStatus;
  error_message: string | null;
  
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface UnmatchedPhoto {
  id: string;
  batch_id: string | null;
  user_id: string;
  team_id: string | null;
  
  storage_path: string;
  url: string;
  original_filename: string | null;
  
  ai_analysis: AIAnalysisResult | null;
  suggested_vehicle_id: string | null;
  suggestion_confidence: number;
  suggested_make: string | null;
  suggested_model: string | null;
  suggested_color: string | null;
  
  status: UnmatchedPhotoStatus;
  matched_vehicle_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  
  created_at: string;
  
  // Joined data
  suggested_vehicle?: {
    id: string;
    name: string;
    make: string;
    model: string;
    year: number;
  };
}

// AI Analysis Response from Edge Function
export interface AIAnalysisResult {
  isVehicle: boolean;
  confidence: number;
  angle: DetectedAngle;
  angleConfidence: number;
  quality: {
    score: number;
    issues: string[];
  };
  labels: string[];
  suggestedVehicleMatch?: {
    make?: string;
    model?: string;
    color?: string;
  };
}

// Upload Progress Tracking
export interface PhotoUploadProgress {
  file: File;
  status: 'pending' | 'preprocessing' | 'uploading' | 'matching' | 'analyzing' | 'complete' | 'error';
  progress: number; // 0-100
  result?: {
    url: string;
    analysis: AIAnalysisResult;
    vehicleId?: string;
    photoId?: string;
  };
  error?: string;
  /** How this photo was matched to a vehicle */
  matchResult?: 'auto-matched' | 'suggested' | 'unmatched' | 'skipped';
  /** Compression stats for metrics display */
  compressionStats?: {
    originalBytes: number;
    compressedBytes: number;
  };
}

// Photo Stats for Dashboard
export interface PhotoStats {
  totalPhotos: number;
  vehiclesWithPhotos: number;
  vehiclesWithoutPhotos: number;
  heroPhotos: number;
  unmatchedPhotos: number;
  averageQualityScore: number;
}

// Constants for UI
export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  hero: 'Hero Photo',
  exterior: 'Exterior',
  interior: 'Interior',
  detail: 'Detail',
  document: 'Document',
};

export const PHOTO_TYPE_ICONS: Record<PhotoType, string> = {
  hero: 'Star',
  exterior: 'Car',
  interior: 'Armchair',
  detail: 'ZoomIn',
  document: 'FileText',
};

export const ANGLE_LABELS: Record<DetectedAngle, string> = {
  front: 'Front View',
  rear: 'Rear View',
  left_side: 'Left Side',
  right_side: 'Right Side',
  front_quarter: 'Front Quarter',
  rear_quarter: 'Rear Quarter',
  interior: 'Interior',
  detail: 'Detail Shot',
  unknown: 'Unknown Angle',
};

export const QUALITY_ISSUE_LABELS: Record<string, string> = {
  too_dark: 'Too Dark',
  overexposed: 'Overexposed',
  possibly_blurry: 'Possibly Blurry',
  inappropriate_content: 'Inappropriate Content',
};

// Recommended photo angles for complete vehicle coverage
export const RECOMMENDED_ANGLES: { angle: DetectedAngle; label: string; required: boolean }[] = [
  { angle: 'front_quarter', label: '45° Front (Hero)', required: true },
  { angle: 'front', label: 'Front', required: true },
  { angle: 'rear', label: 'Rear', required: true },
  { angle: 'left_side', label: 'Left Side', required: true },
  { angle: 'right_side', label: 'Right Side', required: true },
  { angle: 'rear_quarter', label: '45° Rear', required: false },
  { angle: 'interior', label: 'Interior - Dashboard', required: true },
  { angle: 'interior', label: 'Interior - Seats', required: false },
  { angle: 'detail', label: 'Wheels', required: false },
  { angle: 'detail', label: 'Engine Bay', required: false },
];
