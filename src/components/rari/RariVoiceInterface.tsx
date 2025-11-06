import { useState } from 'react';
import { Phone, PhoneOff, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConversation } from '@11labs/react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';

export const RariVoiceInterface = () => {
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  
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
    },
    onMessage: (message) => {
      console.log('Rari message:', message);
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
      // Request microphone access first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('Microphone access granted, fetching session...');
      
      // Get signed URL from backend
      const { data, error } = await supabase.functions.invoke('elevenlabs-session');
      
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
        signedUrl: data.signed_url 
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
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <div className={`p-4 rounded-full transition-all ${
            isSpeaking 
              ? 'bg-primary/20 animate-pulse' 
              : isConnected 
                ? 'bg-primary/10' 
                : 'bg-muted'
          }`}>
            {isConnected ? (
              <Phone className={`w-8 h-8 ${isSpeaking ? 'text-primary animate-pulse' : 'text-primary'}`} />
            ) : (
              <PhoneOff className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Rari AI Assistant</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isConnected 
              ? isSpeaking 
                ? "Rari is speaking..."
                : "Listening... speak naturally"
              : "Voice-powered fleet management assistant"}
          </p>
          
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
            <div className="text-xs text-left text-muted-foreground space-y-2 max-w-sm mx-auto">
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
            
            <Button 
              className="w-full" 
              onClick={handleStartConversation}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Conversation
                </>
              )}
            </Button>
          </>
        ) : (
          <Button 
            className="w-full" 
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
  );
};
