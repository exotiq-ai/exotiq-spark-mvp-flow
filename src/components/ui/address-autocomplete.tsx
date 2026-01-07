import { useState, useRef, useCallback, useEffect } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const libraries: ("places")[] = ['places'];

export interface AddressData {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formatted: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: AddressData | null;
  onChange: (address: AddressData) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address...",
  required = false,
  className,
  disabled = false
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value?.formatted || '');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  // Sync input value with external value changes
  useEffect(() => {
    if (value?.formatted) {
      setInputValue(value.formatted);
    }
  }, [value?.formatted]);

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.address_components && place.geometry) {
        const addressData: AddressData = {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          formatted: place.formatted_address || '',
          lat: place.geometry.location?.lat(),
          lng: place.geometry.location?.lng(),
        };

        // Parse address components
        place.address_components.forEach(component => {
          const types = component.types;
          
          if (types.includes('street_number')) {
            addressData.street = component.long_name + ' ';
          }
          if (types.includes('route')) {
            addressData.street += component.long_name;
          }
          if (types.includes('locality')) {
            addressData.city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            addressData.state = component.short_name;
          }
          if (types.includes('postal_code')) {
            addressData.zip = component.long_name;
          }
          if (types.includes('country')) {
            addressData.country = component.long_name;
          }
        });

        setInputValue(addressData.formatted);
        onChange(addressData);
      }
    }
  }, [onChange]);

  // Fallback to manual input if API key is missing or load fails
  if (!apiKey || loadError) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange({
              street: e.target.value,
              city: '',
              state: '',
              zip: '',
              country: '',
              formatted: e.target.value,
            });
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn("pl-10", className)}
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative">
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        <Input
          value=""
          disabled
          placeholder="Loading..."
          className={cn("pl-10", className)}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ['address'],
          fields: ['address_components', 'formatted_address', 'geometry'],
        }}
      >
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn("pl-10", className)}
        />
      </Autocomplete>
    </div>
  );
}