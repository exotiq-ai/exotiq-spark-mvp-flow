import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  getAnalytics, 
  getTrendingTopics, 
  generateReport,
  type AnalyticsResult,
  type TrendingTopic
} from '@/lib/requestAnalytics';
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  BarChart3, 
  Download,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Lightbulb,
  HelpCircle,
  Wrench,
  MessageCircle,
  Target
} from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

type Timeframe = 'day' | 'week' | 'month' | 'year';

const REQUEST_TYPE_ICONS = {
  tool_request: Wrench,
  feature_suggestion: Lightbulb,
  help_query: HelpCircle,
  general_feedback: MessageCircle
};

const REQUEST_TYPE_COLORS = {
  tool_request: 'bg-blue-500/10 text-blue-600 border-blue-200',
  feature_suggestion: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  help_query: 'bg-purple-500/10 text-purple-600 border-purple-200',
  general_feedback: 'bg-green-500/10 text-green-600 border-green-200'
};

const SENTIMENT_COLORS = {
  positive: 'text-green-600',
  neutral: 'text-gray-600',
  negative: 'text-red-600'
};

export const RequestAnalyticsDashboard = () => {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<Timeframe>('week');
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [timeframe]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsData, topicsData] = await Promise.all([
        getAnalytics({ timeframe }),
        getTrendingTopics(20, timeframe === 'day' ? 7 : timeframe === 'week' ? 30 : 90)
      ]);

      setAnalytics(analyticsData);
      setTrendingTopics(topicsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const now = new Date();
      const endDate = now.toISOString();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      const report = await generateReport({
        startDate: startDate.toISOString(),
        endDate,
        format: 'json'
      });

      if (report) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-requests-report-${timeframe}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Report Generated',
          description: 'Report downloaded successfully'
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive'
      });
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Request Analytics</h2>
          <p className="text-muted-foreground">
            Track tool requests, feature suggestions, and user feedback
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleGenerateReport} 
            disabled={reportLoading}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            {reportLoading ? 'Generating...' : 'Export Report'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.total_requests}</div>
            <p className="text-xs text-muted-foreground">
              from {analytics.summary.unique_users} unique users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Priority</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.avg_priority.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.unique_users}</div>
            <p className="text-xs text-muted-foreground">active requesters</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trending">Trending Topics</TabsTrigger>
          <TabsTrigger value="priority">Priority Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Request Types Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Request Types</CardTitle>
                <CardDescription>Breakdown by category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analytics.by_type).map(([type, count]) => {
                  const Icon = REQUEST_TYPE_ICONS[type as keyof typeof REQUEST_TYPE_ICONS];
                  const percentage = ((count / analytics.summary.total_requests) * 100).toFixed(1);
                  
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{count}</Badge>
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Sentiment Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
                <CardDescription>User feedback sentiment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analytics.by_sentiment).map(([sentiment, count]) => {
                  const percentage = ((count / analytics.summary.total_requests) * 100).toFixed(1);
                  
                  return (
                    <div key={sentiment} className="flex items-center justify-between">
                      <span className={`text-sm font-medium capitalize ${SENTIMENT_COLORS[sentiment as keyof typeof SENTIMENT_COLORS]}`}>
                        {sentiment}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{count}</Badge>
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Module Breakdown */}
            {Object.keys(analytics.by_module).length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Requests by Module</CardTitle>
                  <CardDescription>Which areas users are interacting with most</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(analytics.by_module).map(([module, count]) => (
                      <div key={module} className="flex flex-col items-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize text-center">
                          {module}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trending Keywords</CardTitle>
              <CardDescription>Most frequently mentioned topics</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {analytics.trending_keywords.map((item, index) => (
                    <div 
                      key={item.keyword}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium capitalize">{item.keyword}</div>
                          <div className="text-xs text-muted-foreground">
                            Mentioned {item.count} {item.count === 1 ? 'time' : 'times'}
                          </div>
                        </div>
                      </div>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {trendingTopics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Topic Analysis</CardTitle>
                <CardDescription>Last 30 days trending analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {trendingTopics.slice(0, 15).map((topic) => (
                      <div 
                        key={topic.keyword}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium capitalize">{topic.keyword}</div>
                          <div className="text-xs text-muted-foreground">
                            {topic.unique_requesters} unique requesters • Last: {new Date(topic.last_requested).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={REQUEST_TYPE_COLORS[topic.request_type as keyof typeof REQUEST_TYPE_COLORS]}
                          >
                            {topic.frequency}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="priority" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Priority Requests</CardTitle>
              <CardDescription>Top requests requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {analytics.top_priority_requests.map((request) => {
                    const Icon = REQUEST_TYPE_ICONS[request.request_type as keyof typeof REQUEST_TYPE_ICONS];
                    
                    return (
                      <div 
                        key={request.id}
                        className="p-4 border rounded-lg space-y-2 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <Badge className={REQUEST_TYPE_COLORS[request.request_type as keyof typeof REQUEST_TYPE_COLORS]}>
                              {request.request_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">{request.priority_score}</Badge>
                            <span className={`text-xs font-medium ${SENTIMENT_COLORS[request.sentiment as keyof typeof SENTIMENT_COLORS]}`}>
                              {request.sentiment}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm">{request.request_content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(request.created_at).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
