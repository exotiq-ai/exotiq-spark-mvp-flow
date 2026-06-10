import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘/Ctrl", "K"], description: "Open global search" },
      { keys: ["⌘/Ctrl", "H"], description: "Go to home" },
      { keys: ["⌘/Ctrl", "1"], description: "Go to MotorIQ" },
      { keys: ["⌘/Ctrl", "2"], description: "Go to Pulse" },
      { keys: ["⌘/Ctrl", "3"], description: "Go to Book" },
      { keys: ["⌘/Ctrl", "4"], description: "Go to Vault" },
      { keys: ["⌘/Ctrl", "5"], description: "Go to Core" },
    ]
  },
  {
    title: "Actions",
    shortcuts: [
      // ⌘N / ⌘Shift+V / ⌘Shift+C removed — handlers not implemented in useKeyboardShortcuts.ts
      { keys: ["⌘/Ctrl", "O"], description: "Toggle Rari AI assistant" },
      { keys: ["Esc"], description: "Close dialog/modal" },
    ]
  },
  {
    title: "Help",
    shortcuts: [
      { keys: ["⌘/Ctrl", "/"], description: "Show keyboard shortcuts" },
      // "?" → Open help center removed — no help center route or handler exists
    ]
  }
];

export const KeyboardShortcutsHelp = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts with Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <Badge variant="outline" className="font-mono text-xs px-2">
                            {key}
                          </Badge>
                          {j < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Press <Badge variant="outline" className="font-mono text-xs">Esc</Badge> to close
        </p>
      </DialogContent>
    </Dialog>
  );
};
