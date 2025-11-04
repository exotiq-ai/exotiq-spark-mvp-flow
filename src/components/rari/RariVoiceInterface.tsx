import { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Mic, MicOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const RariVoiceInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  // ElevenLabs Conversational AI hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('✅ Rari connected');
      toast({
        title: "Connected to Rari",
        description: "Voice assistant is ready",
      });
    },
    onDisconnect: () => {
      console.log('❌ Rari disconnected');
    },
    onMessage: (message) => {
      console.log('📨 Message from Rari:', message);
      
      // Handle user transcripts
      if (message.type === 'user_transcript') {
        setMessages(prev => [...prev, {
          role: 'user',
          content: message.user_transcript.transcript || '',
          timestamp: Date.now()
        }]);
      }
      
      // Handle assistant responses
      if (message.type === 'agent_response') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: message.agent_response.text || '',
          timestamp: Date.now()
        }]);
      }
    },
    onError: (error) => {
      console.error('❌ Rari error:', error);
      toast({
        title: "Connection Error",
        description: error.message || "Failed to connect to Rari",
        variant: "destructive",
      });
    },
  });

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const startConversation = async () => {
    try {
      // Get auth token for backend tool calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to use Rari",
          variant: "destructive",
        });
        return;
      }

      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start ElevenLabs conversation with your agent ID
      await conversation.startSession({
        agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID, // Set this in your environment
      });

      setMessages([{
        role: 'assistant',
        content: "Hey! I'm Rari, your FleetCopilot AI. What can I help you with today?",
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to use voice features",
        variant: "destructive",
      });
    }
  };

  const stopConversation = async () => {
    try {
      await conversation.endSession();
      toast({
        title: "Session Ended",
        description: "Rari conversation has been stopped",
      });
    } catch (error) {
      console.error('Failed to stop conversation:', error);
    }
  };

  const { status, isSpeaking } = conversation;
  const isConnected = status === 'connected';

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${isConnected ? 'bg-primary/20' : 'bg-muted'}`}>
              <Mic className={`h-6 w-6 ${isConnected ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Rari AI Assistant</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    {isConnected ? (isSpeaking ? 'Speaking...' : 'Listening...') : 'Ready to connect'}
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <Button
                onClick={startConversation}
                disabled={!isOnline}
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                Start Voice Chat
              </Button>
            ) : (
              <Button
                onClick={stopConversation}
                variant="destructive"
                className="gap-2"
              >
                <MicOff className="h-4 w-4" />
                End Session
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Status Indicator */}
      {isConnected && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            {isSpeaking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Rari is speaking...</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Listening... speak now</span>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.length === 0 && !isConnected && (
              <div className="text-center text-muted-foreground py-12">
                <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Start a conversation with Rari</p>
                <p className="text-sm mt-2">Click "Start Voice Chat" to begin</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm font-medium mb-1">
                    {msg.role === 'user' ? 'You' : 'Rari'}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Quick Actions */}
      {!isConnected && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Try asking Rari about:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              "Fleet metrics for this month",
              "Top performing vehicles",
              "Upcoming maintenance",
              "Recent bookings",
              "Customer lifetime value",
              "Revenue analysis"
            ].map((example, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2 px-3"
                disabled={!isConnected}
              >
                {example}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
