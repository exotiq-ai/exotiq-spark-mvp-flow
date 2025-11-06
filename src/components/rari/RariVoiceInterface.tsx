import { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Placeholder component until ElevenLabs agent is properly configured
export const RariVoiceInterface = () => {
  const { toast } = useToast();
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    setIsConfigured(!!agentId);
  }, []);

  const handleSetupClick = () => {
    toast({
      title: "ElevenLabs Configuration Required",
      description: "Please configure your ElevenLabs Conversational AI agent to enable Rari voice features.",
    });
  };

  if (!isConfigured) {
    return (
      <Card className="p-6 glass-card">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="p-3 rounded-full bg-muted">
              <MicOff className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Rari AI Assistant</h3>
            <p className="text-sm text-muted-foreground mb-4">
              ElevenLabs Conversational AI integration ready for setup
            </p>
            
            <Badge variant="outline" className="mb-4">
              Configuration Required
            </Badge>
            
            <div className="text-xs text-left text-muted-foreground space-y-2 max-w-sm mx-auto">
              <p className="font-medium">To activate Rari:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Configure agent at elevenlabs.io</li>
                <li>Add 13 Custom Tools (fleet operations)</li>
                <li>Set VITE_ELEVENLABS_AGENT_ID in .env</li>
                <li>Configure webhook URLs to elevenlabs-tools function</li>
              </ol>
            </div>
          </div>
          
          <Button onClick={handleSetupClick} variant="outline" size="sm">
            View Setup Instructions
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 glass-card">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Mic className="w-6 h-6 text-primary" />
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Rari AI Assistant</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Voice-powered fleet management assistant
          </p>
          
          <Badge className="bg-success/10 text-success border-success/20">
            Ready to Use
          </Badge>
        </div>
        
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
        
        <Button className="w-full" onClick={handleSetupClick}>
          <Mic className="w-4 h-4 mr-2" />
          Complete Setup to Start
        </Button>
      </div>
    </Card>
  );
};
