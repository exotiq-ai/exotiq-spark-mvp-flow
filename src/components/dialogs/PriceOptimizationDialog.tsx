import { ApplyRatesDialog } from '@/components/motoriq/ApplyRatesDialog';
import { useMotorIQ } from '@/hooks/useMotorIQ';

interface PriceOptimizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ignored: kept so existing call sites compile. Suggestions come from MotorIQ, never from a stored column. */
  vehicles?: unknown;
  onApply: (vehicleId: string, newRate: number) => void | Promise<void>;
}

/**
 * The dashboard's "apply a price suggestion" dialog. It used to read the stored `suggested_rate` column (which nothing
 * maintains) and promise "+$ x 30 per month"; it now shows the same reviewed, explained changes MotorIQ recommends.
 */
const Inner = ({ onOpenChange, onApply }: Pick<PriceOptimizationDialogProps, 'onOpenChange' | 'onApply'>) => {
  const { snapshot } = useMotorIQ();
  return (
    <ApplyRatesDialog
      open
      onOpenChange={onOpenChange}
      recommendations={snapshot?.recommendations ?? []}
      onApply={async (vehicleId, rate) => { await onApply(vehicleId, rate); }}
    />
  );
};

// The snapshot is only computed while the dialog is open.
export const PriceOptimizationDialog = ({ open, onOpenChange, onApply }: PriceOptimizationDialogProps) =>
  open ? <Inner onOpenChange={onOpenChange} onApply={onApply} /> : null;
