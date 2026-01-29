import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Image,
  Upload,
  ListChecks,
  Car,
  Star,
  AlertTriangle,
  Camera,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotoHubStats, useVehiclePhotos } from '@/hooks/useVehiclePhotos';
import { usePhotoReviewQueue } from '@/hooks/usePhotoReviewQueue';
import { toast } from 'sonner';
import { BulkUploadModal } from './BulkUploadModal';
import { PhotoReviewQueue } from './PhotoReviewQueue';
import { VehiclePhotoManager } from './VehiclePhotoManager';
import { AddVehicleFromPhotoWizard } from './AddVehicleFromPhotoWizard';
import { EmptyState } from '@/components/common/EmptyState';

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

interface PhotoHubTabProps {
  vehicles: Vehicle[];
  loading?: boolean;
}

export const PhotoHubTab = ({ vehicles, loading: vehiclesLoading }: PhotoHubTabProps) => {
  const { stats, loading: statsLoading, refetch: refetchStats } = usePhotoHubStats();
  const { photoCountByVehicle, error: photosError, refetch: refetchPhotos } = useVehiclePhotos({ realtime: false });
  const { queueCount, error: queueError, refetch: refetchQueue } = usePhotoReviewQueue();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [uploadForVehicle, setUploadForVehicle] = useState<string | null>(null);
  const [addVehicleWizardOpen, setAddVehicleWizardOpen] = useState(false);
  const previousQueueCountRef = useRef<number>(queueCount);

  const loading = vehiclesLoading || statsLoading;
  const hasError = photosError || queueError;

  // Track previous queue count for success message
  useEffect(() => {
    if (!showReviewQueue) {
      previousQueueCountRef.current = queueCount;
    }
  }, [queueCount, showReviewQueue]);

  // Handle returning from review queue with stats refresh
  const handleBackFromReview = useCallback(() => {
    const hadItems = previousQueueCountRef.current > 0;
    
    setShowReviewQueue(false);
    
    // Refresh all data
    refetchStats?.();
    refetchPhotos?.();
    refetchQueue?.();
    
    // Show success toast if queue was cleared
    if (hadItems && queueCount === 0) {
      toast.success('All photos reviewed!', {
        description: 'Great job clearing the queue.',
      });
    }
  }, [queueCount, refetchStats, refetchPhotos, refetchQueue]);

  // Handle error state
  if (hasError && !loading) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive">Failed to load Photo Hub</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {photosError || queueError || 'Unable to connect to the database'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                refetchPhotos?.();
                refetchQueue?.();
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showReviewQueue) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={handleBackFromReview}
          className="mb-2"
        >
          ← Back to Photo Hub
        </Button>
        <PhotoReviewQueue vehicles={vehicles} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Photo Hub
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage vehicle photos with AI-powered analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {queueCount > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setShowReviewQueue(true)}
              className="relative"
            >
              <ListChecks className="h-4 w-4 mr-2" />
              Review Queue
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1"
              >
                {queueCount}
              </Badge>
            </Button>
          )}
          <Button variant="outline" onClick={() => setAddVehicleWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Vehicle
          </Button>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Photos"
          value={stats.totalPhotos}
          icon={Image}
          loading={loading}
        />
        <StatCard
          title="Vehicles with Photos"
          value={stats.vehiclesWithPhotos}
          subtitle={`${stats.vehiclesWithPhotos} of ${vehicles.length} vehicles`}
          icon={Car}
          loading={loading}
          highlight={stats.vehiclesWithPhotos === vehicles.length}
        />
        <StatCard
          title="Hero Photos"
          value={stats.heroPhotos}
          subtitle={stats.heroPhotos === vehicles.length ? 'All set!' : `${vehicles.length - stats.heroPhotos} missing`}
          icon={Star}
          loading={loading}
          warning={stats.heroPhotos < vehicles.length}
        />
        <StatCard
          title="Pending Review"
          value={stats.unmatchedPhotos}
          icon={ListChecks}
          loading={loading}
          onClick={() => stats.unmatchedPhotos > 0 && setShowReviewQueue(true)}
          clickable={stats.unmatchedPhotos > 0}
        />
      </div>

      {/* Quick Actions / Empty State */}
      {stats.totalPhotos === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12">
          <EmptyState
            icon={Camera}
            title="No photos yet"
            description="Upload vehicle photos to get started. AI will automatically analyze and categorize each photo."
            action={{
              label: "Upload Photos",
              onClick: () => setUploadModalOpen(true),
            }}
          />
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Vehicles Needing Photos */}
          {stats.vehiclesWithoutPhotos > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Vehicles Missing Photos
                </CardTitle>
                <CardDescription>
                  {stats.vehiclesWithoutPhotos} vehicle{stats.vehiclesWithoutPhotos !== 1 ? 's' : ''} without any photos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {vehicles
                    .filter(v => !photoCountByVehicle[v.id] || photoCountByVehicle[v.id] === 0)
                    .slice(0, 3)
                    .map(vehicle => (
                      <div 
                        key={vehicle.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{vehicle.name}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setUploadForVehicle(vehicle.id);
                            setUploadModalOpen(true);
                          }}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Photo Quality
              </CardTitle>
              <CardDescription>
                Average quality score across all photos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20">
                  <svg className="h-20 w-20 -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      className="fill-none stroke-muted stroke-[8]"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      className={cn(
                        'fill-none stroke-[8] transition-all duration-500',
                        stats.averageQualityScore >= 80 
                          ? 'stroke-success' 
                          : stats.averageQualityScore >= 50 
                            ? 'stroke-amber-500' 
                            : 'stroke-destructive'
                      )}
                      strokeLinecap="round"
                      strokeDasharray={`${(stats.averageQualityScore / 100) * 226} 226`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{stats.averageQualityScore}%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {stats.averageQualityScore >= 80 
                      ? 'Excellent photo quality across your fleet'
                      : stats.averageQualityScore >= 50
                        ? 'Good quality, some photos could be improved'
                        : 'Consider retaking some low-quality photos'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vehicle Photo Browser */}
      {stats.totalPhotos > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              Photos by Vehicle
            </CardTitle>
            <CardDescription>
              Click a vehicle to manage its photos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {vehicles.map(vehicle => {
              const count = photoCountByVehicle[vehicle.id] || 0;
              const isExpanded = expandedVehicle === vehicle.id;
              
              return (
                <Collapsible 
                  key={vehicle.id} 
                  open={isExpanded} 
                  onOpenChange={(open) => setExpandedVehicle(open ? vehicle.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between hover:bg-muted/50 h-auto py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-xs',
                            count >= 8 && 'border-success/50 text-success',
                            count >= 4 && count < 8 && 'border-amber-500/50 text-amber-600',
                            count < 4 && 'border-muted-foreground/30 text-muted-foreground'
                          )}
                        >
                          <Camera className="h-3 w-3 mr-1" />
                          {count}/11
                        </Badge>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 pb-4 px-2">
                    <VehiclePhotoManager
                      vehicleId={vehicle.id}
                      vehicleName={vehicle.name}
                      onUploadClick={() => {
                        setUploadForVehicle(vehicle.id);
                        setUploadModalOpen(true);
                      }}
                      compact
                    />
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={uploadModalOpen}
        onOpenChange={(open) => {
          setUploadModalOpen(open);
          if (!open) setUploadForVehicle(null);
        }}
        vehicles={vehicles}
        preSelectedVehicleId={uploadForVehicle || undefined}
        onComplete={() => {
          // Stats will auto-refresh
        }}
      />

      {/* Add Vehicle from Photo Wizard */}
      <AddVehicleFromPhotoWizard
        open={addVehicleWizardOpen}
        onOpenChange={setAddVehicleWizardOpen}
        onComplete={() => {
          refetchStats?.();
          refetchPhotos?.();
        }}
      />
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  highlight?: boolean;
  warning?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  highlight,
  warning,
  onClick,
  clickable,
}: StatCardProps) => {
  return (
    <motion.div whileHover={clickable ? { scale: 1.02 } : undefined}>
      <Card 
        className={cn(
          'transition-colors',
          clickable && 'cursor-pointer hover:border-primary/50',
          highlight && 'border-success/50 bg-success/5',
          warning && 'border-amber-500/30 bg-amber-500/5'
        )}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className={cn(
                  'text-2xl font-bold',
                  highlight && 'text-success',
                  warning && 'text-amber-600'
                )}>
                  {value}
                </p>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className={cn(
              'p-2 rounded-lg',
              highlight ? 'bg-success/10' : warning ? 'bg-amber-500/10' : 'bg-primary/10'
            )}>
              <Icon className={cn(
                'h-5 w-5',
                highlight ? 'text-success' : warning ? 'text-amber-500' : 'text-primary'
              )} />
            </div>
          </div>
          {clickable && (
            <div className="flex items-center gap-1 mt-2 text-xs text-primary">
              <span>View queue</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
