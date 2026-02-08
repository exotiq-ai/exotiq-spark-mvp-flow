import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, any> | null;
  created_at: string;
  timestamp: string; // Formatted for display
}

const ALERTS_SESSION_KEY = "fleet-alerts-checked";

export const useNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const formatNotification = (raw: any): Notification => ({
    id: raw.id,
    type: raw.type,
    title: raw.title,
    message: raw.message,
    read: raw.read,
    data: raw.data,
    created_at: raw.created_at,
    timestamp: formatDistanceToNow(new Date(raw.created_at), { addSuffix: true }),
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []).map(formatNotification));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }, [user, toast]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast({ title: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }, [toast]);

  const clearAll = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setNotifications([]);
      toast({ title: "All notifications cleared" });
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  }, [user, toast]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Trigger proactive alerts once per session
  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(ALERTS_SESSION_KEY)) return;

    const triggerAlerts = async () => {
      try {
        sessionStorage.setItem(ALERTS_SESSION_KEY, "1");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        const { error } = await supabase.functions.invoke("check-fleet-alerts", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (error) {
          console.error("Fleet alerts check failed:", error);
        } else {
          // Refresh notifications to pick up any new ones
          setTimeout(() => fetchNotifications(), 1000);
        }
      } catch (err) {
        console.error("Fleet alerts error:", err);
      }
    };

    triggerAlerts();
  }, [user, fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = formatNotification(payload.new);
          setNotifications((prev) => [newNotification, ...prev]);
          
          // Show toast for new notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh: fetchNotifications,
  };
};