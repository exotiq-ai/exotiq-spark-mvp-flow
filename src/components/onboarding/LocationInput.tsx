import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';
import { MapPin, Plus, X, Star, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocationData {
  id: string;
  name: string;
  address: AddressData;
  isPrimary: boolean;
}

interface LocationInputProps {
  value: LocationData[];
  onChange: (locations: LocationData[]) => void;
  className?: string;
}

export function LocationInput({ value, onChange, className }: LocationInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState<AddressData | null>(null);

  const handleAddLocation = () => {
    if (!newLocationName.trim() || !newLocationAddress) return;

    const newLocation: LocationData = {
      id: crypto.randomUUID(),
      name: newLocationName.trim(),
      address: newLocationAddress,
      isPrimary: value.length === 0, // First location is primary
    };

    onChange([...value, newLocation]);
    setNewLocationName('');
    setNewLocationAddress(null);
    setIsAdding(false);
  };

  const handleRemoveLocation = (id: string) => {
    const updated = value.filter(loc => loc.id !== id);
    
    // If we removed the primary, make the first one primary
    if (updated.length > 0 && !updated.some(loc => loc.isPrimary)) {
      updated[0].isPrimary = true;
    }
    
    onChange(updated);
  };

  const handleSetPrimary = (id: string) => {
    const updated = value.map(loc => ({
      ...loc,
      isPrimary: loc.id === id
    }));
    onChange(updated);
  };

  const canAdd = newLocationName.trim() && newLocationAddress?.formatted;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          Your Locations *
        </Label>
        <span className="text-xs text-muted-foreground">
          {value.length} location{value.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Location List */}
      <div className="space-y-3">
        {value.map((location) => (
          <Card 
            key={location.id} 
            className={cn(
              "p-4 transition-all",
              location.isPrimary && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{location.name}</span>
                    {location.isPrimary && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {location.address.formatted}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {!location.isPrimary && value.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetPrimary(location.id)}
                    className="text-xs"
                  >
                    Set Primary
                  </Button>
                )}
                {value.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveLocation(location.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Location Form */}
      {isAdding ? (
        <Card className="p-4 border-dashed">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="locationName">Location Name</Label>
              <Input
                id="locationName"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g., Miami Beach Office, Downtown Showroom"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <AddressAutocomplete
                value={newLocationAddress}
                onChange={setNewLocationAddress}
                placeholder="Search for address..."
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewLocationName('');
                  setNewLocationAddress(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddLocation}
                disabled={!canAdd}
              >
                Add Location
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {value.length === 0 ? 'Your First' : 'Another'} Location
        </Button>
      )}

      {value.length === 0 && (
        <p className="text-sm text-destructive">
          At least one location is required
        </p>
      )}
    </div>
  );
}