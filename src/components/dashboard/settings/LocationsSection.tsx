import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeam, Location } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Pencil, Star, Phone, Mail, Clock } from "lucide-react";
import { AddLocationDialog } from "@/components/dialogs/AddLocationDialog";
import { EditLocationDialog } from "@/components/dialogs/EditLocationDialog";

export const LocationsSection = () => {
  const { locations, currentTeam, refreshTeam, isOwner } = useTeam();
  const { toast } = useToast();
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

      toast({
        title: "Default location updated",
        description: "The default location has been changed.",
      });

      await refreshTeam();
    } catch (error) {
      console.error('Error setting default location:', error);
      toast({
        title: "Error",
        description: "Failed to update default location.",
        variant: "destructive",
      });
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Locations
            </CardTitle>
            <CardDescription>
              Manage your business locations. Each location can have its own vehicles, staff, and bookings.
            </CardDescription>
          </div>
          {isOwner && (
            <Button onClick={() => setAddDialogOpen(true)}>
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
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{location.name}</h4>
                      {location.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
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
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {location.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {location.phone}
                        </span>
                      )}
                      {location.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {location.email}
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

                  <div className="flex items-center gap-2">
                    {!location.is_default && isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(location.id)}
                        disabled={settingDefault === location.id}
                      >
                        {settingDefault === location.id ? 'Setting...' : 'Set as Default'}
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLocation(location)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
