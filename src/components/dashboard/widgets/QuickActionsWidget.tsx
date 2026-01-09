import { useState } from "react";
import { Card } from "@/components/ui/card";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { motion } from "framer-motion";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  FileText,
  Wrench,
} from "lucide-react";

interface QuickActionsWidgetProps {
  onModuleClick?: (moduleId: string) => void;
}

export const QuickActionsWidget = ({ onModuleClick }: QuickActionsWidgetProps) => {
  const { bookings, vehicles, createBooking, createPayment, createCustomer, createMaintenance, generateReport } = useLocationFilteredFleet();
  
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);

  // Get first booking for payment dialog (or null if none)
  const firstBooking = bookings[0];

  const actions = [
    {
      id: "create-booking",
      label: "New Booking",
      icon: CalendarPlus,
      color: "text-primary",
      bgColor: "bg-primary/10 hover:bg-primary/20",
      onClick: () => setShowBookingDialog(true),
    },
    {
      id: "record-payment",
      label: "Record Payment",
      icon: CreditCard,
      color: "text-success",
      bgColor: "bg-success/10 hover:bg-success/20",
      onClick: () => {
        if (firstBooking) {
          setShowPaymentDialog(true);
        } else {
          onModuleClick?.("pulse");
        }
      },
    },
    {
      id: "add-customer",
      label: "Add Customer",
      icon: UserPlus,
      color: "text-accent",
      bgColor: "bg-accent/10 hover:bg-accent/20",
      onClick: () => setShowCustomerDialog(true),
    },
    {
      id: "generate-report",
      label: "Generate Report",
      icon: FileText,
      color: "text-warning",
      bgColor: "bg-warning/10 hover:bg-warning/20",
      onClick: () => setShowReportDialog(true),
    },
    {
      id: "schedule-maintenance",
      label: "Schedule Service",
      icon: Wrench,
      color: "text-secondary-foreground",
      bgColor: "bg-secondary/50 hover:bg-secondary",
      onClick: () => setShowMaintenanceDialog(true),
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 24,
      },
    },
  };

  return (
    <>
      <Card variant="elevated" className="p-4 md:p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {actions.map((action) => (
            <motion.div key={action.id} variants={itemVariants}>
              <motion.button
                onClick={action.onClick}
                className={`flex flex-col items-center justify-center w-full h-24 p-3 rounded-xl border border-transparent transition-colors ${action.bgColor}`}
                whileHover={{ 
                  scale: 1.05, 
                  borderColor: 'hsl(var(--primary) / 0.3)',
                  boxShadow: '0 8px 20px -8px hsl(var(--primary) / 0.3)'
                }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  <action.icon className={`h-6 w-6 mb-2 ${action.color}`} />
                </motion.div>
                <span className="text-xs font-medium text-center leading-tight">
                  {action.label}
                </span>
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      </Card>

      {/* Dialogs */}
      <NewBookingDialog
        open={showBookingDialog}
        onOpenChange={setShowBookingDialog}
        vehicles={vehicles}
        onSubmit={createBooking}
      />

      {firstBooking && (
        <RecordPaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          booking={firstBooking}
          onSubmit={createPayment}
        />
      )}

      <AddCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onSubmit={createCustomer}
      />

      <GenerateReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onGenerate={generateReport}
      />

      <ScheduleMaintenanceDialog
        open={showMaintenanceDialog}
        onOpenChange={setShowMaintenanceDialog}
        vehicles={vehicles}
        onSubmit={createMaintenance}
      />
    </>
  );
};
