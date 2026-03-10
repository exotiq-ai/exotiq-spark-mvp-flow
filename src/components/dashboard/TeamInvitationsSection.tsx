import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Mail, 
  Clock, 
  RefreshCw,
  Trash2,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";
import { InviteUserDialog } from "@/components/dialogs/InviteUserDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string | null;
}

export const TeamInvitationsSection = () => {
  const { toast } = useToast();
  
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      toast({
        title: "Error",
        description: "Failed to load invitations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleResend = async (invitation: PendingInvitation) => {
    setActionLoading(invitation.id);
    try {
      // Update expires_at to extend the invitation
      const { error } = await supabase
        .from("user_invitations")
        .update({ 
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
        })
        .eq("id", invitation.id);

      if (error) throw error;

      toast({
        title: "Invitation resent",
        description: `Invitation to ${invitation.email} has been extended`,
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Failed to resend invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (invitation: PendingInvitation) => {
    setActionLoading(invitation.id);
    try {
      const { error } = await supabase
        .from("user_invitations")
        .delete()
        .eq("id", invitation.id);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: `Invitation to ${invitation.email} has been cancelled`,
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Failed to cancel invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          {[1, 2].map(i => (
            <div key={i} className="flex items-center justify-between py-4 border-b">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pending Invitations</h3>
              <p className="text-sm text-muted-foreground">
                {invitations.length} pending invitation{invitations.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </div>

          <div className="divide-y">
            {invitations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pending invitations</p>
                <p className="text-sm">Invite team members to get started</p>
              </div>
            ) : (
              invitations.map((invitation) => {
                const expired = isExpired(invitation.expires_at);
                
                return (
                  <div key={invitation.id} className="flex items-center justify-between py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{invitation.email}</span>
                        <Badge variant="outline">{invitation.role}</Badge>
                        {expired && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Sent {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResend(invitation)}
                        disabled={actionLoading === invitation.id}
                      >
                        {actionLoading === invitation.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Resend
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(invitation)}
                        disabled={actionLoading === invitation.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={fetchInvitations}
      />
    </>
  );
};