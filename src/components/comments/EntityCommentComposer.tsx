import { useRef, useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, AtSign } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { MentionPicker } from "@/components/messaging/MentionPicker";
import { MentionConfirmDialog } from "@/components/messaging/MentionConfirmDialog";
import {
  buildPickerItems,
  parseMentions,
  type MentionContext,
  type PickerItem,
} from "@/lib/mentions";

interface EntityCommentComposerProps {
  ctx: MentionContext;
  currentUserId?: string;
  canMentionAll: boolean;
  posting: boolean;
  onSubmit: (input: { content: string; mentions: string[] }) => Promise<void> | void;
  placeholder?: string;
}

export const EntityCommentComposer = ({
  ctx,
  currentUserId,
  canMentionAll,
  posting,
  onSubmit,
  placeholder,
}: EntityCommentComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
    activeIndex: number;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    content: string;
    mentions: string[];
    hasGroup: boolean;
    recipients: { id: string; name: string; avatar_url?: string | null }[];
  } | null>(null);

  const pickerItems: PickerItem[] = mentionState
    ? buildPickerItems(mentionState.query, ctx, canMentionAll, currentUserId)
    : [];

  const closePicker = () => setMentionState(null);

  const detectMention = (val: string, caret: number) => {
    // Look back from caret for '@' bounded by whitespace/start
    let i = caret - 1;
    while (i >= 0 && /[a-zA-Z0-9_.-]/.test(val[i])) i--;
    if (i < 0 || val[i] !== "@") return null;
    if (i > 0 && !/\s/.test(val[i - 1])) return null;
    return { start: i, query: val.slice(i + 1, caret) };
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const caret = e.target.selectionStart ?? val.length;
    const det = detectMention(val, caret);
    if (det) setMentionState({ ...det, activeIndex: 0 });
    else closePicker();
  };

  const insertMention = useCallback(
    (item: PickerItem) => {
      if (!mentionState || !textareaRef.current) return;
      const before = content.slice(0, mentionState.start);
      const after = content.slice(
        mentionState.start + 1 + mentionState.query.length,
      );
      const next = `${before}@${item.ref} ${after}`;
      setContent(next);
      closePicker();
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const pos = (before + `@${item.ref} `).length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      });
    },
    [mentionState, content],
  );

  const submit = useCallback(async () => {
    if (!content.trim() || posting) return;
    const { tokens, recipientIds } = parseMentions(content, ctx, currentUserId);
    const hasGroup = tokens.some((t) => t.kind !== "user");
    if (hasGroup || recipientIds.length > 3) {
      const recipients = recipientIds.map((id) => {
        const m = ctx.teamMembers.find((u) => u.id === id);
        return {
          id,
          name: m?.name || "Teammate",
          avatar_url: m?.avatar_url,
        };
      });
      setPendingConfirm({ content, mentions: recipientIds, hasGroup, recipients });
      return;
    }
    await onSubmit({ content, mentions: recipientIds });
    setContent("");
  }, [content, posting, ctx, currentUserId, onSubmit]);

  const confirmAndSend = async () => {
    if (!pendingConfirm) return;
    await onSubmit({
      content: pendingConfirm.content,
      mentions: pendingConfirm.mentions,
    });
    setPendingConfirm(null);
    setContent("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && pickerItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionState((s) =>
          s ? { ...s, activeIndex: (s.activeIndex + 1) % pickerItems.length } : s,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionState((s) =>
          s
            ? {
                ...s,
                activeIndex:
                  (s.activeIndex - 1 + pickerItems.length) % pickerItems.length,
              }
            : s,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(pickerItems[mentionState.activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker();
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  // Auto-grow textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [content]);

  return (
    <div className="relative">
      <AnimatePresence>
        {mentionState && pickerItems.length > 0 && (
          <MentionPicker
            items={pickerItems}
            activeIndex={mentionState.activeIndex}
            onPick={insertMention}
          />
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 border border-border rounded-lg bg-background p-2 focus-within:ring-1 focus-within:ring-primary">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder || "Comment… type @ to mention"}
          className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 min-h-[36px] px-1 py-1.5 text-sm"
          rows={1}
        />
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            ⌘↵
          </span>
          <Button
            size="icon"
            onClick={submit}
            disabled={!content.trim() || posting}
            className="h-8 w-8"
            aria-label="Send comment"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {content.length === 0 && (
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <AtSign className="h-3 w-3" /> Tag a teammate to notify them
        </div>
      )}

      <MentionConfirmDialog
        open={!!pendingConfirm}
        recipients={pendingConfirm?.recipients || []}
        hasGroupMention={pendingConfirm?.hasGroup || false}
        onConfirm={confirmAndSend}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
};
