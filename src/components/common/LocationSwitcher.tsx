import { MapPin, ChevronDown, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";

interface LocationSwitcherProps {
  onAddLocation?: () => void;
}

export const LocationSwitcher = ({ onAddLocation }: LocationSwitcherProps) => {
  const { 
    locations, 
    selectedLocationId, 
    switchLocation, 
    canAccessAllLocations,
    canAccessLocation,
    isOwner,
    loading 
  } = useTeam();

  // Filter locations user can access
  const accessibleLocations = locations.filter(l => canAccessLocation(l.id));

  // Get display name for current selection
  const getDisplayName = () => {
    if (selectedLocationId === 'all') {
      return `All Locations (${accessibleLocations.length})`;
    }
    const location = locations.find(l => l.id === selectedLocationId);
    return location?.name || 'Select Location';
  };

  // Don't show if loading or no locations
  if (loading || locations.length === 0) {
    return null;
  }

  // If only one location and user can't access all, don't show dropdown
  if (accessibleLocations.length === 1 && !canAccessAllLocations) {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>{accessibleLocations[0].name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="hidden md:flex items-center gap-2 px-3 h-9 text-sm font-medium"
        >
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[150px] truncate">{getDisplayName()}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {/* All Locations option - only for owners/admins */}
        {canAccessAllLocations && (
          <>
            <DropdownMenuItem 
              onClick={() => switchLocation('all')}
              className="flex items-center justify-between"
            >
              <span>All Locations ({accessibleLocations.length})</span>
              {selectedLocationId === 'all' && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Location list */}
        {accessibleLocations.map((location) => (
          <DropdownMenuItem
            key={location.id}
            onClick={() => switchLocation(location.id)}
            className={cn(
              "flex items-center justify-between",
              location.is_default && "font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[150px]">{location.name}</span>
              {location.is_default && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  Default
                </span>
              )}
            </div>
            {selectedLocationId === location.id && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        {/* Add Location option - only for owners */}
        {isOwner && onAddLocation && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAddLocation} className="text-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
