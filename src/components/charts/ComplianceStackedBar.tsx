import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Shield, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useChartHeight, getResponsiveAxisConfig, getMobileLegendProps } from "@/components/ui/adaptive-chart";
import { useIsMobile } from "@/hooks/use-mobile";

const complianceData = [
  {
    category: 'Insurance',
    compliant: 10,
    expiringSoon: 2,
    expired: 0,
    total: 12,
    icon: Shield
  },
  {
    category: 'Registration',
    compliant: 6,
    expiringSoon: 3,
    expired: 1,
    total: 10,
    icon: FileText
  },
  {
    category: 'Inspections',
    compliant: 7,
    expiringSoon: 1,
    expired: 0,
    total: 8,
    icon: CheckCircle
  },
  {
    category: 'Licenses',
    compliant: 4,
    expiringSoon: 1,
    expired: 1,
    total: 6,
    icon: AlertTriangle
  }
];

export const ComplianceStackedBar = () => {
  const isMobile = useIsMobile();
  const chartHeight = useChartHeight(200, 260, 300);
  const axisConfig = getResponsiveAxisConfig(isMobile);
  const legendProps = getMobileLegendProps(isMobile);

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
              <span className="font-semibold">{payload[0]?.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning" />
                Expiring:
              </span>
              <span className="font-semibold">{payload[1]?.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Expired:
              </span>
              <span className="font-semibold">{payload[2]?.value}</span>
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

  const totalItems = complianceData.reduce((sum, cat) => sum + cat.total, 0);
  const totalCompliant = complianceData.reduce((sum, cat) => sum + cat.compliant, 0);
  const compliancePercentage = Math.round((totalCompliant / totalItems) * 100);

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
            <Badge className={`text-xs ${compliancePercentage >= 80 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
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
            const complianceRate = Math.round((category.compliant / category.total) * 100);
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
                  complianceRate >= 80 ? 'text-success' :
                  complianceRate >= 60 ? 'text-warning' : 'text-destructive'
                }`} aria-hidden="true" />
                <div className="font-semibold text-sm mb-1">{category.category}</div>
                <div className="text-2xl font-bold mb-1">{complianceRate}%</div>
                <div className="text-xs text-muted-foreground">
                  {category.compliant}/{category.total}
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
          <strong className="text-foreground">Action:</strong> {
            complianceData.reduce((sum, cat) => sum + cat.expiringSoon + cat.expired, 0)
          } documents need attention.
        </motion.div>
      </Card>
    </motion.div>
  );
};