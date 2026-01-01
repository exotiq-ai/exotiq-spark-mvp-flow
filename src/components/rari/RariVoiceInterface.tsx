import { useState } from 'react';
import { Phone, PhoneOff, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AIThinking } from '@/components/ui/ai-thinking';
import { RariVoiceWaveform } from './RariVoiceWaveform';
import { RariTranscript } from './RariTranscript';
import { useRariConversationPersistence } from '@/hooks/useRariConversationPersistence';
import { useEntityDetection } from '@/hooks/useEntityDetection';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const RariVoiceInterface = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationDbId, setConversationDbId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationStartTime, setConversationStartTime] = useState<Date | undefined>();
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  
  const { startConversation, saveMessage, endConversation } = useRariConversationPersistence();
  
  const conversation = useConversation({
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
      console.log('[DEBUG] Message structure:', {
        type: message?.type,
        hasUserTranscript: !!message?.user_transcription_event?.user_transcript,
        hasPartialTranscript: !!message?.user_transcription_event?.user_transcript_partial,
        hasAgentResponse: !!message?.agent_response_event?.agent_response,
        hasLegacyMessage: !!message?.message,
        legacySource: message?.source,
        allKeys: Object.keys(message || {})
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:54',message:'onMessage raw event',data:{messageType:message?.type,hasUserTranscript:!!message?.user_transcription_event?.user_transcript,hasPartialTranscript:!!message?.user_transcription_event?.user_transcript_partial,hasAgentResponse:!!message?.agent_response_event?.agent_response,hasLegacyMessage:!!message?.message,legacySource:message?.source,allKeys:Object.keys(message||{})},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
      // #endregion
      
      // Handle user transcript (what user said via STT)
      if (message.type === 'user_transcript') {
        // Handle partial transcript for real-time display
        if (message.user_transcription_event?.user_transcript_partial) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:60',message:'Setting partial transcript',data:{partial:message.user_transcription_event.user_transcript_partial},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
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
          
          console.log('[DEBUG] USER TRANSCRIPT - Adding to messages:', { 
            content: transcript, 
            hasConversationDbId: !!conversationDbId, 
            conversationDbId 
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:72',message:'User transcript - adding to messages',data:{content:transcript,hasConversationDbId:!!conversationDbId,conversationDbId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
          // #endregion
          
          setMessages(prev => [...prev, newMessage]);
          
          if (conversationDbId) {
            setTimeout(() => {
              saveMessage(conversationDbId, newMessage, []).catch(err => {
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
        
        console.log('[DEBUG] AGENT RESPONSE - Adding to messages:', { 
          content: response, 
          hasConversationDbId: !!conversationDbId, 
          conversationDbId 
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:95',message:'Agent response - adding to messages',data:{content:response,hasConversationDbId:!!conversationDbId,conversationDbId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
        // #endregion
        
        setMessages(prev => [...prev, newMessage]);
        
        if (conversationDbId) {
          setTimeout(() => {
            saveMessage(conversationDbId, newMessage, []).catch(err => {
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
        
        console.log('[DEBUG] LEGACY FORMAT - Adding to messages:', { 
          content: String(message.message), 
          role: newMessage.role,
          hasConversationDbId: !!conversationDbId, 
          conversationDbId 
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:114',message:'Legacy format - adding to messages',data:{content:String(message.message),role:newMessage.role,hasConversationDbId:!!conversationDbId,conversationDbId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
        // #endregion
        
        setMessages(prev => [...prev, newMessage]);
        
        if (conversationDbId) {
          setTimeout(() => {
            saveMessage(conversationDbId, newMessage, []).catch(err => {
              console.warn('Failed to save message to database:', err);
            });
          }, 0);
        }
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:128',message:'onMessage exit',data:{messagesLength:messages.length+1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
        body: { userId: user.id }
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
      const id = await conversation.startSession({ 
        signedUrl: data.signed_url,
        overrides: {
          agent: {
            language: 'en',
          }
        }
      });
      
      console.log('Session started successfully:', id);
      setConversationId(id);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:127',message:'Before startConversation call',data:{sessionId:id,hasUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion
      
      // Start conversation in database (non-blocking - don't wait for it)
      startConversation(id).then((dbId) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7d901188-de6c-4c82-b7ab-2c69e41fa20a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RariVoiceInterface.tsx:133',message:'After startConversation call',data:{dbId,hasDbId:!!dbId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
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
          <div className={`p-4 rounded-full transition-all duration-300 ${
            isSpeaking 
              ? 'bg-gulf-blue/30 shadow-[0_0_30px_rgba(37,150,190,0.4)]' 
              : isConnected 
                ? 'bg-gulf-blue/20 shadow-[0_0_20px_rgba(37,150,190,0.2)]' 
                : 'bg-muted'
          }`}>
            {isConnected ? (
              <Phone className={`w-8 h-8 text-gulf-blue transition-all ${isSpeaking ? 'animate-pulse-soft' : ''}`} />
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
