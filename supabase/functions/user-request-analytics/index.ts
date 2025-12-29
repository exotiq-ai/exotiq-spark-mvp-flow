import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple keyword extraction function
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their']);
  
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Count frequency
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Return top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// Simple sentiment analysis (basic implementation)
function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = ['great', 'awesome', 'excellent', 'love', 'perfect', 'amazing', 'wonderful', 'fantastic', 'good', 'helpful', 'useful', 'thanks', 'thank'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'poor', 'broken', 'wrong', 'issue', 'problem', 'error', 'bug', 'missing', 'need', 'want', 'wish'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Calculate priority score based on keywords and request type
function calculatePriorityScore(keywords: string[], requestType: string, sentiment: string): number {
  let score = 0;
  
  // Base score by request type
  const typeScores: Record<string, number> = {
    'tool_request': 30,
    'feature_suggestion': 25,
    'help_query': 15,
    'general_feedback': 10
  };
  score += typeScores[requestType] || 0;
  
  // Urgency keywords add to score
  const urgentKeywords = ['urgent', 'critical', 'important', 'asap', 'immediately', 'broken', 'error', 'bug', 'crash'];
  const urgencyBoost = keywords.filter(k => urgentKeywords.some(uk => k.includes(uk))).length * 10;
  score += urgencyBoost;
  
  // Sentiment impact
  const sentimentScores: Record<string, number> = {
    'negative': 15,
    'neutral': 5,
    'positive': 0
  };
  score += sentimentScores[sentiment] || 0;
  
  return Math.min(score, 100); // Cap at 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'log_request': {
        const { 
          request_type, 
          request_content, 
          context = {}, 
          module_id = null,
          ai_response = null 
        } = payload;

        if (!request_type || !request_content) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: request_type, request_content' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Extract keywords and analyze sentiment
        const keywords = extractKeywords(request_content);
        const sentiment = analyzeSentiment(request_content);
        const priorityScore = calculatePriorityScore(keywords, request_type, sentiment);

        // Insert request into database
        const { data, error } = await supabase
          .from('user_request_analytics')
          .insert({
            user_id: user.id,
            request_type,
            request_content,
            request_keywords: keywords,
            context,
            module_id,
            sentiment,
            priority_score: priorityScore,
            ai_response
          })
          .select()
          .single();

        if (error) {
          console.error('Error logging request:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to log request', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            request_id: data.id,
            priority_score: priorityScore,
            sentiment,
            keywords
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_analytics': {
        const { timeframe = 'week', request_type = null } = payload;

        // Calculate date range
        const now = new Date();
        let startDate = new Date();
        
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
          default:
            startDate.setDate(now.getDate() - 7);
        }

        // Build query
        let query = supabase
          .from('user_request_analytics')
          .select('*')
          .gte('created_at', startDate.toISOString());

        if (request_type) {
          query = query.eq('request_type', request_type);
        }

        const { data: requests, error } = await query.order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch analytics', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate analytics
        const totalRequests = requests?.length || 0;
        const uniqueUsers = new Set(requests?.map(r => r.user_id)).size;
        
        const byType = requests?.reduce((acc, r) => {
          acc[r.request_type] = (acc[r.request_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const byModule = requests?.reduce((acc, r) => {
          if (r.module_id) {
            acc[r.module_id] = (acc[r.module_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const bySentiment = requests?.reduce((acc, r) => {
          if (r.sentiment) {
            acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const avgPriority = requests?.reduce((sum, r) => sum + (r.priority_score || 0), 0) / totalRequests || 0;

        // Get trending keywords
        const allKeywords = requests?.flatMap(r => r.request_keywords || []) || [];
        const keywordFrequency: Record<string, number> = {};
        allKeywords.forEach(keyword => {
          keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;
        });

        const trendingKeywords = Object.entries(keywordFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([keyword, count]) => ({ keyword, count }));

        // Get top priority requests
        const topPriorityRequests = requests
          ?.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
          .slice(0, 5)
          .map(r => ({
            id: r.id,
            request_type: r.request_type,
            request_content: r.request_content.substring(0, 100) + '...',
            priority_score: r.priority_score,
            sentiment: r.sentiment,
            created_at: r.created_at
          }));

        return new Response(
          JSON.stringify({
            timeframe,
            summary: {
              total_requests: totalRequests,
              unique_users: uniqueUsers,
              avg_priority: Math.round(avgPriority * 10) / 10
            },
            by_type: byType,
            by_module: byModule,
            by_sentiment: bySentiment,
            trending_keywords: trendingKeywords,
            top_priority_requests: topPriorityRequests
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_trending_topics': {
        const { limit = 20, days = 30 } = payload;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get keyword trends from view
        const { data, error } = await supabase
          .from('user_request_keywords_trending')
          .select('*')
          .limit(limit);

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch trending topics', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ trending_topics: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'generate_report': {
        const { start_date, end_date, format = 'json' } = payload;

        const { data: requests, error } = await supabase
          .from('user_request_analytics')
          .select('*')
          .gte('created_at', start_date)
          .lte('created_at', end_date)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to generate report', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate comprehensive report
        const report = {
          period: { start: start_date, end: end_date },
          generated_at: new Date().toISOString(),
          summary: {
            total_requests: requests.length,
            unique_users: new Set(requests.map(r => r.user_id)).size,
            resolved_count: requests.filter(r => r.resolved).length,
            avg_priority: requests.reduce((sum, r) => sum + (r.priority_score || 0), 0) / requests.length || 0
          },
          breakdown: {
            by_type: requests.reduce((acc, r) => {
              acc[r.request_type] = (acc[r.request_type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            by_status: requests.reduce((acc, r) => {
              acc[r.status] = (acc[r.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            by_sentiment: requests.reduce((acc, r) => {
              if (r.sentiment) acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            by_module: requests.reduce((acc, r) => {
              if (r.module_id) acc[r.module_id] = (acc[r.module_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          },
          top_keywords: (() => {
            const allKeywords = requests.flatMap(r => r.request_keywords || []);
            const frequency: Record<string, number> = {};
            allKeywords.forEach(k => frequency[k] = (frequency[k] || 0) + 1);
            return Object.entries(frequency)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([keyword, count]) => ({ keyword, count }));
          })(),
          high_priority_requests: requests
            .filter(r => (r.priority_score || 0) > 50)
            .map(r => ({
              id: r.id,
              type: r.request_type,
              content: r.request_content.substring(0, 150) + '...',
              priority: r.priority_score,
              status: r.status,
              created_at: r.created_at
            }))
        };

        return new Response(
          JSON.stringify(report),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_status': {
        // Check if user is admin
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRole || userRole.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { request_id, status, notes, resolved } = payload;

        if (!request_id || !status) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: request_id, status' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = { status };
        if (notes) updateData.notes = notes;
        if (resolved !== undefined) {
          updateData.resolved = resolved;
          if (resolved) {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolved_by = user.id;
          }
        }

        const { data, error } = await supabase
          .from('user_request_analytics')
          .update(updateData)
          .eq('id', request_id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to update status', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: log_request, get_analytics, get_trending_topics, generate_report, update_status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in user-request-analytics:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
