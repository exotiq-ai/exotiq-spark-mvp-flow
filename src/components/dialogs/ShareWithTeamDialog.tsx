import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTeamMessaging } from "@/hooks/useTeamMessaging";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Send, 
  DollarSign,
  AlertTriangle,
  Car,
  Loader2
} from "lucide-react";

interface DamageClaim {
  id: string;
  claim_type: string;
  description: string;
  severity: string;
  claim_status: string | null;
  estimated_cost: number | null;
}

interface ShareWithTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: DamageClaim;
  vehicleName: string;
  vehicleId: string;
}

export function ShareWithTeamDialog({
  open,
  onOpenChange,
  claim,
  vehicleName,
  vehicleId,
}: ShareWithTeamDialogProps) {
  const { teamMembers, createConversation, sendMessage, setActiveConversation } = useTeamMessaging();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [isSending, setIsSending] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-success/10 text-success';
      case 'moderate': return 'bg-warning/10 text-warning';
      case 'major': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const handleSend = async () => {
    if (!selectedMemberId) {
      toast.error("Select a team member", { description: "Please select a team member to share with" });
      return;
    }

    setIsSending(true);

    try {
      // Create or get existing conversation with this team member
      const conversation = await createConversation('direct', [selectedMemberId]);
      
      if (conversation) {
        setActiveConversation(conversation);
        
        // Compose the message
        const message = `🚗 **${vehicleName}** - Damage Claim Update

📋 **Type:** ${claim.claim_type.replace('_', ' ')}
⚠️ **Severity:** ${claim.severity}
📊 **Status:** ${claim.claim_status || 'Open'}
💰 **Estimated Cost:** $${claim.estimated_cost?.toLocaleString() || 0}

📝 **Description:**
${claim.description}

${additionalNote ? `\n💬 **Note:**\n${additionalNote}` : ''}

🔗 [View Claim](/dashboard?module=vault&tab=claims&claimId=${claim.id})`;

        await sendMessage(message);

        toast("Message sent", { description: `Shared damage claim with team member` });

        onOpenChange(false);
        setAdditionalNote("");
        setSelectedMemberId("");
      }
    } catch (error) {
      console.error('Error sharing claim:', error);
      toast.error("Failed to send", { description: "Could not share the damage claim. Please try again." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Share Damage Claim Update
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Claim Preview */}
          <div className="p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-start gap-3 mb-3">
              <Car className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{vehicleName}</h4>
                <p className="text-sm text-muted-foreground capitalize">
                  {claim.claim_type.replace('_', ' ')} damage
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className={getSeverityColor(claim.severity)}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {claim.severity}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {claim.claim_status || 'open'}
              </Badge>
              {claim.estimated_cost && (
                <Badge variant="outline">
                  <DollarSign className="h-3 w-3 mr-0.5" />
                  ${claim.estimated_cost.toLocaleString()}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {claim.description}
            </p>
          </div>

          {/* Team Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="team-member">Send to</Label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger id="team-member">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Add a note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Any additional context or instructions..."
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !selectedMemberId}>
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
