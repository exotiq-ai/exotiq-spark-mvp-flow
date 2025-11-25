import { toast } from "sonner";

interface SuccessToastOptions {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

export const useSuccessToast = () => {
  const showSuccess = ({ 
    title, 
    description, 
    action,
    duration = 4000 
  }: SuccessToastOptions) => {
    toast.success(title, {
      description,
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
    });
  };

  return { showSuccess };
};
