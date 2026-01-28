// Guided Inspection Types

export type InspectionDirection = 'check_in' | 'check_out';
export type InspectionStatus = 'draft' | 'in_progress' | 'completed' | 'reviewed';

export type DamageType = 
  | 'scratch' | 'dent' | 'chip' | 'crack' | 'scuff' 
  | 'stain' | 'tear' | 'missing_part' | 'mechanical' | 'other';

export type VehicleLocation = 
  | 'front_bumper' | 'rear_bumper' | 'hood' | 'roof' | 'trunk'
  | 'front_left_fender' | 'front_right_fender' | 'rear_left_quarter' | 'rear_right_quarter'
  | 'left_door_front' | 'left_door_rear' | 'right_door_front' | 'right_door_rear'
  | 'left_mirror' | 'right_mirror' | 'windshield' | 'rear_window'
  | 'left_front_wheel' | 'left_rear_wheel' | 'right_front_wheel' | 'right_rear_wheel'
  | 'headlight_left' | 'headlight_right' | 'taillight_left' | 'taillight_right'
  | 'dashboard' | 'steering_wheel' | 'center_console' | 'seats_front' | 'seats_rear'
  | 'carpet_floor' | 'door_panel_left' | 'door_panel_right' | 'other';

export type DamageSeverity = 'minor' | 'moderate' | 'major';

export interface GuidedPhoto {
  id: string;
  role: PhotoRole;
  label: string;
  instruction: string;
  required: boolean;
  url?: string;
  skipped: boolean;
  qualityWarning: boolean;
  capturedAt?: Date;
}

export type PhotoRole = 
  | 'front'
  | 'front_left_quarter'
  | 'left_side'
  | 'rear_left_quarter'
  | 'rear'
  | 'rear_right_quarter'
  | 'right_side'
  | 'front_right_quarter'
  | 'odometer'
  | 'dashboard'
  | 'interior';

export interface DamageItem {
  id: string;
  photoUrl: string;
  damageType: DamageType;
  vehicleLocation: VehicleLocation;
  severity: DamageSeverity;
  notes?: string;
  qualityWarning: boolean;
}

export interface InspectionChecklist {
  odometerReading: number | null;
  fuelLevel: number;
  keysCount: number;
  cleanlinessRating: number;
  exteriorCondition: 'excellent' | 'good' | 'fair' | 'poor';
  interiorCondition: 'excellent' | 'good' | 'fair' | 'poor';
  tireCondition: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface GuidedInspectionState {
  vehicleId: string;
  bookingId?: string;
  direction: InspectionDirection;
  status: InspectionStatus;
  currentStep: number;
  photos: GuidedPhoto[];
  damageItems: DamageItem[];
  checklist: InspectionChecklist;
  inspectorName: string;
  notes: string;
  startedAt?: Date;
  completedAt?: Date;
  locationLat?: number;
  locationLng?: number;
  deviceInfo?: Record<string, unknown>;
}

// Photo roles configuration with instructions
export const GUIDED_PHOTO_CONFIG: Omit<GuidedPhoto, 'id' | 'url' | 'skipped' | 'qualityWarning' | 'capturedAt'>[] = [
  {
    role: 'front',
    label: 'Front View',
    instruction: 'Capture the entire front of the vehicle including bumper and headlights',
    required: false,
  },
  {
    role: 'front_left_quarter',
    label: 'Front Left Quarter',
    instruction: 'Capture from a 45° angle showing front and left side',
    required: false,
  },
  {
    role: 'left_side',
    label: 'Left Side',
    instruction: 'Capture the full left side profile of the vehicle',
    required: false,
  },
  {
    role: 'rear_left_quarter',
    label: 'Rear Left Quarter',
    instruction: 'Capture from a 45° angle showing rear and left side',
    required: false,
  },
  {
    role: 'rear',
    label: 'Rear View',
    instruction: 'Capture the entire rear of the vehicle including bumper and taillights',
    required: false,
  },
  {
    role: 'rear_right_quarter',
    label: 'Rear Right Quarter',
    instruction: 'Capture from a 45° angle showing rear and right side',
    required: false,
  },
  {
    role: 'right_side',
    label: 'Right Side',
    instruction: 'Capture the full right side profile of the vehicle',
    required: false,
  },
  {
    role: 'front_right_quarter',
    label: 'Front Right Quarter',
    instruction: 'Capture from a 45° angle showing front and right side',
    required: false,
  },
  {
    role: 'odometer',
    label: 'Odometer',
    instruction: 'Capture a clear photo of the odometer reading',
    required: true, // Odometer is always required
  },
  {
    role: 'dashboard',
    label: 'Dashboard',
    instruction: 'Capture the full dashboard including gauges and displays',
    required: false,
  },
  {
    role: 'interior',
    label: 'Interior Overview',
    instruction: 'Capture a wide view of the interior showing seats and console',
    required: false,
  },
];

// Damage type labels
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  scratch: 'Scratch',
  dent: 'Dent',
  chip: 'Chip',
  crack: 'Crack',
  scuff: 'Scuff',
  stain: 'Stain',
  tear: 'Tear',
  missing_part: 'Missing Part',
  mechanical: 'Mechanical Issue',
  other: 'Other',
};

// Vehicle location labels
export const VEHICLE_LOCATION_LABELS: Record<VehicleLocation, string> = {
  front_bumper: 'Front Bumper',
  rear_bumper: 'Rear Bumper',
  hood: 'Hood',
  roof: 'Roof',
  trunk: 'Trunk',
  front_left_fender: 'Front Left Fender',
  front_right_fender: 'Front Right Fender',
  rear_left_quarter: 'Rear Left Quarter Panel',
  rear_right_quarter: 'Rear Right Quarter Panel',
  left_door_front: 'Left Front Door',
  left_door_rear: 'Left Rear Door',
  right_door_front: 'Right Front Door',
  right_door_rear: 'Right Rear Door',
  left_mirror: 'Left Mirror',
  right_mirror: 'Right Mirror',
  windshield: 'Windshield',
  rear_window: 'Rear Window',
  left_front_wheel: 'Left Front Wheel',
  left_rear_wheel: 'Left Rear Wheel',
  right_front_wheel: 'Right Front Wheel',
  right_rear_wheel: 'Right Rear Wheel',
  headlight_left: 'Left Headlight',
  headlight_right: 'Right Headlight',
  taillight_left: 'Left Taillight',
  taillight_right: 'Right Taillight',
  dashboard: 'Dashboard',
  steering_wheel: 'Steering Wheel',
  center_console: 'Center Console',
  seats_front: 'Front Seats',
  seats_rear: 'Rear Seats',
  carpet_floor: 'Carpet/Floor',
  door_panel_left: 'Left Door Panel',
  door_panel_right: 'Right Door Panel',
  other: 'Other',
};

// Severity labels and colors
export const SEVERITY_CONFIG: Record<DamageSeverity, { label: string; color: string }> = {
  minor: { label: 'Minor', color: 'bg-yellow-500' },
  moderate: { label: 'Moderate', color: 'bg-orange-500' },
  major: { label: 'Major', color: 'bg-red-500' },
};
