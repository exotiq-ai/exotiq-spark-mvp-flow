import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Megaphone } from "lucide-react";

interface Recipient {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface MentionConfirmDialogProps {
  open: boolean;
  recipients: Recipient[];
  hasGroupMention: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const MentionConfirmDialog = ({
  open,
  recipients,
  hasGroupMention,
  onConfirm,
  onCancel,
}: MentionConfirmDialogProps) => {
  const count = recipients.length;
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasGroupMention && <Megaphone className="h-4 w-4 text-destructive" />}
            Notify {count} {count === 1 ? "person" : "people"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasGroupMention
              ? "This message includes a group mention. Everyone listed below will be notified by email and Slack (if enabled)."
              : "Everyone listed below will be notified."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[200px] overflow-y-auto -mx-1">
          <div className="flex flex-wrap gap-2 px-1">
            {recipients.slice(0, 30).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-1.5 bg-muted rounded-full pl-0.5 pr-2 py-0.5"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={r.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px]">
                    {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{r.name}</span>
              </div>
            ))}
            {recipients.length > 30 && (
              <span className="text-xs text-muted-foreground self-center">
                +{recipients.length - 30} more
              </span>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Send to {count}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
