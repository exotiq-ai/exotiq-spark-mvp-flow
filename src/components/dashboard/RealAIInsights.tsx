import { useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useFleetAIInsight } from '@/hooks/useFleetAIInsight';
import { useDemoAccount } from '@/hooks/useDemoAccount';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Wrench,
  Shield,
  Zap,
  Car
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

/**
 * Types of AI insights we can generate from fleet data
 */
export type InsightType = 
  | 'pricing' 
  | 'utilization' 
  | 'retention' 
  | 'maintenance' 
  | 'compliance'
  | 'revenue';

export type InsightPriority = 'high' | 'medium' | 'low';

export interface RealInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  impact: string;
  priority: InsightPriority;
  actionLabel: string;
  onAction?: () => void;
  confidence: number;
  vehicleId?: string;
  customerId?: string;
}

/**
 * Demo insights for the hello@exotiq.ai demo account only
 */
const DEMO_INSIGHTS: RealInsight[] = [
  {
    id: 'demo-pricing-1',
    type: 'pricing',
    title: 'Pricing Optimization Opportunity',
    description: 'McLaren 720S is underpriced by $75/day based on demand patterns',
    impact: '+$2,250/month',
    priority: 'high',
    actionLabel: 'Adjust pricing',
    confidence: 94
  },
  {
    id: 'demo-utilization-1',
    type: 'utilization',
    title: 'Fleet Utilization Alert',
    description: 'BMW i8 has been idle for 5 days. Consider promotional pricing',
    impact: '+$840/week',
    priority: 'medium',
    actionLabel: 'Create offer',
    confidence: 87
  },
  {
    id: 'demo-retention-1',
    type: 'retention',
    title: 'VIP Customer Retention Risk',
    description: '3 VIP customers haven\'t booked in 30+ days',
    impact: '-$1,200/month',
    priority: 'high',
    actionLabel: 'Reach out',
    confidence: 78
  }
];

const ICON_MAP: Record<InsightType, typeof Brain> = {
  pricing: TrendingUp,
  utilization: Car,
  retention: Users,
  maintenance: Wrench,
  compliance: Shield,
  revenue: Zap
};

const PRIORITY_STYLES: Record<InsightPriority, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-success/10 text-success border-success/20'
};

interface InsightCardProps {
  insight: RealInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  const Icon = ICON_MAP[insight.type] || Brain;
  
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-primary/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
            <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
            <div className="flex items-center gap-4 text-xs">
              <span className={`font-medium ${insight.impact.startsWith('+') ? 'text-success' : insight.impact.startsWith('-') ? 'text-destructive' : 'text-foreground'}`}>
                {insight.impact}
              </span>
              <span className="text-muted-foreground">
                {insight.confidence}% confidence
              </span>
            </div>
          </div>
        </div>
        <Badge className={PRIORITY_STYLES[insight.priority]}>
          {insight.priority}
        </Badge>
      </div>
      
      <Button 
        size="sm" 
        variant="outline" 
        className="w-full"
        onClick={insight.onAction}
      >
        {insight.actionLabel}
      </Button>
    </div>
  );
}

interface RealAIInsightsProps {
  /** Maximum number of insights to show */
  maxInsights?: number;
  /** Callback when an action is taken */
  onInsightAction?: (insight: RealInsight) => void;
}

/**
 * Displays real AI-generated insights based on actual fleet data
 * 
 * For demo accounts (hello@exotiq.ai): Shows demo insights when no real data
 * For production accounts: Shows empty state when no real data
 */
