import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { RariVoiceInterface } from "@/components/rari/RariVoiceInterface";
import { useFleet } from "@/contexts/FleetContext";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  FileText,
  Wrench,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickActionsWidgetProps {
  onModuleClick?: (moduleId: string) => void;
}

export const QuickActionsWidget = ({ onModuleClick }: QuickActionsWidgetProps) => {
  const { bookings, vehicles, createBooking, createPayment, createCustomer, createMaintenance, generateReport } = useFleet();
  
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showRariDialog, setShowRariDialog] = useState(false);

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
    {
      id: "ask-rari",
      label: "Ask Rari",
      icon: Sparkles,
      color: "text-primary",
      bgColor: "bg-gradient-to-br from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30",
      onClick: () => setShowRariDialog(true),
    },
  ];

  return (
    <>
      <Card className="card-premium p-4 md:p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {actions.map((action, index) => (
            <Button
              key={action.id}
              variant="ghost"
              onClick={action.onClick}
              className={`flex flex-col items-center justify-center h-24 p-3 rounded-xl border-2 border-transparent transition-all hover:border-primary/30 hover:shadow-md ${action.bgColor} animate-fade-in`}
              style={{ animationDelay: `${index * 0.05}s`, animationFillMode: "both" }}
            >
              <action.icon className={`h-6 w-6 mb-2 ${action.color}`} />
              <span className="text-xs font-medium text-center leading-tight">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
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

      {/* Rari Dialog */}
      <Dialog open={showRariDialog} onOpenChange={setShowRariDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Ask Rari - Your Fleet Copilot
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Ask Rari anything about your fleet operations, bookings, or get AI-powered insights.
            </p>
            <RariVoiceInterface />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
