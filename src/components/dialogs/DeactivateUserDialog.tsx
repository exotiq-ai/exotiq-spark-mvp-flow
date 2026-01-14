import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserToDeactivate {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DeactivateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserToDeactivate | null;
  onSuccess?: () => void;
}

export function DeactivateUserDialog({ open, onOpenChange, user, onSuccess }: DeactivateUserDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleDeactivate = async () => {
    if (!user || !confirmed) return;

    setIsDeactivating(true);

    try {
      const { error } = await supabase.rpc('deactivate_team_member', {
        target_user_id: user.id,
        reason: reason || null
      });

      if (error) throw error;

      toast({
        title: "User deactivated",
        description: `${user.name}'s access has been suspended`,
      });

      setReason("");
      setConfirmed(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to deactivate user:", error);
      toast({
        title: "Failed to deactivate user",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsDeactivating(false);
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
          <DialogTitle className="flex items-center gap-2 text-warning">
            <UserMinus className="h-5 w-5" />
            Deactivate User
          </DialogTitle>
          <DialogDescription>
            This will suspend the user's access. They can be reactivated later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Role: {user.role}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for deactivation (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g., On leave, temporary suspension"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The user will immediately lose access but can be reactivated at any time by an admin.
            </AlertDescription>
          </Alert>

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
              I understand this will suspend the user's access
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeactivating}>
            Cancel
          </Button>
          <Button 
            variant="default"
            className="bg-warning text-warning-foreground hover:bg-warning/90"
            onClick={handleDeactivate} 
            disabled={!confirmed || isDeactivating}
          >
            {isDeactivating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              <>
                <UserMinus className="mr-2 h-4 w-4" />
                Deactivate User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}