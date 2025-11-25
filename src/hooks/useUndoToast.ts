import { toast } from "sonner";

interface UndoToastOptions {
  message: string;
  onUndo: () => void;
  duration?: number;
}

export const useUndoToast = () => {
  const showWithUndo = ({ 
    message, 
    onUndo,
    duration = 5000 
  }: UndoToastOptions) => {
    toast.success(message, {
      duration,
      action: {
        label: "Undo",
        onClick: () => {
          onUndo();
          toast.success("Action undone");
        },
      },
    });
  };

  return { showWithUndo };
};
