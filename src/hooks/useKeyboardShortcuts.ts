import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface UseKeyboardShortcutsOptions {
  onToggleRari?: () => void;
}

export const useKeyboardShortcuts = (options?: UseKeyboardShortcutsOptions) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Escape key - no modifier needed
      if (e.key === 'Escape') {
        // This will be handled by specific components
        return;
      }
      
      // Only trigger if Ctrl/Cmd is pressed for other shortcuts
      if (!(e.metaKey || e.ctrlKey)) return;

      // Prevent default browser behavior for custom shortcuts
      const shortcuts: Record<string, () => void> = {
        "1": () => {
          e.preventDefault();
          navigate("/dashboard?module=motoriq");
          toast({ title: "Navigated to MotorIQ" });
        },
        "2": () => {
          e.preventDefault();
          navigate("/dashboard?module=pulse");
          toast({ title: "Navigated to Pulse" });
        },
        "3": () => {
          e.preventDefault();
          navigate("/dashboard?module=book");
          toast({ title: "Navigated to Book" });
        },
        "4": () => {
          e.preventDefault();
          navigate("/dashboard?module=vault");
          toast({ title: "Navigated to Vault" });
        },
        "5": () => {
          e.preventDefault();
          navigate("/dashboard?module=core");
          toast({ title: "Navigated to Core" });
        },
        "h": () => {
          e.preventDefault();
          navigate("/");
          toast({ title: "Navigated to Home" });
        },
        "r": () => {
          // Rari shortcut - Cmd/Ctrl + R
          e.preventDefault();
          options?.onToggleRari?.();
          toast({ title: "Toggled Rari AI Assistant" });
        },
        "/": () => {
          e.preventDefault();
          toast({
            title: "Keyboard Shortcuts",
            description: "⌘/Ctrl+R: Rari AI | ⌘/Ctrl+1-5: Modules | ⌘/Ctrl+H: Home | Esc: Minimize",
          });
        },
      };

      const handler = shortcuts[e.key.toLowerCase()];
      if (handler) {
        handler();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [navigate, toast, options?.onToggleRari]);
};
