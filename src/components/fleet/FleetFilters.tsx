import { useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Search,
  Filter,
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpsStatus, OPS_STATUS_CONFIG } from '@/hooks/useVehicleOpsStatus';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'name' | 'rate' | 'status' | 'updated';

export interface FleetFiltersState {
  search: string;
  bookingStatus: string[];
  opsStatus: OpsStatus[];
  locations: string[];
  makes: string[];
  ownership: string[];
  yearRange: [number, number] | null;
  rateRange: [number, number] | null;
  mileageRange: [number, number] | null;
  hasPhotos: boolean;
  needsAttention: boolean;
  sortBy: SortOption;
  sortDesc: boolean;
  hideRetired: boolean;
}

export interface FleetFacets {
  locations: string[];
  makes: string[];
  ownership: string[];
  yearBounds: [number, number] | null;
  rateBounds: [number, number] | null;
  mileageBounds: [number, number] | null;
}

export const DEFAULT_FLEET_FILTERS: FleetFiltersState = {
  search: '',
  bookingStatus: [],
  opsStatus: [],
  locations: [],
  makes: [],
  ownership: [],
  yearRange: null,
  rateRange: null,
  mileageRange: null,
  hasPhotos: false,
  needsAttention: false,
  sortBy: 'name',
  sortDesc: false,
  hideRetired: true,
};

interface FleetFiltersProps {
  filters: FleetFiltersState;
  onFiltersChange: (filters: FleetFiltersState) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  vehicleCount: number;
  filteredCount: number;
  facets: FleetFacets;
  isOpsMode?: boolean;
}

const BOOKING_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'booked', label: 'Booked' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const OWNERSHIP_LABELS: Record<string, string> = {
  owned: 'Owned',
  partnered: 'Partner',
  consignment: 'Consignment',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'rate', label: 'Daily Rate' },
  { value: 'status', label: 'Status' },
  { value: 'updated', label: 'Last Updated' },
];

const formatMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;

