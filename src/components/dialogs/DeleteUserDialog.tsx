import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserToDelete {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserToDelete | null;
  onSuccess?: () => void;
}

export function DeleteUserDialog({ open, onOpenChange, user, onSuccess }: DeleteUserDialogProps) {
  const { toast } = useToast();
  const { currentTeam } = useTeam();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user || !confirmed) return;

    setIsDeleting(true);

    try {
      // Get current user for audit log
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error("Not authenticated");
      }

      // Get user's current role for audit
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role, permissions")
        .eq("user_id", user.id)
        .single();

      // Delete user role
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // Log to audit
      await supabase.from("role_audit_log").insert({
        user_id: user.id,
        changed_by: currentUser.id,
        action: "user_deleted",
        old_role: userRole?.role || user.role,
        old_permissions: userRole?.permissions || [],
        metadata: {
          deleted_user_email: user.email,
          deleted_user_name: user.name,
          reason: reason || "No reason provided",
        },
        team_id: currentTeam?.id,
      });

      toast({
        title: "User removed",
        description: `${user.name}'s access has been revoked`,
      });

      // Reset form
      setReason("");
      setConfirmed(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({
        title: "Failed to remove user",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason("");
      setConfirmed(false);
    }
    onOpenChange(open);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remove User Access
          </DialogTitle>
          <DialogDescription>
            This will revoke all access for this user. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Info */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Role: {user.role}</p>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for removal (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g., No longer with the company"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The user will immediately lose access to all features and data. They will need a new invitation to regain access.
            </AlertDescription>
          </Alert>

          {/* Confirmation Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <label
              htmlFor="confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand this action cannot be undone
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={!confirmed || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
