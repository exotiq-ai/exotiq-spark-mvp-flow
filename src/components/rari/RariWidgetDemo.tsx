import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

/**
 * RariWidgetDemo - Alternative Rari implementation using ElevenLabs Widget
 * 
 * BENEFITS:
 * - Built-in transcript display (no custom onMessage handling needed)
 * - Maintained by ElevenLabs (always up-to-date)
 * - Zero SDK version conflicts
 * - Works out of the box
 * 
 * INTEGRATION NOTES:
 * 1. Replace RariVoiceInterface with this component
 * 2. The widget handles transcripts automatically
 * 3. You can still style the container to match your design
 * 4. Listen to widget events via custom event listeners
 */

export const RariWidgetDemo = () => {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [isWidgetLoaded, setIsWidgetLoaded] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);

  useEffect(() => {
    // Load the ElevenLabs widget script dynamically
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed@beta';
    script.async = true;
    script.type = 'text/javascript';
    
    script.onload = () => {
      console.log('✅ ElevenLabs widget script loaded');
      setIsWidgetLoaded(true);
    };

    script.onerror = () => {
      console.error('❌ Failed to load ElevenLabs widget script');
    };

    document.body.appendChild(script);

    // Optional: Listen to widget events
    const handleWidgetEvent = (event: any) => {
      console.log('Widget event:', event.detail);
      
      // You can track conversation state here
      if (event.detail?.type === 'conversation_started') {
        setConversationActive(true);
      } else if (event.detail?.type === 'conversation_ended') {
        setConversationActive(false);
      }
    };

    // Attach event listeners if widget supports custom events
    if (widgetRef.current) {
      widgetRef.current.addEventListener('transcript', handleWidgetEvent);
      widgetRef.current.addEventListener('conversation_state', handleWidgetEvent);
    }

    // Cleanup
    return () => {
      if (widgetRef.current) {
        widgetRef.current.removeEventListener('transcript', handleWidgetEvent);
        widgetRef.current.removeEventListener('conversation_state', handleWidgetEvent);
      }
      // Note: We don't remove the script as it might be used elsewhere
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Left: Info Panel */}
      <Card className="p-4 md:p-6 glass-card lg:w-96 flex-shrink-0">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <MessageSquare className="w-12 h-12 text-gulf-blue" />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Rari AI Assistant</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Voice-powered fleet management with live transcripts
            </p>
            
            <Badge className={
              conversationActive 
                ? "bg-success/10 text-success border-success/20" 
                : "bg-muted text-muted-foreground"
            }>
              {conversationActive ? 'Active Conversation' : 'Ready to Start'}
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
            </ul>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
            <strong>Widget Mode:</strong> Transcripts are built-in!<br/>
            Click the widget to start →
          </div>
        </div>
      </Card>

      {/* Right: ElevenLabs Widget */}
      <div className="flex-1 min-h-0">
        <Card className="p-4 md:p-6 glass-card flex flex-col h-full min-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gulf-blue" />
              Live Conversation
            </h3>
            {isWidgetLoaded && (
              <Badge variant="outline" className="text-xs">
                ✓ Widget Ready
              </Badge>
            )}
          </div>

          {/* Widget Container */}
          <div 
            ref={widgetRef}
            className="flex-1 relative bg-background/50 rounded-lg overflow-hidden"
            style={{ minHeight: '500px' }}
          >
            {!isWidgetLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gulf-blue mx-auto mb-4"></div>
                  <p className="text-sm">Loading ElevenLabs widget...</p>
                </div>
              </div>
            )}
            
            {/* ElevenLabs Widget Web Component */}
            <elevenlabs-convai 
              agent-id="agent_0001k9d5pvdwfmvv7aq0mhaexgd6"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                minHeight: '500px'
              }}
            />
          </div>

          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            💡 <strong>Test:</strong> Click the widget, grant mic permission, and say "Hello Rari". 
            You should see transcripts appear automatically!
          </div>
        </Card>
      </div>
    </div>
  );
};

// TypeScript declaration for the custom web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'agent-id'?: string;
        },
        HTMLElement
      >;
    }
  }
}
