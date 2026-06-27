import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AtSign, Users, Megaphone, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickerItem } from "@/lib/mentions";

interface MentionPickerProps {
  items: PickerItem[];
  activeIndex: number;
  onPick: (item: PickerItem) => void;
}

export const MentionPicker = ({ items, activeIndex, onPick }: MentionPickerProps) => {
  if (items.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full left-3 right-3 mb-2 bg-popover border border-border rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-50"
    >
      <div className="p-1">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
          <AtSign className="h-3 w-3" />
          Mention someone or a group
        </div>
        {items.map((item, index) => {
          const Icon =
            item.kind === "all" ? Megaphone : item.kind === "group" ? Users : item.kind === "role" ? Shield : null;
          return (
            <button
              key={item.key}
              onClick={() => onPick(item)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                index === activeIndex ? "bg-accent" : "hover:bg-muted",
              )}
            >
              {item.kind === "user" ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={item.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {item.label.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                    item.kind === "all"
                      ? "bg-destructive/15 text-destructive"
                      : item.kind === "role"
                        ? "bg-warning/15 text-warning"
                        : "bg-primary/15 text-primary",
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-[11px] text-muted-foreground truncate">{item.sublabel}</span>
                )}
              </div>
              {item.recipientCount > 1 && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {item.recipientCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};
