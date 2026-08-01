import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RariMessageFeedbackProps {
  /** The assistant response being rated */
  response: string;
  /** The user question that prompted this response, when known */
  userQuery?: string;
  /** Voice/chat conversation identifier, when known */
  conversationId?: string | null;
  /** Which Rari surface produced the response */
  surface?: string;
  className?: string;
}

type Rating = 'positive' | 'negative';

export const RariMessageFeedback = ({
  response,
  userQuery,
  conversationId,
  surface = 'voice',
  className,
}: RariMessageFeedbackProps) => {
  const [rating, setRating] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (value: Rating) => {
    if (saving || rating === value) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        toast.error('Sign in to send feedback');
        return;
      }

      const { error } = await supabase.from('rari_feedback').insert({
        user_id: userId,
        feedback_type: value,
        rari_response: response.slice(0, 4000),
        user_query: userQuery?.slice(0, 4000) ?? null,
        context: {
          surface,
          conversation_id: conversationId ?? null,
          rated_at: new Date().toISOString(),
        },
      });

      if (error) throw error;

      setRating(value);
      toast.success(value === 'positive' ? 'Thanks — noted as a good response' : 'Thanks — we\'ll use this to improve Rari');
    } catch (err) {
      console.error('[RariMessageFeedback] failed to save feedback', err);
      toast.error('Could not save feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="Good response"
        data-testid="rari-feedback-up"
        disabled={saving}
        onClick={() => submit('positive')}
        className={cn(
          'rounded-full p-1 transition-colors disabled:opacity-50',
          rating === 'positive'
            ? 'text-emerald-500'
            : 'text-muted-foreground/50 hover:text-foreground'
        )}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label="Poor response"
        data-testid="rari-feedback-down"
        disabled={saving}
        onClick={() => submit('negative')}
        className={cn(
          'rounded-full p-1 transition-colors disabled:opacity-50',
          rating === 'negative'
            ? 'text-destructive'
            : 'text-muted-foreground/50 hover:text-foreground'
        )}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
};
