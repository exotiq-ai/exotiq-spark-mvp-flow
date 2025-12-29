import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageSquare, Lightbulb, Bug, Zap, HelpCircle, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FeedbackSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContext?: Record<string, any>;
}

const categoryOptions = [
  { value: "feature_request", label: "Feature Request", icon: Lightbulb, description: "Suggest a new feature" },
  { value: "bug_report", label: "Bug Report", icon: Bug, description: "Report an issue or bug" },
  { value: "improvement", label: "Improvement", icon: Zap, description: "Suggest an improvement" },
  { value: "question", label: "Question", icon: HelpCircle, description: "Ask a question" },
  { value: "other", label: "Other", icon: FileText, description: "Other feedback" },
];

const priorityOptions = [
  { value: "low", label: "Low", description: "Nice to have" },
  { value: "medium", label: "Medium", description: "Would be helpful" },
  { value: "high", label: "High", description: "Important for my workflow" },
  { value: "critical", label: "Critical", description: "Blocking my work" },
];

export function FeedbackSubmissionDialog({ open, onOpenChange, initialContext }: FeedbackSubmissionDialogProps) {
  const [category, setCategory] = useState<string>("feature_request");
  const [priority, setPriority] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please provide a description of your feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to submit feedback.",
          variant: "destructive",
        });
        return;
      }

      // Extract keywords from description
      const keywords = description
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 10);

      // Insert feedback into database
      const { data: feedback, error: insertError } = await supabase
        .from("rari_feedback")
        .insert({
          user_id: user.id,
          feedback_type: category,
          category: category,
          priority: priority,
          user_query: description,
          context: initialContext || {},
          keywords: keywords,
          status: "new",
          resolved: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Notify admins via edge function
      const notificationPayload = {
        feedbackId: feedback.id,
        userId: user.id,
        category: category,
        priority: priority,
        userQuery: description,
        context: initialContext,
        notifyAdmins: true,
      };

      // Call the notification function (non-blocking)
      supabase.functions.invoke("feedback-notification", {
        body: notificationPayload,
      }).catch(error => {
        console.error("Failed to send admin notification:", error);
        // Don't fail the submission if notification fails
      });

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback. Our team will review it shortly.",
      });

      // Reset form
      setDescription("");
      setCategory("feature_request");
      setPriority("medium");
      onOpenChange(false);

    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categoryOptions.find(opt => opt.value === category);
  const CategoryIcon = selectedCategory?.icon || MessageSquare;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-black border-gold/20">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2 text-white">
            <MessageSquare className="w-6 h-6 text-gold" />
            Submit Feedback
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Help us improve by sharing your thoughts, suggestions, or reporting issues.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label className="text-white">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-dark border-gold/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-dark border-gold/20">
                {categoryOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gold/10">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gold" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-gray-400">{option.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Selection */}
          <div className="space-y-3">
            <Label className="text-white">Priority</Label>
            <RadioGroup value={priority} onValueChange={setPriority} className="space-y-2">
              {priorityOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                  <RadioGroupItem value={option.value} id={`priority-${option.value}`} />
                  <Label htmlFor={`priority-${option.value}`} className="flex-1 cursor-pointer">
                    <div className="font-medium text-white">{option.label}</div>
                    <div className="text-xs text-gray-400">{option.description}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-white">Description *</Label>
            <Textarea
              placeholder="Please provide as much detail as possible..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[150px] bg-dark border-gold/20 text-white placeholder:text-gray-500 resize-none"
            />
            <p className="text-xs text-gray-400">
              {description.length} characters
            </p>
          </div>

          {/* Context Preview (if any) */}
          {initialContext && Object.keys(initialContext).length > 0 && (
            <div className="space-y-2">
              <Label className="text-white text-xs">Additional Context (automatically included)</Label>
              <div className="bg-dark border border-gold/10 rounded-lg p-3">
                <pre className="text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(initialContext, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-gold/20 text-white hover:bg-gold/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            className="bg-gold hover:bg-gold/90 text-black"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CategoryIcon className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
