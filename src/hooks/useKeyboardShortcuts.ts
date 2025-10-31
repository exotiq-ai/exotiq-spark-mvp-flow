import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if Ctrl/Cmd is pressed
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
        "/": () => {
          e.preventDefault();
          toast({
            title: "Keyboard Shortcuts",
            description: "⌘/Ctrl+K: Search | ⌘/Ctrl+1-5: Modules | ⌘/Ctrl+H: Home",
          });
        },
      };

      const handler = shortcuts[e.key];
      if (handler) {
        handler();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [navigate, toast]);
};
