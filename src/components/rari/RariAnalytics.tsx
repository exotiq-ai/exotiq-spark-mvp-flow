import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, MessageSquare, Clock, TrendingUp } from 'lucide-react';

interface RariAnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgDuration: number;
  topQueries: string[];
}

/**
 * Rari Analytics Component
 * Currently shows placeholder data since database tables don't exist yet
 */
export const RariAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<RariAnalyticsData>({
    totalConversations: 0,
    totalMessages: 0,
    avgDuration: 0,
    topQueries: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Analytics would be loaded from database here
    // For now, just show empty state
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gulf-blue" />
            Rari Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gulf-blue" />
          Rari Analytics
        </CardTitle>
        <CardDescription>
          Voice assistant usage and insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 text-gulf-blue" />
            <p className="text-2xl font-bold">{analytics.totalConversations}</p>
            <p className="text-xs text-muted-foreground">Conversations</p>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold">{analytics.totalMessages}</p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <Clock className="h-6 w-6 mx-auto mb-2 text-performance-orange" />
            <p className="text-2xl font-bold">{analytics.avgDuration}s</p>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </div>
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <Badge variant="outline" className="mb-2">Coming Soon</Badge>
            <p className="text-xs text-muted-foreground">Analytics require database setup</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
