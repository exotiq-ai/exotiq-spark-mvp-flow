import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DriverTrendProps {
  driverName: string;
  currentScore: number;
  vehicle: string;
  status: 'excellent' | 'good' | 'needs-improvement';
}

// Generate mock historical data for a driver
const generateTrendData = (baseScore: number, trend: 'improving' | 'declining' | 'stable') => {
  const data = [];
  const periods = ['7 days ago', '6 days ago', '5 days ago', '4 days ago', '3 days ago', '2 days ago', 'Yesterday', 'Today'];
  
  for (let i = 0; i < 8; i++) {
    let score = baseScore;
    if (trend === 'improving') {
      score = baseScore - 8 + (i * 2) + (Math.random() * 4 - 2);
    } else if (trend === 'declining') {
      score = baseScore + 8 - (i * 2) + (Math.random() * 4 - 2);
    } else {
      score = baseScore + (Math.random() * 6 - 3);
    }
    
    data.push({
      period: periods[i],
      score: Math.max(0, Math.min(100, Math.round(score))),
    });
  }
  
  return data;
};

export const DriverPerformanceTrend = ({ driverName, currentScore, vehicle, status }: DriverTrendProps) => {
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('7');
  const [expanded, setExpanded] = useState(false);
  
  // Determine trend based on status
  const trend = status === 'excellent' ? 'improving' : 
                status === 'needs-improvement' ? 'declining' : 'stable';
  
  const trendData = generateTrendData(currentScore, trend);
  
  // Calculate trend direction
  const firstScore = trendData[0].score;
  const lastScore = trendData[trendData.length - 1].score;
  const scoreDiff = lastScore - firstScore;
  const trendDirection = scoreDiff > 3 ? 'up' : scoreDiff < -3 ? 'down' : 'stable';

  const getTrendColor = () => {
    switch (status) {
      case 'excellent': return 'hsl(var(--success))';
      case 'needs-improvement': return 'hsl(var(--destructive))';
      default: return 'hsl(var(--primary))';
    }
  };

  const getTrendIcon = () => {
    if (trendDirection === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trendDirection === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(true)}
        className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
      >
        <span>View Performance Trend</span>
        <span>▼</span>
      </Button>
    );
  }

  return (
    <AnimatePresence>
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
    <Card 
      className="mt-4 p-4 border border-border bg-muted/20"
      role="region"
      aria-label={`Performance history for ${driverName}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold mb-1">Performance History</h4>
          <p className="text-xs text-muted-foreground">{driverName} - {vehicle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            {getTrendIcon()}
            {trendDirection === 'up' ? 'Improving' : 
             trendDirection === 'down' ? 'Declining' : 'Stable'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            className="h-6 w-6 p-0"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={timeRange === '7' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeRange('7')}
          className="text-xs"
        >
          7 Days
        </Button>
        <Button
          variant={timeRange === '30' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeRange('30')}
          className="text-xs"
          disabled
        >
          30 Days
        </Button>
        <Button
          variant={timeRange === '90' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeRange('90')}
          className="text-xs"
          disabled
        >
          90 Days
        </Button>
      </div>

      <div role="img" aria-label={`Line chart showing ${driverName}'s performance trend over the last 7 days`}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="period" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[0, 100]}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            label={{ value: 'Score', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value: number) => [`${value}%`, 'Score']}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke={getTrendColor()}
            strokeWidth={2.5}
            dot={{ fill: getTrendColor(), r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
            activeDot={{ r: 6, stroke: getTrendColor(), strokeWidth: 2 }}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
        {trendDirection === 'up' && (
          <p>✅ Performance improving. {driverName} is showing consistent progress.</p>
        )}
        {trendDirection === 'down' && (
          <p>⚠️ Performance declining. Consider additional driver training or review.</p>
        )}
        {trendDirection === 'stable' && (
          <p>📊 Performance stable. {driverName} maintains consistent driving quality.</p>
        )}
      </div>
    </Card>
    </motion.div>
    </AnimatePresence>
  );
};
