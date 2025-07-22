
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  RotateCcw, 
  Eye, 
  Users, 
  X 
} from "lucide-react";
import { useDemo } from "@/contexts/DemoContext";
import { useState } from "react";

export const DemoBanner = () => {
  const { demoState, resetDemoData, setPersona } = useDemo();
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg"
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          Demo Mode
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary/95 to-accent/95 backdrop-blur-sm border-b border-primary/20">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
              <span className="font-semibold text-primary-foreground">
                🚀 ExotIQ.ai Demo Environment
              </span>
            </div>
            
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-white/30">
              <Users className="w-3 h-3 mr-1" />
              {demoState.user.role}
            </Badge>
            
            <span className="text-primary-foreground/80 text-sm hidden sm:inline">
              Welcome, {demoState.user.name} • {demoState.user.location}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={demoState.persona}
              onChange={(e) => setPersona(e.target.value)}
              className="bg-white/20 text-primary-foreground border border-white/30 rounded px-2 py-1 text-sm"
            >
              <option value="fleet-owner">Fleet Owner</option>
              <option value="operations-manager">Operations Manager</option>
              <option value="business-owner">Business Owner</option>
            </select>

            <Button
              onClick={resetDemoData}
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-white/20"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset Data
            </Button>

            <Button
              onClick={() => setIsMinimized(true)}
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-primary-foreground/70">
          💡 This is a live demo with realistic data. All interactions are simulated to showcase ExotIQ.ai's capabilities.
        </div>
      </div>
    </div>
  );
};
