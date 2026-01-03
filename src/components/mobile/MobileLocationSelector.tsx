import { useState } from "react";
import { MapPin, ChevronRight, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MobileLocationSelectorProps {
  onAddLocation?: () => void;
}

export const MobileLocationSelector = ({ onAddLocation }: MobileLocationSelectorProps) => {
  const [open, setOpen] = useState(false);
  const {
    locations,
    selectedLocationId,
    switchLocation,
    canAccessAllLocations,
    canAccessLocation,
    isOwner,
    loading,
  } = useTeam();

  // Filter locations user can access
  const accessibleLocations = locations.filter((l) => canAccessLocation(l.id));

  // Get display name for current selection
  const getDisplayName = () => {
    if (selectedLocationId === "all") {
      return `All Locations (${accessibleLocations.length})`;
    }
    const location = locations.find((l) => l.id === selectedLocationId);
    return location?.name || "Select Location";
  };

  const handleLocationSelect = (locationId: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    switchLocation(locationId);
    setOpen(false);
  };

  // Don't show if loading or no locations
  if (loading || locations.length === 0) {
    return null;
  }

  // If only one location and user can't access all, just show static display
  if (accessibleLocations.length === 1 && !canAccessAllLocations) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/40">
        <div className="w-10 h-10 rounded-xl bg-background shadow-sm flex items-center justify-center">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">Current Location</p>
          <p className="font-medium text-sm">{accessibleLocations[0].name}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Location Trigger Button */}
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 active:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Current Location</p>
            <p className="font-medium text-sm truncate max-w-[180px]">{getDisplayName()}</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </motion.button>

      {/* Location Selection Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8 pt-2 px-4">
          {/* Drag Handle */}
          <div className="flex justify-center py-2 mb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <SheetHeader className="text-left pb-4">
            <SheetTitle className="text-base font-semibold">Switch Location</SheetTitle>
          </SheetHeader>

          <div className="space-y-2">
            {/* All Locations option */}
            {canAccessAllLocations && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0, type: "spring", stiffness: 300, damping: 25 }}
                onClick={() => handleLocationSelect("all")}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-2xl transition-colors",
                  selectedLocationId === "all"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/40 active:bg-muted"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      selectedLocationId === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background shadow-sm"
                    )}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">All Locations</p>
                    <p className="text-xs text-muted-foreground">
                      {accessibleLocations.length} locations
                    </p>
                  </div>
                </div>
                {selectedLocationId === "all" && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </motion.button>
            )}

            {/* Location List */}
            {accessibleLocations.map((location, index) => (
              <motion.button
                key={location.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: (canAccessAllLocations ? 1 : 0 + index) * 0.05,
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
                onClick={() => handleLocationSelect(location.id)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-2xl transition-colors",
                  selectedLocationId === location.id
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/40 active:bg-muted"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      selectedLocationId === location.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background shadow-sm"
                    )}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{location.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {location.city}
                      {location.state ? `, ${location.state}` : ""}
                      {location.is_default && " • Default"}
                    </p>
                  </div>
                </div>
                {selectedLocationId === location.id && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </motion.button>
            ))}

            {/* Add Location option - only for owners */}
            {isOwner && onAddLocation && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={() => {
                  setOpen(false);
                  onAddLocation();
                }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-primary active:bg-primary/10 transition-colors mt-2"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-medium">+</span>
                </div>
                <span className="font-medium text-sm">Add New Location</span>
              </motion.button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
