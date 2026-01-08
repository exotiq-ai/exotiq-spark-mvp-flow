import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

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
  open: () => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  setActiveCall: (active: boolean) => void;
  setContext: (context: RariContext) => void;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useRariSidebar = (): UseRariSidebarReturn => {
  const [persistedState, setPersistedState] = useLocalStorage<RariSidebarState>('rari-sidebar-state', 'closed');
  const [state, setState] = useState<RariSidebarState>(persistedState);
  const [isActiveCall, setIsActiveCall] = useState(false);
  const [context, setContextState] = useState<RariContext>({ type: null, id: null, data: null });
  const [unreadCount, setUnreadCountState] = useState(0);

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

  const setUnreadCount = useCallback((count: number) => {
    setUnreadCountState(count);
  }, []);

  const incrementUnread = useCallback(() => {
    setUnreadCountState(prev => prev + 1);
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCountState(0);
  }, []);

  return {
    state,
    isOpen: state === 'open',
    isMinimized: state === 'minimized',
    isClosed: state === 'closed',
    isActiveCall,
    context,
    unreadCount,
    open,
    close,
    minimize,
    toggle,
    setActiveCall,
    setContext,
    setUnreadCount,
    incrementUnread,
    clearUnread,
  };
};
