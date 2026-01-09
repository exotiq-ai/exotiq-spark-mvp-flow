import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useRariInsightsCount } from './useRariInsightsCount';
import { useRariContext } from './useRariContext';

export type RariSidebarState = 'closed' | 'minimized' | 'open';

export interface RariContext {
  type: 'booking' | 'customer' | 'vehicle' | null;
  id: string | null;
  data: any | null;
}

interface UseRariSidebarReturn {
  state: RariSidebarState;
  isOpen: boolean;
  isMinimized: boolean;
  isClosed: boolean;
  isActiveCall: boolean;
  context: RariContext;
  contextLabel: string | null;
  contextSummary: string;
  unreadCount: number;
  urgentCount: number;
  highCount: number;
  open: () => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  setActiveCall: (active: boolean) => void;
  setContext: (context: RariContext) => void;
  clearContext: () => void;
  addConversationTopic: (topic: string) => void;
}

export const useRariSidebar = (): UseRariSidebarReturn => {
  const [persistedState, setPersistedState] = useLocalStorage<RariSidebarState>('rari-sidebar-state', 'closed');
  const [state, setState] = useState<RariSidebarState>(persistedState);
  const [isActiveCall, setIsActiveCall] = useState(false);
  
  // Use the insights count hook for real-time updates
  const { count: unreadCount, urgentCount, highCount } = useRariInsightsCount();
  
  // Use the context hook for entity awareness
  const rariContext = useRariContext();

  // Sync state to localStorage
  useEffect(() => {
    setPersistedState(state);
  }, [state, setPersistedState]);

  const open = useCallback(() => {
    setState('open');
  }, []);

  const close = useCallback(() => {
    setState('closed');
  }, []);

  const minimize = useCallback(() => {
    setState('minimized');
  }, []);

  const toggle = useCallback(() => {
    setState(prev => {
      if (prev === 'open') return 'minimized';
      return 'open';
    });
  }, []);

  const setActiveCall = useCallback((active: boolean) => {
    setIsActiveCall(active);
  }, []);

  // Legacy setContext for manual overrides
  const setContext = useCallback((newContext: RariContext) => {
    // This is a placeholder - the real context comes from URL params via useRariContext
    console.log('Manual context set:', newContext);
  }, []);

  // Build the context object from the hook
  const context: RariContext = {
    type: rariContext.currentEntity.type,
    id: rariContext.currentEntity.id,
    data: rariContext.currentEntity.data,
  };

  return {
    state,
    isOpen: state === 'open',
    isMinimized: state === 'minimized',
    isClosed: state === 'closed',
    isActiveCall,
    context,
    contextLabel: rariContext.getContextLabel(),
    contextSummary: rariContext.getContextSummary(),
    unreadCount,
    urgentCount,
    highCount,
    open,
    close,
    minimize,
    toggle,
    setActiveCall,
    setContext,
    clearContext: rariContext.clearContext,
    addConversationTopic: rariContext.addConversationTopic,
  };
};
