import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { Database } from "@/integrations/supabase/types";
import { 
  Camera, 
  Fuel, 
  Gauge,
  CheckCircle,
  AlertTriangle,
  Images
} from "lucide-react";
import { InspectionPhotoUpload, InspectionPhoto } from "./InspectionPhotoUpload";
import { InspectionPhotoGallery } from "./InspectionPhotoGallery";

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

interface InspectionFormProps {
  vehicleId: string;
  bookingId?: string;
  inspectionType: 'pre_rental' | 'post_rental';
  onComplete?: () => void;
}

export const InspectionForm = ({
  vehicleId,
  bookingId,
  inspectionType,
  onComplete
}: InspectionFormProps) => {
  const { vehicles, createInspectionWithPhotos } = useFleet();
  const [loading, setLoading] = useState(false);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  
  const vehicle = vehicles.find(v => v.id === vehicleId);
  
  const [formData, setFormData] = useState({
    inspector_name: "",
    odometer_reading: 0,
    fuel_level: 100,
    exterior_condition: "excellent",
    interior_condition: "excellent",
    tire_condition: "good",
    notes: "",
  });

  const [fuelLevel, setFuelLevel] = useState([100]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare photo data for uploaded photos
      const uploadedPhotos = photos
        .filter(p => p.status === 'uploaded' && p.path)
        .map(p => ({
          photo_url: p.url,
          photo_type: p.type,
          storage_path: p.path,
        }));

      await createInspectionWithPhotos(
        {
          vehicle_id: vehicleId,
          booking_id: bookingId || null,
          inspection_type: inspectionType,
          inspector_name: formData.inspector_name,
          odometer_reading: formData.odometer_reading,
          fuel_level: fuelLevel[0],
          exterior_condition: formData.exterior_condition,
          interior_condition: formData.interior_condition,
          tire_condition: formData.tire_condition,
          notes: formData.notes,
        },
        uploadedPhotos
      );

      // Reset form
      setFormData({
        inspector_name: "",
        odometer_reading: 0,
        fuel_level: 100,
        exterior_condition: "excellent",
        interior_condition: "excellent",
        tire_condition: "good",
        notes: "",
      });
      setFuelLevel([100]);
      setPhotos([]);

      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error creating inspection:", error);
    } finally {
      setLoading(false);
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return <Badge className="bg-success/10 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" />Excellent</Badge>;
      case 'good':
        return <Badge className="bg-primary/10 text-primary border-primary/30">Good</Badge>;
      case 'fair':
        return <Badge className="bg-warning/10 text-warning border-warning/30">Fair</Badge>;
      case 'poor':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Poor</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <>
      {vehicle && (
        <VehicleImageDialog
          open={showVehicleImage}
          onOpenChange={setShowVehicleImage}
          vehicleName={vehicle.name}
          vehicleDetails={{
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            status: vehicle.status,
            dailyRate: Number(vehicle.current_rate),
          }}
        />
      )}

      <Card className="card-premium p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">
            {inspectionType === 'pre_rental' ? 'Pickup' : 'Return'} Inspection
          </h3>
          <p 
            className="text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => setShowVehicleImage(true)}
          >
            Document vehicle condition for {vehicle?.name}
          </p>
        </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Inspector Name */}
        <div className="space-y-2">
          <Label htmlFor="inspector_name">Inspector Name *</Label>
          <Input
            id="inspector_name"
            required
            value={formData.inspector_name}
            onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
            placeholder="Enter your name"
          />
        </div>

        {/* Odometer Reading */}
        <div className="space-y-2">
          <Label htmlFor="odometer">Odometer Reading (miles) *</Label>
          <div className="relative">
            <Gauge className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="odometer"
              type="number"
              min="0"
              required
              value={formData.odometer_reading}
              onChange={(e) => setFormData({ ...formData, odometer_reading: parseInt(e.target.value) })}
              className="pl-10"
              placeholder="12345"
            />
          </div>
        </div>

        {/* Fuel Level */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Fuel Level *</Label>
            <Badge variant="outline">
              <Fuel className="w-3 h-3 mr-1" />
              {fuelLevel[0]}%
            </Badge>
          </div>
          <div className="space-y-2">
            <Slider
              value={fuelLevel}
              onValueChange={setFuelLevel}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Empty</span>
              <span>1/4</span>
              <span>1/2</span>
              <span>3/4</span>
              <span>Full</span>
            </div>
          </div>
          
          {/* Visual Fuel Tank */}
          <div className="relative h-12 w-full rounded-lg border-2 border-border bg-muted/30 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                fuelLevel[0] <= 25 
                  ? 'bg-destructive' 
                  : fuelLevel[0] <= 50 
                  ? 'bg-warning' 
                  : 'bg-success'
              }`}
              style={{ width: `${fuelLevel[0]}%` }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Fuel className={`h-6 w-6 ${
                  fuelLevel[0] <= 25 
                    ? 'text-destructive-foreground' 
                    : 'text-foreground/50'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Condition Assessments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="exterior">Exterior Condition *</Label>
            <Select
              value={formData.exterior_condition}
              onValueChange={(value) => setFormData({ ...formData, exterior_condition: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interior">Interior Condition *</Label>
            <Select
              value={formData.interior_condition}
              onValueChange={(value) => setFormData({ ...formData, interior_condition: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tires">Tire Condition *</Label>
            <Select
              value={formData.tire_condition}
              onValueChange={(value) => setFormData({ ...formData, tire_condition: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Condition Summary */}
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="text-sm font-medium mb-3">Condition Summary</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Exterior:</span>
              {getConditionBadge(formData.exterior_condition)}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Interior:</span>
              {getConditionBadge(formData.interior_condition)}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Tires:</span>
              {getConditionBadge(formData.tire_condition)}
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="space-y-4">
          <InspectionPhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={8}
          />
          
          {photos.filter(p => p.status === 'uploaded').length > 0 && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowPhotoGallery(true)}
              className="w-full"
            >
              <Images className="w-4 h-4 mr-2" />
              View All Photos ({photos.filter(p => p.status === 'uploaded').length})
            </Button>
          )}
        </div>

        <InspectionPhotoGallery
          open={showPhotoGallery}
          onOpenChange={setShowPhotoGallery}
          photos={photos.filter(p => p.status === 'uploaded').map(p => ({
            id: p.id,
            url: p.url,
            type: p.type,
          }))}
          inspectionType={inspectionType}
          vehicleName={vehicle?.name}
        />

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any damage, scratches, or issues to note..."
            className="h-24"
          />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full btn-premium">
          {loading ? "Saving Inspection..." : "Complete Inspection"}
        </Button>
      </form>
    </Card>
    </>
  );
};