const formatMiles = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k mi` : `${n} mi`;

const arraysEqual = (a: any[], b: any[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const rangeEqual = (
  a: [number, number] | null,
  b: [number, number] | null
) => {
  if (!a || !b) return a === b;
  return a[0] === b[0] && a[1] === b[1];
};

interface SectionHeaderProps {
  title: string;
  activeCount?: number;
  onClear?: () => void;
}
const SectionHeader = ({ title, activeCount = 0, onClear }: SectionHeaderProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Label>
      {activeCount > 0 && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
          {activeCount}
        </Badge>
      )}
    </div>
    {activeCount > 0 && onClear && (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={onClear}
      >
        Clear
      </Button>
    )}
  </div>
);

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}
const Chip = ({ active, onClick, children, className }: ChipProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-background hover:bg-muted hover:border-muted-foreground/30',
      className
    )}
  >
    {active && <Check className="h-3 w-3" />}
    {children}
  </button>
);

export const FleetFilters = ({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  vehicleCount,
  filteredCount,
  facets,
  isOpsMode = false,
}: FleetFiltersProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [makeSearch, setMakeSearch] = useState('');

  const activeFilterCount =
    filters.bookingStatus.length +
    filters.opsStatus.length +
    filters.locations.length +
    filters.makes.length +
    filters.ownership.length +
    (filters.yearRange ? 1 : 0) +
    (filters.rateRange ? 1 : 0) +
    (filters.mileageRange ? 1 : 0) +
    (filters.hasPhotos ? 1 : 0) +
    (filters.needsAttention ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (!filters.hideRetired ? 1 : 0);

  const updateFilter = <K extends keyof FleetFiltersState>(
    key: K,
    value: FleetFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayValue = <K extends keyof FleetFiltersState>(
    key: K,
    value: any
  ) => {
    const current = filters[key] as any[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated as any });
  };

  const clearFilters = () => {
    onFiltersChange({
      ...DEFAULT_FLEET_FILTERS,
      sortBy: filters.sortBy,
      sortDesc: filters.sortDesc,
    });
  };

  const filteredMakes = useMemo(() => {
    const q = makeSearch.trim().toLowerCase();
    if (!q) return facets.makes;
    return facets.makes.filter((m) => m.toLowerCase().includes(q));
  }, [facets.makes, makeSearch]);

  return (
    <div className="space-y-3 w-full">
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
              className={cn('h-10', activeFilterCount > 0 && 'border-primary')}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[26rem] p-0 max-h-[80vh] flex flex-col z-[60]"
            align="start"
            sideOffset={8}
          >
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur sticky top-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground text-sm">Filters</h4>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {activeFilterCount} active
                  </Badge>
                )}
              </div>
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

            {/* Scrollable body */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-5">
                {/* Quick toggles */}
                <div className="space-y-2">
                  <SectionHeader title="Quick filters" />
                  <div className="space-y-2">
                    <label className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">Needs attention</p>
                        <p className="text-[11px] text-muted-foreground">
                          Pending inspection, dirty, or damage reported
                        </p>
                      </div>
                      <Switch
                        checked={filters.needsAttention}
                        onCheckedChange={(c) => updateFilter('needsAttention', !!c)}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">Has photos</p>
                        <p className="text-[11px] text-muted-foreground">
                          Hide vehicles missing a hero image
                        </p>
                      </div>
                      <Switch
                        checked={filters.hasPhotos}
                        onCheckedChange={(c) => updateFilter('hasPhotos', !!c)}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">Show retired</p>
                        <p className="text-[11px] text-muted-foreground">
                          Include vehicles marked as retired
                        </p>
                      </div>
                      <Switch
                        checked={!filters.hideRetired}
                        onCheckedChange={(c) => updateFilter('hideRetired', !c)}
                      />
                    </label>
                  </div>
                </div>

                <Separator />

                {/* Booking Status */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Booking status"
                    activeCount={filters.bookingStatus.length}
                    onClear={() => updateFilter('bookingStatus', [])}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {BOOKING_STATUS_OPTIONS.map((option) => (
                      <Chip
                        key={option.value}
                        active={filters.bookingStatus.includes(option.value)}
                        onClick={() => toggleArrayValue('bookingStatus', option.value)}
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Ops Status */}
                <div className="space-y-2">
                  <SectionHeader
                    title="Ops status"
                    activeCount={filters.opsStatus.length}
                    onClear={() => updateFilter('opsStatus', [])}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(OPS_STATUS_CONFIG) as OpsStatus[]).map((status) => {
                      const config = OPS_STATUS_CONFIG[status];
                      const active = filters.opsStatus.includes(status);
                      return (
                        <Chip
                          key={status}
                          active={active}
                          onClick={() => toggleArrayValue('opsStatus', status)}
                        >
                          {config.label}
                        </Chip>
                      );
                    })}
                  </div>
                </div>

                {/* Location */}
                {facets.locations.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <SectionHeader
                        title="Location"
                        activeCount={filters.locations.length}
                        onClear={() => updateFilter('locations', [])}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {facets.locations.map((loc) => (
                          <Chip
                            key={loc}
                            active={filters.locations.includes(loc)}
                            onClick={() => toggleArrayValue('locations', loc)}
                          >
                            {loc}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Make */}
                {facets.makes.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <SectionHeader
                        title="Make"
                        activeCount={filters.makes.length}
                        onClear={() => updateFilter('makes', [])}
                      />
                      {facets.makes.length > 8 ? (
                        <Command className="border rounded-lg">
                          <CommandInput
                            placeholder="Search makes..."
                            value={makeSearch}
                            onValueChange={setMakeSearch}
                            className="h-9"
                          />
                          <CommandList className="max-h-[160px]">
                            <CommandEmpty>No makes found.</CommandEmpty>
                            <CommandGroup>
                              {filteredMakes.map((make) => {
                                const active = filters.makes.includes(make);
                                return (
                                  <CommandItem
                                    key={make}
                                    onSelect={() => toggleArrayValue('makes', make)}
                                    className="flex items-center justify-between cursor-pointer"
                                  >
                                    <span>{make}</span>
                                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {facets.makes.map((make) => (
                            <Chip
                              key={make}
                              active={filters.makes.includes(make)}
                              onClick={() => toggleArrayValue('makes', make)}
                            >
                              {make}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Year range */}
                {facets.yearBounds && facets.yearBounds[0] !== facets.yearBounds[1] && (
                  <>
                    <Separator />
                    <RangeSection
                      title="Model year"
                      bounds={facets.yearBounds}
                      value={filters.yearRange}
                      step={1}
                      format={(n) => String(n)}
                      onChange={(v) =>
                        updateFilter(
                          'yearRange',
                          rangeEqual(v, facets.yearBounds) ? null : v
                        )
                      }
                      onClear={() => updateFilter('yearRange', null)}
                    />
                  </>
                )}

                {/* Rate range */}
                {facets.rateBounds && facets.rateBounds[0] !== facets.rateBounds[1] && (
                  <>
                    <Separator />
                    <RangeSection
                      title="Daily rate"
                      bounds={facets.rateBounds}
                      value={filters.rateRange}
                      step={50}
                      format={formatMoney}
                      onChange={(v) =>
                        updateFilter(
                          'rateRange',
                          rangeEqual(v, facets.rateBounds) ? null : v
                        )
                      }
                      onClear={() => updateFilter('rateRange', null)}
                    />
                  </>
                )}

                {/* Mileage range */}
                {facets.mileageBounds && facets.mileageBounds[0] !== facets.mileageBounds[1] && (
                  <>
                    <Separator />
                    <RangeSection
                      title="Mileage"
                      bounds={facets.mileageBounds}
                      value={filters.mileageRange}
                      step={1000}
                      format={formatMiles}
                      onChange={(v) =>
                        updateFilter(
                          'mileageRange',
                          rangeEqual(v, facets.mileageBounds) ? null : v
                        )
                      }
                      onClear={() => updateFilter('mileageRange', null)}
                    />
                  </>
                )}

                {/* Ownership */}
                {facets.ownership.length > 1 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <SectionHeader
                        title="Ownership"
                        activeCount={filters.ownership.length}
                        onClear={() => updateFilter('ownership', [])}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {facets.ownership.map((o) => (
                          <Chip
                            key={o}
                            active={filters.ownership.includes(o)}
                            onClick={() => toggleArrayValue('ownership', o)}
                          >
                            {OWNERSHIP_LABELS[o] || o}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Sticky footer */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-background/95 backdrop-blur">
              <p className="text-xs text-muted-foreground">
                {filteredCount} of {vehicleCount} vehicles
              </p>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={clearFilters}
                  >
                    Reset
                  </Button>
                )}
                <Button size="sm" className="h-8" onClick={() => setFiltersOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
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

      {/* Count + Active Filter Chips */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCount} of {vehicleCount} vehicles
        </p>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.bookingStatus.map((status) => (
              <ActiveChip
                key={`bs-${status}`}
                label={status}
                onRemove={() => toggleArrayValue('bookingStatus', status)}
              />
            ))}
            {filters.opsStatus.map((status) => (
              <ActiveChip
                key={`ops-${status}`}
                label={OPS_STATUS_CONFIG[status]?.label || status}
                onRemove={() => toggleArrayValue('opsStatus', status)}
              />
            ))}
            {filters.locations.map((loc) => (
              <ActiveChip
                key={`loc-${loc}`}
                label={loc}
                onRemove={() => toggleArrayValue('locations', loc)}
              />
            ))}
            {filters.makes.map((m) => (
              <ActiveChip
                key={`mk-${m}`}
                label={m}
                onRemove={() => toggleArrayValue('makes', m)}
              />
            ))}
            {filters.ownership.map((o) => (
              <ActiveChip
                key={`own-${o}`}
                label={OWNERSHIP_LABELS[o] || o}
                onRemove={() => toggleArrayValue('ownership', o)}
              />
            ))}
            {filters.yearRange && (
              <ActiveChip
                label={`Year ${filters.yearRange[0]}–${filters.yearRange[1]}`}
                onRemove={() => updateFilter('yearRange', null)}
              />
            )}
            {filters.rateRange && (
              <ActiveChip
                label={`${formatMoney(filters.rateRange[0])}–${formatMoney(filters.rateRange[1])}/day`}
                onRemove={() => updateFilter('rateRange', null)}
              />
            )}
            {filters.mileageRange && (
              <ActiveChip
                label={`${formatMiles(filters.mileageRange[0])}–${formatMiles(filters.mileageRange[1])}`}
                onRemove={() => updateFilter('mileageRange', null)}
              />
            )}
            {filters.needsAttention && (
              <ActiveChip
                label="Needs attention"
                onRemove={() => updateFilter('needsAttention', false)}
              />
            )}
            {filters.hasPhotos && (
              <ActiveChip
                label="Has photos"
                onRemove={() => updateFilter('hasPhotos', false)}
              />
            )}
            {!filters.hideRetired && (
              <ActiveChip
                label="Includes retired"
                onRemove={() => updateFilter('hideRetired', true)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface RangeSectionProps {
  title: string;
  bounds: [number, number];
  value: [number, number] | null;
  step: number;
  format: (n: number) => string;
  onChange: (v: [number, number]) => void;
  onClear: () => void;
}
const RangeSection = ({
  title,
  bounds,
  value,
  step,
  format,
  onChange,
  onClear,
}: RangeSectionProps) => {
  const current = value ?? bounds;
  const active = value !== null;
  return (
    <div className="space-y-3">
      <SectionHeader
        title={title}
        activeCount={active ? 1 : 0}
        onClear={onClear}
      />
      <div className="px-1">
        <Slider
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={current}
          onValueChange={(v) => onChange([v[0], v[1]] as [number, number])}
          className="my-2"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums mt-1">
          <span>{format(current[0])}</span>
          <span>{format(current[1])}</span>
        </div>
      </div>
    </div>
  );
};

const ActiveChip = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => (
  <Badge
    variant="secondary"
    className="pl-2 pr-1 gap-1 capitalize font-normal"
  >
    {label}
    <Button
      variant="ghost"
      size="icon"
      className="h-4 w-4 ml-0.5 hover:bg-transparent"
      onClick={onRemove}
    >
      <X className="h-3 w-3" />
    </Button>
  </Badge>
);
