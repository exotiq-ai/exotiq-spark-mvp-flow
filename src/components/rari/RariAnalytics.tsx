import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, MessageSquare, Clock, TrendingUp } from 'lucide-react';

interface RariAnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgDuration: number;
  topTags: string[];
}

/**
 * Rari Analytics Component
 * Fetches real data from rari_conversations and rari_messages tables
 */
export const RariAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<RariAnalyticsData>({
    totalConversations: 0,
    totalMessages: 0,
    avgDuration: 0,
    topTags: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch conversation statistics
        const { data: conversations, error: convError } = await supabase
          .from('rari_conversations')
          .select('id, message_count, started_at, ended_at, context_summary')
          .eq('user_id', user.id);

        if (convError) {
          console.error('[Rari Analytics] Error fetching conversations:', convError);
          setLoading(false);
          return;
        }

        const totalConversations = conversations?.length || 0;
        const totalMessages = conversations?.reduce((sum, c) => sum + (c.message_count || 0), 0) || 0;

        // Calculate average duration
        let totalDuration = 0;
        let durationCount = 0;
        conversations?.forEach(conv => {
          if (conv.started_at && conv.ended_at) {
            const start = new Date(conv.started_at).getTime();
            const end = new Date(conv.ended_at).getTime();
            const durationSec = (end - start) / 1000;
            if (durationSec > 0 && durationSec < 3600) { // Max 1 hour
              totalDuration += durationSec;
              durationCount++;
            }
          }
        });
        const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

        // Extract top tags from context_summary
        const tagCounts: Record<string, number> = {};
        conversations?.forEach(conv => {
          if (conv.context_summary) {
            try {
              const parsed = JSON.parse(conv.context_summary);
              const tags = parsed.detected_tags || [];
              tags.forEach((tag: string) => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
              });
            } catch {
              // Skip invalid JSON
            }
          }
        });

        const topTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tag]) => tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

        setAnalytics({
          totalConversations,
          totalMessages,
          avgDuration,
          topTags,
        });
      } catch (err) {
        console.error('[Rari Analytics] Failed to fetch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center p-4 bg-muted/30 rounded-lg">
                <Skeleton className="h-6 w-6 mx-auto mb-2" />
                <Skeleton className="h-8 w-16 mx-auto mb-1" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </div>
            ))}
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
            <BarChart3 className="h-6 w-6 mx-auto mb-2 text-primary" />
            {analytics.topTags.length > 0 ? (
              <>
                <p className="text-sm font-medium truncate">{analytics.topTags[0]}</p>
                <p className="text-xs text-muted-foreground">Top Topic</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">No data yet</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
