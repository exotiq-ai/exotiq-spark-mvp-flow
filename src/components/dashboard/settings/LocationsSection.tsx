import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeam, Location } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Star, Phone, Mail, Clock } from "lucide-react";
import { AddLocationDialog } from "@/components/dialogs/AddLocationDialog";
import { EditLocationDialog } from "@/components/dialogs/EditLocationDialog";
import { cn } from "@/lib/utils";

export const LocationsSection = () => {
  const { locations, currentTeam, refreshTeam, isOwner } = useTeam();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const handleSetDefault = async (locationId: string) => {
    if (!currentTeam) return;
    
    setSettingDefault(locationId);
    try {
      // First, remove default from all locations
      await supabase
        .from('locations')
        .update({ is_default: false })
        .eq('team_id', currentTeam.id);

      // Then set the new default
      const { error } = await supabase
        .from('locations')
        .update({ is_default: true })
        .eq('id', locationId);

      if (error) throw error;

      toast("Default location updated", { description: "The default location has been changed." });

      await refreshTeam();
    } catch (error) {
      console.error('Error setting default location:', error);
      toast.error("Error", { description: "Failed to update default location." });
    } finally {
      setSettingDefault(null);
    }
  };

  const handleLocationAdded = async () => {
    setAddDialogOpen(false);
    await refreshTeam();
  };

  const handleLocationUpdated = async () => {
    setEditingLocation(null);
    await refreshTeam();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Locations
            </CardTitle>
            <CardDescription className="mt-1.5">
              Manage your business locations. Each location can have its own vehicles, staff, and bookings.
            </CardDescription>
          </div>
          {isOwner && (
            <Button onClick={() => setAddDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No locations configured yet.</p>
              {isOwner && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Location
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {locations.map((location) => (
                <div 
                  key={location.id} 
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 border rounded-lg transition-colors",
                    location.is_active 
                      ? "hover:bg-muted/50" 
                      : "opacity-60 bg-muted/30"
                  )}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{location.name}</h4>
                      {location.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                      {!location.is_active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    
                    {(location.address || location.city) && (
                      <p className="text-sm text-muted-foreground">
                        {[location.address, location.city, location.state, location.zip_code]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {location.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {location.phone}
                        </span>
                      )}
                      {location.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[180px]">{location.email}</span>
                        </span>
                      )}
                      {location.timezone && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {location.timezone}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOwner && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!location.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(location.id)}
                          disabled={settingDefault === location.id}
                          className="h-8 text-xs"
                        >
                          {settingDefault === location.id ? 'Setting...' : 'Set Default'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLocation(location)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Location Dialog */}
      <AddLocationDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleLocationAdded}
      />

      {/* Edit Location Dialog */}
      {editingLocation && (
        <EditLocationDialog
          open={!!editingLocation}
          onOpenChange={(open) => !open && setEditingLocation(null)}
          location={editingLocation}
          onSuccess={handleLocationUpdated}
        />
      )}
    </div>
  );
};
