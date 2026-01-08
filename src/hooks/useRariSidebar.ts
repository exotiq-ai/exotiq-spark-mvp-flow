import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useRariInsightsCount } from './useRariInsightsCount';

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
  unreadCount: number;
  urgentCount: number;
  highCount: number;
  open: () => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  setActiveCall: (active: boolean) => void;
  setContext: (context: RariContext) => void;
}

export const useRariSidebar = (): UseRariSidebarReturn => {
  const [persistedState, setPersistedState] = useLocalStorage<RariSidebarState>('rari-sidebar-state', 'closed');
  const [state, setState] = useState<RariSidebarState>(persistedState);
  const [isActiveCall, setIsActiveCall] = useState(false);
  const [context, setContextState] = useState<RariContext>({ type: null, id: null, data: null });
  
  // Use the insights count hook for real-time updates
  const { count: unreadCount, urgentCount, highCount } = useRariInsightsCount();

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

  const setContext = useCallback((newContext: RariContext) => {
    setContextState(newContext);
  }, []);

  return {
    state,
    isOpen: state === 'open',
    isMinimized: state === 'minimized',
    isClosed: state === 'closed',
    isActiveCall,
    context,
    unreadCount,
    urgentCount,
    highCount,
    open,
    close,
    minimize,
    toggle,
    setActiveCall,
    setContext,
  };
};
