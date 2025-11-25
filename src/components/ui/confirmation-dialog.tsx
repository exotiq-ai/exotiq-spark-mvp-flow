import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { scaleIn } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive" | "success";
}

const icons = {
  default: Info,
  destructive: AlertTriangle,
  success: CheckCircle,
};

const iconColors = {
  default: "text-primary",
  destructive: "text-destructive",
  success: "text-success",
};

export const ConfirmationDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  variant = "default",
}: ConfirmationDialogProps) => {
  const Icon = icons[variant];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AnimatePresence>
          {open && (
            <motion.div {...scaleIn}>
              <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  >
                    <Icon className={cn("h-6 w-6", iconColors[variant])} />
                  </motion.div>
                  <AlertDialogTitle>{title}</AlertDialogTitle>
                </div>
                <AlertDialogDescription>{description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => onOpenChange(false)}>
                  {cancelText}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onConfirm}
                  className={cn(
                    variant === "destructive" && "bg-destructive hover:bg-destructive/90"
                  )}
                >
                  {confirmText}
                </AlertDialogAction>
              </AlertDialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </AlertDialogContent>
    </AlertDialog>
  );
};
