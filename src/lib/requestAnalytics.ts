import { supabase } from '@/integrations/supabase/client';

export type RequestType = 'tool_request' | 'feature_suggestion' | 'help_query' | 'general_feedback';

export interface LogRequestParams {
  requestType: RequestType;
  requestContent: string;
  context?: Record<string, any>;
  moduleId?: string;
  aiResponse?: string;
}

export interface AnalyticsTimeframe {
  timeframe: 'day' | 'week' | 'month' | 'year';
  requestType?: RequestType;
}

export interface AnalyticsResult {
  timeframe: string;
  summary: {
    total_requests: number;
    unique_users: number;
    avg_priority: number;
  };
  by_type: Record<string, number>;
  by_module: Record<string, number>;
  by_sentiment: Record<string, number>;
  trending_keywords: Array<{ keyword: string; count: number }>;
  top_priority_requests: Array<{
    id: string;
    request_type: string;
    request_content: string;
    priority_score: number;
    sentiment: string;
    created_at: string;
  }>;
}

export interface TrendingTopic {
  keyword: string;
  frequency: number;
  request_type: string;
  last_requested: string;
  unique_requesters: number;
}

export interface ReportParams {
  startDate: string;
  endDate: string;
  format?: 'json' | 'csv';
}

/**
 * Log a user request for analytics tracking
 */
export async function logUserRequest(params: LogRequestParams) {
  try {
    const { data, error } = await supabase.functions.invoke('user-request-analytics', {
      body: {
        action: 'log_request',
        request_type: params.requestType,
        request_content: params.requestContent,
        context: params.context || {},
        module_id: params.moduleId,
        ai_response: params.aiResponse
      }
    });

    if (error) {
      console.error('Failed to log user request:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error logging user request:', error);
    return { success: false, error };
  }
}

/**
 * Get analytics for a specific timeframe
 */
export async function getAnalytics(params: AnalyticsTimeframe): Promise<AnalyticsResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('user-request-analytics', {
      body: {
        action: 'get_analytics',
        timeframe: params.timeframe,
        request_type: params.requestType
      }
    });

    if (error) {
      console.error('Failed to fetch analytics:', error);
      return null;
    }

    return data as AnalyticsResult;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }
}

/**
 * Get trending topics based on user requests
 */
export async function getTrendingTopics(limit = 20, days = 30): Promise<TrendingTopic[]> {
  try {
    const { data, error } = await supabase.functions.invoke('user-request-analytics', {
      body: {
        action: 'get_trending_topics',
        limit,
        days
      }
    });

    if (error) {
      console.error('Failed to fetch trending topics:', error);
      return [];
    }

    return data?.trending_topics || [];
  } catch (error) {
    console.error('Error fetching trending topics:', error);
    return [];
  }
}

/**
 * Generate a comprehensive analytics report
 */
export async function generateReport(params: ReportParams) {
  try {
    const { data, error } = await supabase.functions.invoke('user-request-analytics', {
      body: {
        action: 'generate_report',
        start_date: params.startDate,
        end_date: params.endDate,
        format: params.format || 'json'
      }
    });

    if (error) {
      console.error('Failed to generate report:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error generating report:', error);
    return null;
  }
}

/**
 * Update request status (admin only)
 */
export async function updateRequestStatus(
  requestId: string,
  status: 'pending' | 'reviewing' | 'planned' | 'in_progress' | 'completed' | 'rejected',
  notes?: string,
  resolved?: boolean
) {
  try {
    const { data, error } = await supabase.functions.invoke('user-request-analytics', {
      body: {
        action: 'update_status',
        request_id: requestId,
        status,
        notes,
        resolved
      }
    });

    if (error) {
      console.error('Failed to update request status:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error updating request status:', error);
    return { success: false, error };
  }
}

/**
 * Helper to log when user asks for a specific tool
 */
export async function logToolRequest(toolName: string, context?: Record<string, any>) {
  return logUserRequest({
    requestType: 'tool_request',
    requestContent: `User requested tool: ${toolName}`,
    context: { tool_name: toolName, ...context }
  });
}

/**
 * Helper to log feature suggestions
 */
export async function logFeatureSuggestion(suggestion: string, moduleId?: string) {
  return logUserRequest({
    requestType: 'feature_suggestion',
    requestContent: suggestion,
    moduleId
  });
}

/**
 * Helper to log help queries
 */
export async function logHelpQuery(query: string, aiResponse?: string, moduleId?: string) {
  return logUserRequest({
    requestType: 'help_query',
    requestContent: query,
    aiResponse,
    moduleId
  });
}

/**
 * Helper to log general feedback
 */
export async function logGeneralFeedback(feedback: string, context?: Record<string, any>) {
  return logUserRequest({
    requestType: 'general_feedback',
    requestContent: feedback,
    context
  });
}
