import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpsStatus, OPS_STATUS_CONFIG } from '@/hooks/useVehicleOpsStatus';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'name' | 'rate' | 'status' | 'updated';

export interface FleetFiltersState {
  search: string;
  bookingStatus: string[];
  opsStatus: OpsStatus[];
  sortBy: SortOption;
  sortDesc: boolean;
  hideRetired: boolean;
}

interface FleetFiltersProps {
  filters: FleetFiltersState;
  onFiltersChange: (filters: FleetFiltersState) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  vehicleCount: number;
  filteredCount: number;
  isOpsMode?: boolean;
}

const BOOKING_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'booked', label: 'Booked' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'rate', label: 'Daily Rate' },
  { value: 'status', label: 'Status' },
  { value: 'updated', label: 'Last Updated' },
];

export const FleetFilters = ({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  vehicleCount,
  filteredCount,
  isOpsMode = false,
}: FleetFiltersProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = 
    filters.bookingStatus.length + 
    filters.opsStatus.length + 
    (filters.search ? 1 : 0);

  const updateFilter = <K extends keyof FleetFiltersState>(
    key: K,
    value: FleetFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleBookingStatus = (status: string) => {
    const current = filters.bookingStatus;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter('bookingStatus', updated);
  };

  const toggleOpsStatus = (status: OpsStatus) => {
    const current = filters.opsStatus;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter('opsStatus', updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      bookingStatus: [],
      opsStatus: [],
      sortBy: 'name',
      sortDesc: false,
    });
  };

  return (
    <div className="space-y-3">
      {/* Main Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9 h-10"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => updateFilter('search', '')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter Popover */}
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="default"
              className={cn(
                'h-10',
                activeFilterCount > 0 && 'border-primary'
              )}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-5 px-1.5 text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={clearFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
            
            <ScrollArea className="max-h-[400px]">
              <div className="p-4 space-y-6">
                {/* Booking Status */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">Booking Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {BOOKING_STATUS_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                          filters.bookingStatus.includes(option.value)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <Checkbox
                          checked={filters.bookingStatus.includes(option.value)}
                          onCheckedChange={() => toggleBookingStatus(option.value)}
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Ops Status */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">Ops Status</Label>
                  <div className="space-y-2">
                    {(Object.keys(OPS_STATUS_CONFIG) as OpsStatus[]).map((status) => {
                      const config = OPS_STATUS_CONFIG[status];
                      return (
                        <label
                          key={status}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                            filters.opsStatus.includes(status)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <Checkbox
                            checked={filters.opsStatus.includes(status)}
                            onCheckedChange={() => toggleOpsStatus(status)}
                          />
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              config.bgColor,
                              config.borderColor,
                              config.color
                            )}
                          >
                            {config.label}
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select
          value={filters.sortBy}
          onValueChange={(value) => updateFilter('sortBy', value as SortOption)}
        >
          <SelectTrigger className="w-[140px] h-10">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Toggle - Desktop Only */}
        {!isOpsMode && (
          <div className="hidden md:flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onViewModeChange('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onViewModeChange('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Active Filters & Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCount} of {vehicleCount} vehicles
        </p>

        {/* Active filter badges */}
        {(filters.bookingStatus.length > 0 || filters.opsStatus.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {filters.bookingStatus.map((status) => (
              <Badge
                key={status}
                variant="secondary"
                className="pl-2 pr-1 gap-1 capitalize"
              >
                {status}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => toggleBookingStatus(status)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.opsStatus.map((status) => {
              const config = OPS_STATUS_CONFIG[status];
              return (
                <Badge
                  key={status}
                  variant="outline"
                  className={cn(
                    'pl-2 pr-1 gap-1',
                    config.bgColor,
                    config.borderColor,
                    config.color
                  )}
                >
                  {config.label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-transparent"
                    onClick={() => toggleOpsStatus(status)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
