import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MessageSquarePlus, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logUserRequest, type RequestType } from '@/lib/requestAnalytics';
import { cn } from '@/lib/utils';

interface FeedbackButtonProps {
  moduleId?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'floating';
  className?: string;
}

export const FeedbackButton = ({ 
  moduleId, 
  variant = 'outline',
  className 
}: FeedbackButtonProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('general_feedback');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: 'Content Required',
        description: 'Please enter your feedback or request',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await logUserRequest({
        requestType,
        requestContent: content,
        moduleId,
        context: {
          submitted_via: 'feedback_button',
          page: window.location.pathname
        }
      });

      if (result.success) {
        toast({
          title: 'Thank You!',
          description: 'Your feedback has been recorded. We appreciate your input!',
        });
        setContent('');
        setIsOpen(false);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'floating') {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className={cn(
            "fixed bottom-24 right-4 md:bottom-24 md:right-6 z-40",
            "bg-purple-600 hover:bg-purple-700 text-white",
            "rounded-full w-14 h-14 md:w-16 md:h-16 p-0",
            "shadow-lg hover:shadow-xl",
            "hover:scale-105 active:scale-95 transition-all duration-300",
            className
          )}
          aria-label="Give Feedback"
        >
          <MessageSquarePlus className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Share Your Feedback</DialogTitle>
              <DialogDescription>
                Help us improve by sharing your thoughts, feature requests, or reporting issues.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="feedback-type">Type of Feedback</Label>
                <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
                  <SelectTrigger id="feedback-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_feedback">General Feedback</SelectItem>
                    <SelectItem value="feature_suggestion">Feature Request</SelectItem>
                    <SelectItem value="tool_request">Tool Request</SelectItem>
                    <SelectItem value="help_query">Help / Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-content">Your Feedback</Label>
                <Textarea
                  id="feedback-content"
                  placeholder={
                    requestType === 'feature_suggestion' 
                      ? 'Describe the feature you\'d like to see...'
                      : requestType === 'tool_request'
                      ? 'What tool or functionality would be helpful?'
                      : requestType === 'help_query'
                      ? 'What do you need help with?'
                      : 'Share your thoughts...'
                  }
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !content.trim()}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant={variant}
        className={className}
      >
        <MessageSquarePlus className="w-4 h-4 mr-2" />
        Feedback
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Share Your Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by sharing your thoughts, feature requests, or reporting issues.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-type">Type of Feedback</Label>
              <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
                <SelectTrigger id="feedback-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_feedback">General Feedback</SelectItem>
                  <SelectItem value="feature_suggestion">Feature Request</SelectItem>
                  <SelectItem value="tool_request">Tool Request</SelectItem>
                  <SelectItem value="help_query">Help / Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-content">Your Feedback</Label>
              <Textarea
                id="feedback-content"
                placeholder={
                  requestType === 'feature_suggestion' 
                    ? 'Describe the feature you\'d like to see...'
                    : requestType === 'tool_request'
                    ? 'What tool or functionality would be helpful?'
                    : requestType === 'help_query'
                    ? 'What do you need help with?'
                    : 'Share your thoughts...'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !content.trim()}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
