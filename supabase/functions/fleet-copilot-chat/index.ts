import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { logTransfer } from "../_shared/transferGuard.ts";
import { getUserTeamId } from "../_shared/fleet-tools/auth.ts";
import { executeFunction as executeSharedFunction } from "../_shared/fleet-tools/executor.ts";
import { toOpenAIFunctions } from "../_shared/fleet-tools/registry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const authHeader = req.headers.get('Authorization');
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Validate messages input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many messages (max 50)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(
          JSON.stringify({ error: 'Invalid message format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.content.length > 10000) {
        return new Response(
          JSON.stringify({ error: 'Message content too long (max 10000 chars)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Initialize Supabase client for database queries
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth header
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    const userId = user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // CAPABILITIES — shared with the voice webhook and MCP server.
    // Tool definitions come from _shared/fleet-tools/registry.ts and every
    // handler lives in _shared/fleet-tools/executor.ts, so all three Rari
    // surfaces answer with identical, team-scoped data. This function used to
    // carry its own copy of the handlers (scoped by user_id, with hardcoded
    // sample Ferrari/McLaren specs) — both are gone.
    // ============================================================
    const teamId = await getUserTeamId(supabase, userId);
    if (!teamId) {
      return new Response(
        JSON.stringify({
          error: 'No team access',
          summary: 'Your account is not linked to a fleet yet, so there is no data for me to look at.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tools = toOpenAIFunctions();

    const executeFunction = (functionName: string, args: any) =>
      executeSharedFunction(functionName, args ?? {}, supabase, userId, teamId);

    // Generate current date dynamically
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = `You are Rari (pronounced "Rarri" like Ferrari), the FleetCopilot™ AI assistant for EXOTIQ luxury car rental operations.

Current Date: ${currentDate}

Core Personality: 
- Confident automotive expert with deep passion for exotic cars
- Professional luxury concierge with real-time fleet intelligence
- Conversational and engaging - you LOVE talking about cars
- Precise and data-driven when providing business insights

Your Dual Capabilities:

1. FLEET OPERATIONS (use function calls for real data):
   - Fleet performance: revenue, utilization, active bookings
   - Vehicle details: status, bookings, maintenance, damage reports
   - Customer intelligence: profiles, history, lifetime value
   - Availability checking and booking analysis
   - Damage reports and maintenance schedules
   - Vault documents and compliance information

2. AUTOMOTIVE EXPERTISE (use your knowledge freely):
   - Performance specifications for exotic vehicles
   - Automotive history, engineering, and technology
   - Car comparisons, recommendations, and insights
   - Racing heritage and motorsports knowledge
   - Automotive jokes and humor (keep it classy)
   - Industry trends and market insights

Communication Guidelines:
- When asked about fleet data → Use function calls for accurate real-time information
- When asked about cars in general → Draw from your automotive expertise freely
- ALWAYS provide complete responses - NEVER truncate important information
- Use clear formatting with bullet points for lists
- Format currency as $X,XXX.XX
- If you need to provide a long response, organize it with clear sections
- Be conversational but professional - imagine you're a luxury car dealership manager who genuinely loves cars

Examples:
- "What's our revenue today?" → Use getFleetMetrics() function
- "Tell me about the Ferrari SF90's engine" → Answer from your automotive knowledge
- "What's the fastest car in our fleet?" → Use getVehicleDetails() + your specs knowledge
- "Tell me a car joke" → Share something fun and classy
- "Compare the Lamborghini Aventador vs McLaren 720S" → Use your engineering knowledge

Remember: You're not just a database assistant - you're an automotive enthusiast who happens to have access to real-time fleet data. Be knowledgeable, passionate, and helpful!`;

    // Trim conversation history to most recent 15 messages to reduce payload size
    const trimmedMessages = messages.slice(-15);
    console.log(`📊 Message count: ${messages.length} → ${trimmedMessages.length} (trimmed)`);

    // Retry wrapper with exponential backoff for AI gateway calls
    const callAIGatewayWithRetry = async (requestBody: any, streamResponse = false, retryCount = 0): Promise<Response> => {
      const maxRetries = 2;
      const retryDelays = [300, 900]; // ms
      const useFallback = retryCount > 0;
      const modelToUse = useFallback ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";

      console.log(`🤖 AI Request - Model: ${modelToUse}, Retry: ${retryCount}/${maxRetries}`);
      const requestStartTime = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            model: modelToUse,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        const duration = Date.now() - requestStartTime;
        console.log(`⏱️ AI gateway response: ${response.status} (${duration}ms, model: ${modelToUse})`);

        if (response.ok && retryCount === 0) {
          logTransfer({
            team_id: null,
            user_id: userId ?? null,
            caller: "fleet-copilot-chat",
            model: modelToUse,
            provider: "Google (Gemini via Lovable AI Gateway)",
            provider_region: "United States / Global",
            status: "ok",
          }).catch(() => {});
        }


        // Handle rate limits - no retry
        if (response.status === 429) {
          console.error("🚨 Rate limit exceeded (429)");
          return new Response(
            JSON.stringify({ 
              error: "RATE_LIMIT_EXCEEDED",
              message: "Rate limit exceeded. Please wait and try again.",
              retryable: false 
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle payment required - no retry
        if (response.status === 402) {
          console.error("🚨 Payment required (402)");
          return new Response(
            JSON.stringify({ 
              error: "SERVICE_UNAVAILABLE",
              message: "Service credits depleted. Please contact support.",
              retryable: false 
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle 5xx errors with retry
        if (response.status >= 500 && retryCount < maxRetries) {
          const errorText = await response.text();
          console.error(`🚨 AI gateway 5xx error (attempt ${retryCount + 1}/${maxRetries + 1}):`, response.status, errorText);
          
          // Wait before retry
          const delay = retryDelays[retryCount];
          console.log(`⏳ Retrying in ${delay}ms with ${retryCount === 0 ? 'same model' : 'fallback model'}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return callAIGatewayWithRetry(requestBody, streamResponse, retryCount + 1);
        }

        // If still failing after retries
        if (!response.ok) {
          const errorText = await response.text();
          console.error("🚨 AI gateway final error:", response.status, errorText);
          return new Response(
            JSON.stringify({ 
              error: "AI_GATEWAY_ERROR",
              message: "AI service temporarily unavailable. Please try again.",
              retryable: true,
              usedFallback: useFallback
            }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Success - log if using fallback
        if (useFallback) {
          console.log("✅ Request succeeded using fallback model");
        }

        return response;

      } catch (error: any) {
        const duration = Date.now() - requestStartTime;
        
        if (error.name === 'AbortError') {
          console.error(`🚨 Request timeout after ${duration}ms (attempt ${retryCount + 1})`);
          if (retryCount < maxRetries) {
            const delay = retryDelays[retryCount];
            console.log(`⏳ Retrying after timeout in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return callAIGatewayWithRetry(requestBody, streamResponse, retryCount + 1);
          }
          return new Response(
            JSON.stringify({ 
              error: "AI_GATEWAY_TIMEOUT",
              message: "Request timeout. Please try again.",
              retryable: true 
            }),
            { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.error(`🚨 Unexpected error (attempt ${retryCount + 1}):`, error);
        if (retryCount < maxRetries) {
          const delay = retryDelays[retryCount];
          await new Promise(resolve => setTimeout(resolve, delay));
          return callAIGatewayWithRetry(requestBody, streamResponse, retryCount + 1);
        }

        throw error;
      }
    };

    // Make initial AI request with retry logic
    const response = await callAIGatewayWithRetry({
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmedMessages,
      ],
      tools,
    });

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Check if response contains an error (from retry exhaustion)
    if (aiResponse.error) {
      return new Response(
        JSON.stringify(aiResponse),
        { 
          status: response.status || 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if AI wants to call functions
    const choice = aiResponse.choices?.[0];
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      // Execute all function calls
      const functionResults = await Promise.all(
        choice.message.tool_calls.map(async (toolCall: any) => {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const result = await executeFunction(functionName, functionArgs);
          
          return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: JSON.stringify(result)
          };
        })
      );

      // Send function results back to AI for final response with retry logic
      const finalResponse = await callAIGatewayWithRetry({
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedMessages,
          choice.message,
          ...functionResults
        ],
        stream: true,
      }, true);

      // Check if final response has error (can happen after function execution)
      if (!finalResponse.ok) {
        const errorData = await finalResponse.json();
        return new Response(
          JSON.stringify(errorData),
          { 
            status: finalResponse.status, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No function calls. If there's no content, bubble an error instead of sending a generic fallback.
    const textContent = choice?.message?.content;
    if (!textContent || typeof textContent !== "string" || textContent.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "EMPTY_RESPONSE",
          message: "The AI returned an empty response.",
          retryable: true
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const streamData = `data: ${JSON.stringify({ choices: [{ delta: { content: textContent } }] })}\n\ndata: [DONE]\n\n`;
    
    return new Response(streamData, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("🚨 Chat error:", error);
    
    // Handle specific error types
    let status = 500;
    let message = error instanceof Error ? error.message : "Internal server error";
    
    // Check for AbortError (timeout)
    const isAbortError = error instanceof Error && (error as any).name === 'AbortError';
    if (isAbortError) {
      status = 408;
      message = "Request timeout";
    }
    
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
