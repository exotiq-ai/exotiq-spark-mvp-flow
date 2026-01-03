import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTeam } from "@/contexts/TeamContext";

interface LocationBadgeProps {
  locationId?: string | null;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Displays a badge with the location name for a given location ID.
 * Falls back to "Unknown Location" if not found.
 */
export const LocationBadge = ({ 
  locationId, 
  showIcon = true, 
  size = "sm",
  className 
}: LocationBadgeProps) => {
  const { locations } = useTeam();
  
  if (!locationId) return null;
  
  const location = locations.find(l => l.id === locationId);
  if (!location) return null;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-normal",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
    >
      {showIcon && <MapPin className={cn("mr-1", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
      {location.name}
    </Badge>
  );
};

interface LocationContextBannerProps {
  className?: string;
}

/**
 * Shows a subtle banner indicating the current location filter context.
 * Only visible when a specific location is selected (not "All Locations").
 */
export const LocationContextBanner = ({ className }: LocationContextBannerProps) => {
  const { selectedLocationId, currentLocation, locations } = useTeam();
  
  const isAllLocations = selectedLocationId === 'all';
  
  // Don't show banner if viewing all locations or only one location exists
  if (isAllLocations || locations.length <= 1) return null;
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg text-sm",
      className
    )}>
      <MapPin className="h-3.5 w-3.5 text-primary" />
      <span className="text-muted-foreground">Showing data for</span>
      <span className="font-medium text-foreground">{currentLocation?.name}</span>
    </div>
  );
};
