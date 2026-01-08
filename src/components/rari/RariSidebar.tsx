import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, Maximize2, Sparkles, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RariWidgetInterface } from './RariWidgetInterface';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import type { RariSidebarState, RariContext } from '@/hooks/useRariSidebar';

interface RariSidebarProps {
  state: RariSidebarState;
  isActiveCall: boolean;
  context: RariContext;
  unreadCount: number;
  onOpen: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggle: () => void;
  onActiveCallChange?: (active: boolean) => void;
}

// Floating orb when minimized
const RariOrb = ({
  unreadCount,
  isActiveCall,
  onClick,
}: {
  unreadCount: number;
  isActiveCall: boolean;
  onClick: () => void;
}) => {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50",
        "w-14 h-14 rounded-full",
        "bg-gradient-to-br from-gulf-blue to-gulf-blue/80",
        "shadow-lg hover:shadow-xl",
        "flex items-center justify-center",
        "transition-shadow duration-200",
        isActiveCall && "ring-2 ring-success ring-offset-2 ring-offset-background animate-pulse"
      )}
      aria-label="Open Rari AI Assistant"
    >
      <Sparkles className="h-6 w-6 text-white" />
      
      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      
      {/* Active call indicator */}
      {isActiveCall && (
        <span className="absolute -bottom-1 -right-1 bg-success text-success-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
          <Phone className="h-2.5 w-2.5" />
        </span>
      )}
    </motion.button>
  );
};

// Main sidebar panel
const RariPanel = ({
  isActiveCall,
  context,
  onClose,
  onMinimize,
}: {
  isActiveCall: boolean;
  context: RariContext;
  onClose: () => void;
  onMinimize: () => void;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Swipe to close/minimize on mobile
  const { handlers } = useSwipeGesture({
    onSwipeRight: onMinimize,
    threshold: 100,
  });

  return (
    <>
      {/* Backdrop - semi-transparent, allows clicking through on desktop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-background/40 backdrop-blur-sm z-40 md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
        onClick={onMinimize}
      />
      
      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        {...handlers}
        className={cn(
          "fixed top-0 right-0 h-full z-50",
          "w-full md:w-[420px] lg:w-[480px]",
          "bg-background border-l border-border",
          "shadow-2xl",
          "flex flex-col",
          isActiveCall && "ring-2 ring-inset ring-success/50"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-border",
          "bg-gradient-to-r from-gulf-blue/5 to-transparent"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-gulf-blue to-gulf-blue/80"
            )}>
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Rari AI Assistant</h2>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    isActiveCall 
                      ? "bg-success/10 text-success border-success/20" 
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isActiveCall ? '● Connected' : 'Ready'}
                </Badge>
                {context.type && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Viewing: {context.type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onMinimize}
              aria-label="Minimize Rari"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Close Rari"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Content - Full Widget Interface */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <RariWidgetInterface />
        </div>
        
        {/* Footer - Call status */}
        {isActiveCall && (
          <div className="px-4 py-2 border-t border-border bg-success/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-success animate-pulse" />
                <span className="text-xs text-success font-medium">Voice active</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Speak naturally or click entity links
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
};

export const RariSidebar = ({
  state,
  isActiveCall,
  context,
  unreadCount,
  onOpen,
  onClose,
  onMinimize,
  onToggle,
}: RariSidebarProps) => {
  return (
    <AnimatePresence mode="wait">
      {state === 'minimized' && (
        <RariOrb
          key="orb"
          unreadCount={unreadCount}
          isActiveCall={isActiveCall}
          onClick={onOpen}
        />
      )}
      
      {state === 'open' && (
        <RariPanel
          key="panel"
          isActiveCall={isActiveCall}
          context={context}
          onClose={onClose}
          onMinimize={onMinimize}
        />
      )}
    </AnimatePresence>
  );
};

// Floating trigger button when closed
export const RariSidebarTrigger = ({
  onClick,
  unreadCount = 0,
  className,
}: {
  onClick: () => void;
  unreadCount?: number;
  className?: string;
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40",
        "h-14 px-4 rounded-full",
        "bg-gradient-to-r from-gulf-blue to-gulf-blue/90",
        "text-white font-medium text-sm",
        "shadow-lg hover:shadow-xl",
        "flex items-center gap-2",
        "transition-shadow duration-200",
        className
      )}
      aria-label="Open Rari AI Assistant"
    >
      <Sparkles className="h-5 w-5" />
      <span className="hidden sm:inline">Ask Rari</span>
      
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </motion.button>
  );
};
