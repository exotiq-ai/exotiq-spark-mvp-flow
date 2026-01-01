import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { conversationId, userId } = await req.json();

    if (!conversationId || !userId) {
      throw new Error('Missing required parameters: conversationId and userId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get conversation details with messages
    const { data: conversation, error: convError } = await supabase
      .from('rari_conversations')
      .select(`
        *,
        rari_messages (
          id,
          role,
          content,
          entities,
          timestamp
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw new Error('Failed to fetch conversation');
    }

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Format the summary
    const summary = formatConversationSummary(conversation);

    // Create a system conversation for Rari summaries if it doesn't exist
    let summariesConversationId: string;
    
    const { data: existingConv } = await supabase
      .from('team_conversations')
      .select('id')
      .eq('name', 'Rari Summaries')
      .single();
    
    if (existingConv) {
      summariesConversationId = existingConv.id;
    } else {
      // Create the system conversation
      const { data: newConv, error: convCreateError } = await supabase
        .from('team_conversations')
        .insert({
          name: 'Rari Summaries',
          type: 'direct',
          is_system: true,
        })
        .select()
        .single();
      
      if (convCreateError || !newConv) {
        console.error('Failed to create summaries conversation:', convCreateError);
        throw new Error('Failed to create summaries conversation');
      }
      
      summariesConversationId = newConv.id;
    }

    // Send summary as a message
    const { error: messageError } = await supabase
      .from('team_messages')
      .insert({
        conversation_id: summariesConversationId,
        sender_id: 'system', // System/bot user
        content: summary,
        metadata: {
          type: 'rari_summary',
          rari_conversation_id: conversationId,
          message_count: conversation.message_count,
          duration: conversation.duration_seconds,
        },
      });

    if (messageError) {
      console.error('Error sending summary message:', messageError);
      throw new Error('Failed to send summary message');
    }

    // Create participant entry for the user if needed
    await supabase
      .from('conversation_participants')
      .upsert({
        conversation_id: summariesConversationId,
        user_id: userId,
        joined_at: new Date().toISOString(),
      }, {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: true,
      });

    console.log('[Rari Message Summary] Summary sent to user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Summary sent to your messages',
        conversationId: summariesConversationId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[Rari Message Summary] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send summary',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatConversationSummary(conversation: any): string {
  const messages = conversation.rari_messages || [];
  const messageCount = conversation.message_count || messages.length;
  const startTime = new Date(conversation.started_at);
  const endTime = conversation.ended_at ? new Date(conversation.ended_at) : new Date();
  const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

  // Extract key topics and entities
  const allEntities = messages
    .flatMap((msg: any) => msg.entities || [])
    .filter((entity: any, index: number, self: any[]) => 
      index === self.findIndex((e) => e.value === entity.value && e.type === entity.type)
    );

  // Group entities by type
  const entityGroups = allEntities.reduce((acc: any, entity: any) => {
    if (!acc[entity.type]) acc[entity.type] = [];
    acc[entity.type].push(entity.displayText);
    return acc;
  }, {});

  // Extract key points (first and last few messages)
  const keyMessages = [
    ...messages.slice(0, 2),
    ...messages.slice(-2),
  ].filter((msg: any, index: number, self: any[]) => 
    index === self.findIndex((m) => m.id === msg.id)
  );

  // Build summary
  let summary = `## 🤖 Rari Conversation Summary\n\n`;
  summary += `**📅 Date:** ${startTime.toLocaleString()}\n`;
  summary += `**⏱️ Duration:** ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}\n`;
  summary += `**💬 Messages:** ${messageCount}\n\n`;

  // Add discussed topics
  if (Object.keys(entityGroups).length > 0) {
    summary += `### 📋 Topics Discussed:\n`;
    if (entityGroups.customer) {
      summary += `• **Customers:** ${entityGroups.customer.slice(0, 3).join(', ')}${entityGroups.customer.length > 3 ? '...' : ''}\n`;
    }
    if (entityGroups.booking) {
      summary += `• **Bookings:** ${entityGroups.booking.slice(0, 3).join(', ')}${entityGroups.booking.length > 3 ? '...' : ''}\n`;
    }
    if (entityGroups.vehicle) {
      summary += `• **Vehicles:** ${entityGroups.vehicle.slice(0, 3).join(', ')}${entityGroups.vehicle.length > 3 ? '...' : ''}\n`;
    }
    summary += `\n`;
  }

  // Add key messages
  if (keyMessages.length > 0) {
    summary += `### 💡 Key Points:\n`;
    keyMessages.forEach((msg: any) => {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const role = msg.role === 'user' ? 'You' : 'Rari';
      const preview = msg.content.length > 100 
        ? msg.content.substring(0, 100) + '...' 
        : msg.content;
      summary += `• **[${time}] ${role}:** ${preview}\n`;
    });
    summary += `\n`;
  }

  summary += `---\n`;
  summary += `💼 *View full conversation in Rari history*\n`;
  summary += `🔗 Conversation ID: \`${conversation.id}\``;

  return summary;
}