export function RealAIInsights({ 
  maxInsights = 5,
  onInsightAction 
}: RealAIInsightsProps) {
  const { vehicles, bookings, customers, loading } = useLocationFilteredFleet();
  const pricingInsight = useFleetAIInsight(vehicles, bookings);
  const isDemoAccount = useDemoAccount();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  
  // Track which insights have been persisted to avoid duplicates
  const persistedInsightsRef = useRef<Set<string>>(new Set());

  // Generate real insights from fleet data
  const insights = useMemo(() => {
    const result: RealInsight[] = [];
    
    // Skip if still loading
    if (loading) return [];

    // 1. Pricing insight from useFleetAIInsight hook
    if (pricingInsight) {
      result.push({
        id: `pricing-${pricingInsight.vehicleId}`,
        type: 'pricing',
        title: 'Pricing Optimization',
        description: `${pricingInsight.vehicleName} could support a ${pricingInsight.suggestedIncreasePercent}% rate increase. ${pricingInsight.reason}`,
        impact: `+${formatCurrency(pricingInsight.potentialMonthlyRevenue)}/month`,
        priority: pricingInsight.confidence >= 80 ? 'high' : 'medium',
        actionLabel: 'Review pricing',
        confidence: pricingInsight.confidence,
        vehicleId: pricingInsight.vehicleId
      });
    }

    // 2. Underutilized vehicles (< 20% utilization)
    const idleVehicles = vehicles.filter(v => 
      (v.utilization !== null && v.utilization !== undefined && v.utilization < 20) && 
      v.status === 'available'
    );
    
    if (idleVehicles.length > 0) {
      const topIdle = idleVehicles[0];
      const idleNames = idleVehicles.slice(0, 3).map(v => v.name || `${v.make} ${v.model}`).join(', ');
      
      result.push({
        id: 'utilization-low',
        type: 'utilization',
        title: 'Low Utilization Alert',
        description: idleVehicles.length === 1 
          ? `${topIdle.name || `${topIdle.make} ${topIdle.model}`} has only ${topIdle.utilization}% utilization this month`
          : `${idleVehicles.length} vehicles under 20% utilization: ${idleNames}`,
        impact: 'Revenue opportunity',
        priority: idleVehicles.length > 2 ? 'high' : 'medium',
        actionLabel: 'View vehicles',
        confidence: 85,
        vehicleId: topIdle.id
      });
    }

    // 3. VIP customer retention risk (no booking in 30+ days)
    if (customers.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const inactiveVIPs = customers.filter(customer => {
        if (customer.customer_status !== 'vip') return false;
        
        const customerBookings = bookings.filter(b => b.customer_id === customer.id);
        if (customerBookings.length === 0) return true;
        
        const lastBooking = customerBookings
          .filter(b => b.end_date)
          .sort((a, b) => new Date(b.end_date!).getTime() - new Date(a.end_date!).getTime())[0];
        
        return !lastBooking || new Date(lastBooking.end_date!) < thirtyDaysAgo;
      });

      if (inactiveVIPs.length > 0) {
        const avgLifetimeValue = inactiveVIPs.reduce((sum, c) => sum + (c.lifetime_value || 0), 0) / inactiveVIPs.length;
        
        result.push({
          id: 'retention-vip',
          type: 'retention',
          title: 'VIP Retention Risk',
          description: inactiveVIPs.length === 1
            ? `${inactiveVIPs[0].full_name} (VIP) hasn't booked in 30+ days`
            : `${inactiveVIPs.length} VIP customers haven't booked in 30+ days`,
          impact: avgLifetimeValue > 0 ? `${formatCurrency(Math.round(avgLifetimeValue))} avg LTV at risk` : 'Customer retention',
          priority: 'high',
          actionLabel: 'View customers',
          confidence: 80,
          customerId: inactiveVIPs[0]?.id
        });
      }
    }

    // 4. Vehicles needing maintenance soon
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const upcomingMaintenance = vehicles.filter(v => {
      // Check next_maintenance_date if it exists
      const maintenanceDate = (v as any).next_maintenance_date;
      if (!maintenanceDate) return false;
      const date = new Date(maintenanceDate);
      return date >= now && date <= sevenDaysFromNow;
    });

    if (upcomingMaintenance.length > 0) {
      result.push({
        id: 'maintenance-upcoming',
        type: 'maintenance',
        title: 'Maintenance Due Soon',
        description: upcomingMaintenance.length === 1
          ? `${upcomingMaintenance[0].name || `${upcomingMaintenance[0].make} ${upcomingMaintenance[0].model}`} needs service in the next 7 days`
          : `${upcomingMaintenance.length} vehicles need service in the next 7 days`,
        impact: 'Fleet readiness',
        priority: 'medium',
        actionLabel: 'Schedule service',
        confidence: 95,
        vehicleId: upcomingMaintenance[0].id
      });
    }

    // 5. High performers (> 80% utilization) - opportunity to raise rates
    const highPerformers = vehicles.filter(v => 
      v.utilization !== null && v.utilization !== undefined && v.utilization >= 80
    );

    if (highPerformers.length > 0 && !pricingInsight) {
      const topPerformer = highPerformers.sort((a, b) => (b.utilization || 0) - (a.utilization || 0))[0];
      
      result.push({
        id: 'revenue-high-performer',
        type: 'revenue',
        title: 'High Demand Vehicle',
        description: `${topPerformer.name || `${topPerformer.make} ${topPerformer.model}`} has ${topPerformer.utilization}% utilization - premium pricing may be supported`,
        impact: 'Revenue optimization',
        priority: 'medium',
        actionLabel: 'Review rates',
        confidence: 75,
        vehicleId: topPerformer.id
      });
    }

    return result;
  }, [vehicles, bookings, customers, loading, pricingInsight]);

  // Persist new insights to database
  useEffect(() => {
    const persistInsights = async () => {
      if (!user || !insights.length || isDemoAccount) return;
      
      const newInsights = insights.filter(
        insight => !persistedInsightsRef.current.has(insight.id)
      );
      
      if (newInsights.length === 0) return;
      
      // Calculate expiry (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      for (const insight of newInsights) {
        try {
          // Check if this insight already exists (by title + entity)
          const { data: existing } = await supabase
            .from('rari_insights')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', insight.title)
            .eq('is_dismissed', false)
            .maybeSingle();
          
          if (!existing) {
            // Map our insight type to database insight_type
            const insightTypeMap: Record<string, string> = {
              pricing: 'pricing',
              utilization: 'utilization',
              retention: 'customer',
              maintenance: 'maintenance',
              compliance: 'compliance',
              revenue: 'revenue'
            };
            
            await supabase
              .from('rari_insights')
              .insert({
                user_id: user.id,
                team_id: currentTeam?.id || null,
                insight_type: insightTypeMap[insight.type] || 'revenue',
                priority: insight.priority,
                title: insight.title,
                description: insight.description,
                related_entity_type: insight.vehicleId ? 'vehicle' : insight.customerId ? 'customer' : null,
                related_entity_id: insight.vehicleId || insight.customerId || null,
                metadata: { 
                  confidence: insight.confidence, 
                  impact: insight.impact,
                  internalId: insight.id
                },
                expires_at: expiresAt.toISOString(),
              });
          }
          
          persistedInsightsRef.current.add(insight.id);
        } catch (error) {
          console.error('Failed to persist insight:', error);
        }
      }
    };
    
    persistInsights();
  }, [insights, user, currentTeam, isDemoAccount]);

  // Add onAction handlers
  const insightsWithActions = insights.map(insight => ({
    ...insight,
    onAction: () => onInsightAction?.(insight)
  }));

  // Determine what to show
  const hasRealData = vehicles.length > 0 || customers.length > 0 || bookings.length > 0;
  const hasInsights = insightsWithActions.length > 0;

  // Loading state
  if (loading) {
    return (
      <Card className="card-premium p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">Analyzing fleet data...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  // Demo account with no real data - show demo insights
  if (!hasRealData && isDemoAccount) {
    return (
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">AI Insights</h3>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Zap className="w-3 h-3 mr-1" />
            Demo Mode
          </Badge>
        </div>
        <div className="space-y-4">
          {DEMO_INSIGHTS.slice(0, maxInsights).map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </Card>
    );
  }

  // Production account with no data - show empty state
  if (!hasRealData && !isDemoAccount) {
    return (
      <Card className="card-premium p-6">
        <EmptyState
          icon={<Brain className="h-12 w-12" />}
          title="No insights yet"
          description="AI insights will appear here once you add fleet data. Import vehicles, customers, or bookings to get started."
        />
      </Card>
    );
  }

  // Has data but no actionable insights
  if (!hasInsights) {
    return (
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">AI Insights</h3>
          <Badge className="bg-success/10 text-success border-success/20">
            All good
          </Badge>
        </div>
        <div className="text-center py-8">
          <Brain className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            No actionable insights right now. Your fleet is running smoothly!
          </p>
        </div>
      </Card>
    );
  }

  // Show real insights
  return (
    <Card className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">AI Insights</h3>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Zap className="w-3 h-3 mr-1" />
          {insightsWithActions.length} Active
        </Badge>
      </div>
      <div className="space-y-4">
        {insightsWithActions.slice(0, maxInsights).map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </Card>
  );
}

export default RealAIInsights;
