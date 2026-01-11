import { useState, useEffect, useMemo } from 'react';
import { Phone, PhoneOff, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { AIThinking } from '@/components/ui/ai-thinking';
import { RariVoiceWaveform } from './RariVoiceWaveform';
import { RariTranscript } from './RariTranscript';
import { useRariConversationPersistence } from '@/hooks/useRariConversationPersistence';
import { createRariClientTools } from '@/hooks/useRariClientTools';
import { cn } from '@/lib/utils';
import type { RariInterfaceVariant, RecentEntity } from '@/types/rari';
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RariVoiceInterfaceProps {
  variant?: RariInterfaceVariant;
  contextSummary?: string;
  recentEntities?: RecentEntity[];
  onActiveCallChange?: (active: boolean) => void;
}

export const RariVoiceInterface = ({ 
  variant = 'full',
  contextSummary,
  recentEntities,
  onActiveCallChange,
}: RariVoiceInterfaceProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationDbId, setConversationDbId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationStartTime, setConversationStartTime] = useState<Date | undefined>();
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  
  const { startConversation, saveMessage, endConversation } = useRariConversationPersistence();
  
  // Create client tools with user's auth context and team_id
  const clientTools = useMemo(() => {
    if (!user?.id) return {};
    return createRariClientTools(user.id, currentTeam?.id);
  }, [user?.id, currentTeam?.id]);
  
  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      console.log('Connected to Rari');
      setConversationStartTime(new Date());
      toast({
        title: "Connected to Rari",
        description: "Voice assistant is ready to help with your fleet.",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from Rari');
      
      // End conversation in database
      if (conversationDbId) {
        endConversation(conversationDbId);
      }
      
      setConversationId(null);
      setConversationDbId(null);
      setConversationStartTime(undefined);
      setPartialTranscript('');
      // Keep messages for viewing after disconnect
    },
    onMessage: (message: any) => {
      console.log('Rari message event:', message);
      
      // Handle client tool calls
      if (message.type === 'client_tool_call') {
        console.log('Client tool call:', message.client_tool_call);
      }
      
      // Handle user transcript (what user said via STT)
      if (message.type === 'user_transcript') {
        // Handle partial transcript for real-time display
        if (message.user_transcription_event?.user_transcript_partial) {
          setPartialTranscript(message.user_transcription_event.user_transcript_partial);
        }
        
        // Handle final transcript
        if (message.user_transcription_event?.user_transcript) {
          const transcript = message.user_transcription_event.user_transcript;
          setPartialTranscript(''); // Clear partial
          
          const newMessage: Message = {
            role: 'user',
            content: transcript,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, newMessage]);
          
          if (conversationDbId) {
            setTimeout(() => {
              saveMessage(conversationDbId, newMessage).catch(err => {
                console.warn('Failed to save message to database:', err);
              });
            }, 0);
          }
        }
      }
      
      // Handle agent response (what Rari said via TTS)
      if (message.type === 'agent_response' && message.agent_response_event?.agent_response) {
        const response = message.agent_response_event.agent_response;
        
        const newMessage: Message = {
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        if (conversationDbId) {
          setTimeout(() => {
            saveMessage(conversationDbId, newMessage).catch(err => {
              console.warn('Failed to save message to database:', err);
            });
          }, 0);
        }
      }
      
      // Fallback for legacy format (in case SDK structure is different)
      if (message.message) {
        const newMessage: Message = {
          role: message.source === 'ai' ? 'assistant' : 'user',
          content: String(message.message),
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        if (conversationDbId) {
          setTimeout(() => {
            saveMessage(conversationDbId, newMessage).catch(err => {
              console.warn('Failed to save message to database:', err);
            });
          }, 0);
        }
      }
    },
    onError: (error) => {
      console.error('Rari error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to Rari. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartConversation = async () => {
    try {
      if (!user) {
        throw new Error('You must be logged in to use Rari');
      }

      // Request microphone access first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('Microphone access granted, fetching session for user:', user.id);
      
      // Get signed URL from backend with user context
      const { data, error } = await supabase.functions.invoke('elevenlabs-session', {
        body: { 
          userId: user.id,
          context: {
            summary: contextSummary,
            currentEntity: recentEntities?.[0] || null,
            recentEntities: recentEntities?.slice(0, 3),
          }
        }
      });
      
      console.log('Edge function response:', { data, error });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(`Backend error: ${error.message || JSON.stringify(error)}`);
      }
      
      if (!data?.signed_url) {
        console.error('Invalid response data:', data);
        throw new Error('Failed to get session URL from backend. Please check edge function logs.');
      }
      
      console.log('Starting session with signed URL...');
      
      // Build dynamic variables for secure tool calls
      // Primary: tool token for Authorization header (signed JWT with userId + teamId)
      // Fallback: user_id/team_id for conversation_metadata if token fails
      const dynamicVariables: Record<string, string> = {};
      
      if (data.toolToken) {
        // Pass tool token as a secret dynamic variable
        // ElevenLabs will include this in tool call headers as: Authorization: Bearer {{secret__rari_tool_token}}
        dynamicVariables['secret__rari_tool_token'] = data.toolToken;
        console.log('Tool token will be passed to voice session');
      }
      
      // Always pass user identifiers as fallback for conversation_metadata
      dynamicVariables['user_id'] = user.id;
      if (data.teamId) {
        dynamicVariables['team_id'] = data.teamId;
      }
      dynamicVariables['user_name'] = user.user_metadata?.full_name || user.email || 'User';
      
      console.log('Dynamic variables for session:', Object.keys(dynamicVariables));
      
      const id = await conversation.startSession({ 
        // Use WebSocket mode with signed URL (prevents client-side ElevenLabs API calls)
        connectionType: "websocket",
        signedUrl: data.signed_url,
        dynamicVariables,
        overrides: {
          agent: {
            language: 'en',
          }
        }
      });
      
      console.log('Session started successfully:', id);
      setConversationId(id);
      
      // Start conversation in database (non-blocking - don't wait for it)
      startConversation(id).then((dbId) => {
        if (dbId) {
          setConversationDbId(dbId);
        }
      }).catch((err) => {
        console.warn('Database persistence disabled due to error:', err);
        // Continue without database - transcript will still work in memory
      });
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Please allow microphone access and ensure API key is configured.",
        variant: "destructive",
      });
    }
  };

  const handleEndConversation = async () => {
    // End conversation in database
    if (conversationDbId) {
      await endConversation(conversationDbId);
    }
    
    await conversation.endSession();
    setConversationId(null);
    setConversationDbId(null);
    setConversationStartTime(undefined);
  };

  const handleClearTranscript = () => {
    setMessages([]);
  };

  const { status, isSpeaking } = conversation;
  const isConnected = status === 'connected';

  // Notify parent of active call changes
  useEffect(() => {
    onActiveCallChange?.(isConnected);
  }, [isConnected, onActiveCallChange]);

  const isSidebar = variant === 'sidebar';

  // Sample prompts for empty state
  const samplePrompts = [
    "What's my schedule today?",
    "Show me today's revenue",
    "Which vehicles need attention?",
  ];

  // Sidebar variant - compact single-column layout with mic at bottom
  if (isSidebar) {
    return (
      <div className="flex flex-col h-full gap-3">
        {/* Transcript area - shows sample prompts when empty and not connected */}
        <div className="flex-1 min-h-0">
          {!isConnected && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Try asking:</p>
                <div className="flex flex-col gap-2">
                  {samplePrompts.map((prompt, index) => (
                    <Badge 
                      key={index}
                      variant="outline" 
                      className="cursor-default text-xs py-1.5 px-3 bg-muted/30"
                    >
                      "{prompt}"
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <RariTranscript
              messages={messages}
              isConnected={isConnected}
              conversationId={conversationId}
              conversationDbId={conversationDbId}
              startTime={conversationStartTime}
              partialTranscript={partialTranscript}
              onClear={!isConnected && messages.length > 0 ? handleClearTranscript : undefined}
              compact
            />
          )}
        </div>
        
        {/* Controls at BOTTOM - easier thumb reach */}
        <div className="border-t border-border pt-3 space-y-3">
          {/* Status text */}
          <div className="flex items-center justify-center gap-2">
            <RariVoiceWaveform 
              isActive={isConnected} 
              isSpeaking={isSpeaking}
              className="w-12 flex-shrink-0"
            />
            <div className="text-center">
              {isConnected && isSpeaking ? (
                <AIThinking variant="gradient" text="Speaking..." className="text-xs" />
              ) : isConnected ? (
                <AIThinking variant="wave" text="Listening..." className="text-xs" />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Voice-powered assistant
                </p>
              )}
            </div>
          </div>
          
          {/* Large mic button */}
          {!isConnected ? (
            status === 'connecting' ? (
              <div className="flex justify-center">
                <AIThinking variant="gradient" text="Connecting..." />
              </div>
            ) : (
              <Button 
                size="lg"
                className="w-full bg-rari-blue hover:bg-rari-blue-dark text-slate-800 group"
                onClick={handleStartConversation}
              >
                <Mic className="w-5 h-5 mr-2 group-hover:animate-pulse-soft" />
                Start Conversation
              </Button>
            )
          ) : (
            <Button 
              size="lg"
              variant="destructive"
              className="w-full"
              onClick={handleEndConversation}
            >
              <PhoneOff className="w-5 h-5 mr-2" />
              End Conversation
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Full variant - two-column layout (original)
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Left: Voice Interface - Compact on mobile, side-by-side on desktop */}
      <Card className="p-4 md:p-6 glass-card lg:w-96 flex-shrink-0">
        <div className="text-center space-y-3 md:space-y-4">
        
        {/* Animated Waveform */}
        <div className="flex items-center justify-center">
          <RariVoiceWaveform 
            isActive={isConnected} 
            isSpeaking={isSpeaking}
            className="w-32"
          />
        </div>
        
        {/* Connection Status Icon */}
        <div className="flex items-center justify-center">
          <div className={cn(
            "p-4 rounded-full transition-all duration-300",
            isSpeaking 
              ? 'bg-gulf-blue/30 shadow-[0_0_30px_rgba(37,150,190,0.4)]' 
              : isConnected 
                ? 'bg-gulf-blue/20 shadow-[0_0_20px_rgba(37,150,190,0.2)]' 
                : 'bg-muted'
          )}>
            {isConnected ? (
              <Phone className={cn("w-8 h-8 text-gulf-blue transition-all", isSpeaking && 'animate-pulse-soft')} />
            ) : (
              <PhoneOff className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Rari AI Assistant</h3>
          
          {/* AI Thinking State */}
          {isConnected && isSpeaking ? (
            <AIThinking variant="gradient" text="Rari is speaking..." className="mb-4" />
          ) : isConnected ? (
            <AIThinking variant="wave" text="Listening... speak naturally" className="mb-4" />
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              Voice-powered fleet management assistant
            </p>
          )}
          
          <Badge className={
            isConnected 
              ? "bg-success/10 text-success border-success/20" 
              : "bg-muted text-muted-foreground"
          }>
            {isConnected ? 'Connected' : 'Ready to Connect'}
          </Badge>
        </div>
        
        {!isConnected ? (
          <>
            <div className="text-xs text-left text-muted-foreground space-y-2 max-w-sm mx-auto mb-4">
              <p className="font-medium">Rari can help you with:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Fleet performance metrics</li>
                <li>Vehicle availability checks</li>
                <li>Booking management</li>
                <li>Revenue analysis</li>
                <li>Customer insights</li>
                <li>Maintenance scheduling</li>
              </ul>
            </div>

            {/* Quick Action Suggestions */}
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick Commands:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="outline" className="cursor-default text-xs">
                  "Show me today's revenue"
                </Badge>
                <Badge variant="outline" className="cursor-default text-xs">
                  "Check Ferrari availability"
                </Badge>
                <Badge variant="outline" className="cursor-default text-xs">
                  "List upcoming bookings"
                </Badge>
              </div>
            </div>
            
            {status === 'connecting' ? (
              <AIThinking variant="gradient" text="Connecting to Rari..." />
            ) : (
              <Button 
                className="w-full group hover:scale-105 active:scale-95 transition-all duration-300" 
                onClick={handleStartConversation}
              >
                <Mic className="w-4 h-4 mr-2 group-hover:animate-pulse-soft" />
                Start Conversation
              </Button>
            )}
          </>
        ) : (
          <Button 
            className="w-full hover:scale-105 active:scale-95 transition-all duration-300" 
            variant="destructive"
            onClick={handleEndConversation}
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            End Conversation
          </Button>
        )}
        
        {conversationId && (
          <p className="text-xs text-muted-foreground">
            Session: {conversationId.slice(0, 8)}...
          </p>
        )}
        </div>
      </Card>

      {/* Right: Live Transcript - Full width on mobile, fills remaining space on desktop */}
      <div className="flex-1 min-h-0">
        <RariTranscript
          messages={messages}
          isConnected={isConnected}
          conversationId={conversationId}
          conversationDbId={conversationDbId}
          startTime={conversationStartTime}
          partialTranscript={partialTranscript}
          onClear={!isConnected && messages.length > 0 ? handleClearTranscript : undefined}
        />
      </div>
    </div>
  );
};
