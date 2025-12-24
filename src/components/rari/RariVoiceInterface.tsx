import { useState } from 'react';
import { Phone, PhoneOff, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConversation } from '@11labs/react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { AIThinking } from '@/components/ui/ai-thinking';
import { RariVoiceWaveform } from './RariVoiceWaveform';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const RariVoiceInterface = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to Rari');
      toast({
        title: "Connected to Rari",
        description: "Voice assistant is ready to help with your fleet.",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from Rari');
      setConversationId(null);
      setMessages([]);
    },
    onMessage: (message) => {
      console.log('Rari message:', message);
      // Safely add messages to history for display
      if (message.message) {
        setMessages(prev => [...prev, {
          role: message.source === 'ai' ? 'assistant' : 'user',
          content: String(message.message),
          timestamp: new Date()
        }]);
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
    await conversation.endSession();
    setConversationId(null);
  };

  const { status, isSpeaking } = conversation;
  const isConnected = status === 'connected';

  return (
    <Card className="p-6 glass-card">
      <div className="space-y-4">
        {/* Message History */}
        {messages.length > 0 && (
          <ScrollArea className="h-[200px] rounded-md border p-4">
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <ReactMarkdown className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Voice Interface */}
        <div className="text-center space-y-4">
        
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
      </div>
    </Card>
  );
};
