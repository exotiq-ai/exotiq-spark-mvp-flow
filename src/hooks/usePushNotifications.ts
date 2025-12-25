import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Push notifications enabled');
        return true;
      } else if (result === 'denied') {
        toast.error('Push notifications blocked. Please enable in browser settings.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable push notifications');
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/lovable-uploads/e505c73d-8d32-4327-be34-164145aa687c.png',
        badge: '/lovable-uploads/e505c73d-8d32-4327-be34-164145aa687c.png',
        tag: 'exotiq-notification',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const notifyMention = useCallback((senderName: string, message: string) => {
    return sendNotification(`${senderName} mentioned you`, {
      body: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      tag: 'mention',
    });
  }, [sendNotification]);

  const notifyMessage = useCallback((senderName: string, message: string) => {
    return sendNotification(`New message from ${senderName}`, {
      body: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      tag: 'message',
    });
  }, [sendNotification]);

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    notifyMention,
    notifyMessage,
  };
};
