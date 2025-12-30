import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Feedback {
  id: string;
  user_id: string;
  category: string;
  priority: string;
  status: string;
  user_query: string;
  context: any;
  keywords: string[];
  upvotes: number;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
  assigned_to: string | null;
  estimated_effort: string | null;
  target_version: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

export interface FeedbackComment {
  id: string;
  feedback_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

export interface SubmitFeedbackParams {
  category: string;
  priority: string;
  description: string;
  context?: Record<string, any>;
}

export function useFeedback() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rari_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbackList(data || []);
      return data || [];
    } catch (error: any) {
      console.error("Error loading feedback:", error);
      toast({
        title: "Error loading feedback",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadUserFeedback = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rari_feedback")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbackList(data || []);
      return data || [];
    } catch (error: any) {
      console.error("Error loading user feedback:", error);
      toast({
        title: "Error loading feedback",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async ({ category, priority, description, context }: SubmitFeedbackParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Extract keywords from description
      const keywords = description
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 10);

      const { data: feedback, error: insertError } = await supabase
        .from("rari_feedback")
        .insert({
          user_id: user.id,
          feedback_type: category,
          category: category,
          priority: priority,
          user_query: description,
          context: context || {},
          keywords: keywords,
          status: "new",
          resolved: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Notify admins via edge function (non-blocking)
      supabase.functions.invoke("feedback-notification", {
        body: {
          feedbackId: feedback.id,
          userId: user.id,
          category: category,
          priority: priority,
          userQuery: description,
          context: context,
          notifyAdmins: true,
        },
      }).catch(error => {
        console.error("Failed to send admin notification:", error);
      });

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback. Our team will review it shortly.",
      });

      return feedback;
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateFeedbackStatus = async (
    feedbackId: string,
    updates: Partial<Feedback>
  ) => {
    try {
      const { error } = await supabase
        .from("rari_feedback")
        .update(updates)
        .eq("id", feedbackId);

      if (error) throw error;

      toast({
        title: "Feedback updated",
        description: "The feedback has been successfully updated.",
      });

      return true;
    } catch (error: any) {
      console.error("Error updating feedback:", error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const upvoteFeedback = async (feedbackId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Check if user already upvoted
      const { data: existingUpvote } = await supabase
        .from("feedback_upvotes")
        .select("id")
        .eq("feedback_id", feedbackId)
        .eq("user_id", user.id)
        .single();

      if (existingUpvote) {
        // Remove upvote
        const { error } = await supabase
          .from("feedback_upvotes")
          .delete()
          .eq("feedback_id", feedbackId)
          .eq("user_id", user.id);

        if (error) throw error;

        toast({
          title: "Upvote removed",
          description: "Your upvote has been removed.",
        });
        return false;
      } else {
        // Add upvote
        const { error } = await supabase
          .from("feedback_upvotes")
          .insert({
            feedback_id: feedbackId,
            user_id: user.id,
          });

        if (error) throw error;

        toast({
          title: "Upvoted!",
          description: "Thank you for supporting this feedback.",
        });
        return true;
      }
    } catch (error: any) {
      console.error("Error upvoting feedback:", error);
      toast({
        title: "Upvote failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addComment = async (feedbackId: string, comment: string, isInternal: boolean = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("feedback_comments")
        .insert({
          feedback_id: feedbackId,
          user_id: user.id,
          comment: comment,
          is_internal: isInternal,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Comment added",
        description: "Your comment has been added to the feedback.",
      });

      return data;
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast({
        title: "Comment failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const loadComments = async (feedbackId: string) => {
    try {
      const { data, error } = await supabase
        .from("feedback_comments")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error("Error loading comments:", error);
      toast({
        title: "Error loading comments",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }
  };

  const checkUpvoteStatus = async (feedbackId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      const { data } = await supabase
        .from("feedback_upvotes")
        .select("id")
        .eq("feedback_id", feedbackId)
        .eq("user_id", user.id)
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  };

  return {
    feedbackList,
    loading,
    loadFeedback,
    loadUserFeedback,
    submitFeedback,
    updateFeedbackStatus,
    upvoteFeedback,
    addComment,
    loadComments,
    checkUpvoteStatus,
  };
}
