import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3,
  MessageSquare,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  Tag,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  averageDuration: number;
  averageMessagesPerConversation: number;
  topTags: Array<{ tag: string; count: number }>;
  conversationsByDay: Array<{ date: string; count: number }>;
}

export const RariAnalytics = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get conversations with messages
      const { data: conversations, error } = await supabase
        .from('rari_conversations')
        .select('*, rari_messages(count)')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate analytics
      const totalConversations = conversations?.length || 0;
      
      let totalMessages = 0;
      let totalDuration = 0;
      const tagCounts: Record<string, number> = {};
      const daysCounts: Record<string, number> = {};

      conversations?.forEach((conv: any) => {
        // Count messages
        totalMessages += conv.message_count || 0;

        // Sum duration
        if (conv.duration_seconds) {
          totalDuration += conv.duration_seconds;
        }

        // Count tags
        if (conv.tags && Array.isArray(conv.tags)) {
          conv.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }

        // Count by day
        const date = new Date(conv.started_at).toLocaleDateString();
        daysCounts[date] = (daysCounts[date] || 0) + 1;
      });

      // Format top tags
      const topTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Format conversations by day (last 7 days)
      const conversationsByDay = Object.entries(daysCounts)
        .map(([date, count]) => ({ date, count }))
        .slice(0, 7);

      setData({
        totalConversations,
        totalMessages,
        averageDuration: totalConversations > 0 ? Math.floor(totalDuration / totalConversations) : 0,
        averageMessagesPerConversation: totalConversations > 0 
          ? Math.floor(totalMessages / totalConversations) 
          : 0,
        topTags,
        conversationsByDay,
      });
    } catch (error) {
      console.error('[Analytics] Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatTagLabel = (tag: string) => {
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Card className="p-6 glass-card">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6 glass-card">
        <p className="text-sm text-muted-foreground">No analytics data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 glass-card">
      <div className="flex items-center justify-between mb-6 pb-3 border-b">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gulf-blue" />
            Rari Analytics
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Conversation insights and metrics
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 border-gulf-blue/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gulf-blue/10">
              <MessageSquare className="h-5 w-5 text-gulf-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.totalConversations}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.totalMessages}</p>
              <p className="text-xs text-muted-foreground">Messages</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatDuration(data.averageDuration)}</p>
              <p className="text-xs text-muted-foreground">Avg Duration</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.averageMessagesPerConversation}</p>
              <p className="text-xs text-muted-foreground">Avg Messages</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Topics */}
        <Card className="p-4">
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Top Topics
          </h4>
          {data.topTags.length > 0 ? (
            <div className="space-y-3">
              {data.topTags.map(({ tag, count }) => (
                <div key={tag} className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {formatTagLabel(tag)}
                  </Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No topic data yet</p>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-4">
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </h4>
          {data.conversationsByDay.length > 0 ? (
            <div className="space-y-3">
              {data.conversationsByDay.map(({ date, count }) => (
                <div key={date} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{date}</span>
                  <span className="text-sm font-medium">{count} conversation{count > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity data yet</p>
          )}
        </Card>
      </div>
    </Card>
  );
};
