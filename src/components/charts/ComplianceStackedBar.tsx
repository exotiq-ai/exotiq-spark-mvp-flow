import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Shield, FileText, CheckCircle, AlertTriangle, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useChartHeight, getResponsiveAxisConfig, getMobileLegendProps } from "@/components/ui/adaptive-chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { Button } from "@/components/ui/button";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Insurance': Shield,
  'Registration': FileText,
  'Inspections': CheckCircle,
  'Licenses': AlertTriangle
};

const EXPIRING_SOON_DAYS = 30;

export const ComplianceStackedBar = () => {
  const isMobile = useIsMobile();
  const chartHeight = useChartHeight(200, 260, 300);
  const axisConfig = getResponsiveAxisConfig(isMobile);
  const legendProps = getMobileLegendProps(isMobile);
  const { documents } = useLocationFilteredFleet();

  // Calculate compliance data from real documents
  const complianceData = useMemo(() => {
    const categories = ['Insurance', 'Registration', 'Inspections', 'Licenses'];
    const now = new Date();
    
    return categories.map(category => {
      // Filter documents that match this category (case-insensitive partial match)
      const categoryDocs = (documents || []).filter(d => 
        d.type?.toLowerCase().includes(category.toLowerCase().slice(0, -1)) || // Remove plural 's' for matching
        d.type?.toLowerCase() === category.toLowerCase()
      );
      
      const expired = categoryDocs.filter(d => {
        if (!d.expires_at) return false;
        return new Date(d.expires_at) < now;
      }).length;
      
      const expiringSoon = categoryDocs.filter(d => {
        if (!d.expires_at) return false;
        const expiry = new Date(d.expires_at);
        const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntil > 0 && daysUntil <= EXPIRING_SOON_DAYS;
      }).length;
      
      const compliant = categoryDocs.length - expired - expiringSoon;
      
      return { 
        category, 
        compliant: Math.max(0, compliant), 
        expiringSoon, 
        expired, 
        total: categoryDocs.length,
        icon: CATEGORY_ICONS[category] || FileText
      };
    });
  }, [documents]);

  const totalItems = complianceData.reduce((sum, cat) => sum + cat.total, 0);
  const totalCompliant = complianceData.reduce((sum, cat) => sum + cat.compliant, 0);
  const compliancePercentage = totalItems > 0 ? Math.round((totalCompliant / totalItems) * 100) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      
      return (
        <motion.div 
          className="bg-card border border-border rounded-xl p-4 shadow-lg"
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success" />
                Compliant:
              </span>
              <span className="font-semibold">{payload[0]?.value || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning" />
                Expiring:
              </span>
              <span className="font-semibold">{payload[1]?.value || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Expired:
              </span>
              <span className="font-semibold">{payload[2]?.value || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{total}</span>
            </div>
          </div>
        </motion.div>
      );
    }
    return null;
  };

  // Empty state when no documents
  if (totalItems === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card 
          className="p-4 sm:p-6 border-2 border-dashed border-border"
          role="region"
          aria-label="Compliance distribution chart"
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Shield className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Documents Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Upload insurance, registration, inspection, and license documents to track compliance across your fleet.
            </p>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card 
        className="p-4 sm:p-6 border-2 border-border shadow-sm"
        role="region"
        aria-label="Compliance distribution chart"
      >
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-1">Compliance</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isMobile ? 'Document status' : 'Track document status across categories'}
            </p>
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Badge className={`text-xs ${compliancePercentage >= 80 ? 'bg-success/20 text-success' : compliancePercentage >= 50 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>
              {compliancePercentage}% Compliant
            </Badge>
          </motion.div>
        </motion.div>

        <motion.div 
          role="img" 
          aria-label="Stacked bar chart showing compliance status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={complianceData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 12 }}
                tickLine={false}
              />
              <YAxis 
                dataKey="category" 
                type="category"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 12 }}
                width={isMobile ? 55 : 90}
                tickFormatter={(value) => {
                  const strValue = String(value ?? '');
                  return isMobile ? strValue.slice(0, 5) : strValue;
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
              <Legend 
                {...legendProps}
                formatter={(value) => {
                  const labels: { [key: string]: string } = {
                    compliant: isMobile ? 'OK' : 'Compliant',
                    expiringSoon: isMobile ? 'Soon' : 'Expiring',
                    expired: 'Expired'
                  };
                  return labels[value] || value;
                }}
              />
              <Bar 
                dataKey="compliant" 
                stackId="a" 
                fill="hsl(var(--success))" 
                radius={[0, 0, 0, 0]}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Bar 
                dataKey="expiringSoon" 
                stackId="a" 
                fill="hsl(var(--warning))"
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Bar 
                dataKey="expired" 
                stackId="a" 
                fill="hsl(var(--destructive))" 
                radius={[0, 4, 4, 0]}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category Cards - Hidden on mobile */}
        <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {complianceData.map((category, index) => {
            const complianceRate = category.total > 0 ? Math.round((category.compliant / category.total) * 100) : 0;
            const CategoryIcon = category.icon;
            
            return (
              <motion.div 
                key={category.category} 
                className="p-4 rounded-lg border border-border hover:border-primary/50 transition-all cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`${category.category}: ${complianceRate}% compliant`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <CategoryIcon className={`h-5 w-5 mb-2 transition-transform group-hover:scale-110 ${
                  category.total === 0 ? 'text-muted-foreground' :
                  complianceRate >= 80 ? 'text-success' :
                  complianceRate >= 60 ? 'text-warning' : 'text-destructive'
                }`} aria-hidden="true" />
                <div className="font-semibold text-sm mb-1">{category.category}</div>
                <div className="text-2xl font-bold mb-1">
                  {category.total > 0 ? `${complianceRate}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {category.total > 0 ? `${category.compliant}/${category.total}` : 'No documents'}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Action summary */}
        <motion.div 
          className="mt-4 p-2 sm:p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          {(() => {
            const needsAttention = complianceData.reduce((sum, cat) => sum + cat.expiringSoon + cat.expired, 0);
            if (needsAttention === 0) {
              return <><strong className="text-foreground">All clear!</strong> No documents need immediate attention.</>;
            }
            return <><strong className="text-foreground">Action:</strong> {needsAttention} document{needsAttention !== 1 ? 's' : ''} need attention.</>;
          })()}
        </motion.div>
      </Card>
    </motion.div>
  );
};
