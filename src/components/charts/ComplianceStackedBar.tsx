import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Shield, FileText, CheckCircle, AlertTriangle } from "lucide-react";

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
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-success">Compliant:</span>
              <span className="font-semibold">{payload[0]?.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-warning">Expiring Soon:</span>
              <span className="font-semibold">{payload[1]?.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-destructive">Expired:</span>
              <span className="font-semibold">{payload[2]?.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{total}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate overall compliance percentage
  const totalItems = complianceData.reduce((sum, cat) => sum + cat.total, 0);
  const totalCompliant = complianceData.reduce((sum, cat) => sum + cat.compliant, 0);
  const compliancePercentage = Math.round((totalCompliant / totalItems) * 100);

  return (
    <Card className="p-6 border-2 border-border shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold mb-2">Compliance Distribution</h3>
          <p className="text-sm text-muted-foreground">
            Track document status across all compliance categories
          </p>
        </div>
        <Badge className={compliancePercentage >= 80 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}>
          {compliancePercentage}% Compliant
        </Badge>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={complianceData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            dataKey="category" 
            type="category"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              const labels: { [key: string]: string } = {
                compliant: 'Compliant',
                expiringSoon: 'Expiring Soon',
                expired: 'Expired'
              };
              return labels[value] || value;
            }}
          />
          <Bar dataKey="compliant" stackId="a" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
          <Bar dataKey="expiringSoon" stackId="a" fill="hsl(var(--warning))" />
          <Bar dataKey="expired" stackId="a" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {complianceData.map((category) => {
          const complianceRate = Math.round((category.compliant / category.total) * 100);
          const CategoryIcon = category.icon;
          
          return (
            <div 
              key={category.category} 
              className="p-4 rounded-lg border border-border hover:border-primary/50 transition-all cursor-pointer"
            >
              <CategoryIcon className={`h-5 w-5 mb-2 ${
                complianceRate >= 80 ? 'text-success' :
                complianceRate >= 60 ? 'text-warning' : 'text-destructive'
              }`} />
              <div className="font-semibold text-sm mb-1">{category.category}</div>
              <div className="text-2xl font-bold mb-1">{complianceRate}%</div>
              <div className="text-xs text-muted-foreground">
                {category.compliant}/{category.total} items
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <strong className="text-foreground">Action Required:</strong> {
          complianceData.reduce((sum, cat) => sum + cat.expiringSoon + cat.expired, 0)
        } documents need immediate attention to maintain compliance.
      </div>
    </Card>
  );
};
