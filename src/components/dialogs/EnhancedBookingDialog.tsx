import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VehicleImageDialog } from "./VehicleImageDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { SendMessageDialog } from "./SendMessageDialog";
import { useFleet } from "@/contexts/FleetContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  User,
  Car,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  CreditCard,
  DollarSign,
  StickyNote,
  ExternalLink,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];

interface EnhancedBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  onNavigateToModule?: (moduleId: string, context?: Record<string, any>) => void;
}

export const EnhancedBookingDialog = ({
  open,
  onOpenChange,
  bookingId,
  onNavigateToModule,
}: EnhancedBookingDialogProps) => {
  const { bookings, vehicles, payments, updateBookingStatus, createPayment, sendMessage } = useFleet();
  const { toast } = useToast();
  
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicle_id);
  const bookingPayments = payments.filter((p) => p.booking_id === bookingId);

  const totalPaid = bookingPayments
    .filter((p) => p.payment_status === "completed")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Number(booking?.total_value || 0) - totalPaid;

  useEffect(() => {
    const fetchCustomerNotes = async () => {
      if (!booking?.customer_id) return;
      setLoadingNotes(true);
      try {
        const { data } = await supabase
          .from("customer_notes")
          .select("*")
          .eq("customer_id", booking.customer_id)
          .order("created_at", { ascending: false })
          .limit(5);
        setCustomerNotes(data || []);
      } catch (error) {
        console.error("Error fetching customer notes:", error);
      } finally {
        setLoadingNotes(false);
      }
    };
    if (open && booking?.customer_id) fetchCustomerNotes();
  }, [open, booking?.customer_id]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !booking?.customer_id) return;
    setAddingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("customer_notes")
        .insert({ customer_id: booking.customer_id, user_id: user.id, note: newNote.trim(), created_by: "You" })
        .select()
        .single();
      if (error) throw error;
      setCustomerNotes((prev) => [data, ...prev]);
      setNewNote("");
      toast({ title: "Note added successfully" });
    } catch (error) {
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-success/10 text-success border-success/30";
      case "pending": return "bg-warning/10 text-warning border-warning/30";
      case "completed": return "bg-primary/10 text-primary border-primary/30";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "bg-muted/10 text-muted-foreground";
    }
  };

  if (!booking) return null;

  return (
    <>
      <VehicleImageDialog
        open={showVehicleImage}
        onOpenChange={setShowVehicleImage}
        vehicleName={vehicle?.name || ""}
        vehicleDetails={vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year, status: vehicle.status || "available", dailyRate: Number(vehicle.current_rate) } : undefined}
      />
      {booking && <RecordPaymentDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog} booking={booking} onSubmit={createPayment} />}
      <SendMessageDialog open={showMessageDialog} onOpenChange={setShowMessageDialog} bookings={booking ? [booking] : []} onSubmit={sendMessage} />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Booking Details</DialogTitle>
              <Badge className={getStatusColor(booking.status || "pending")}>{(booking.status || "pending").toUpperCase()}</Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-140px)]">
            <div className="px-6 pb-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onNavigateToModule?.("motoriq", { vehicleId: booking.vehicle_id }); }}>
                  <Car className="h-3 w-3 mr-1" />Vehicle<ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onNavigateToModule?.("core", { customerId: booking.customer_id }); }}>
                  <User className="h-3 w-3 mr-1" />CRM<ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onNavigateToModule?.("pulse", { bookingId: booking.id }); }}>
                  <CreditCard className="h-3 w-3 mr-1" />Payments<ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>

              <Separator />

              <div className="bg-muted/30 rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowVehicleImage(true)}>
                <div className="flex items-start space-x-3">
                  <div className="p-3 bg-primary/10 rounded-lg"><Car className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">Vehicle</div>
                    <div className="font-medium text-lg hover:text-primary transition-colors">{vehicle?.name || "Unknown"}</div>
                    {vehicle && <div className="text-sm text-muted-foreground mt-1">${Number(vehicle.current_rate).toLocaleString()}/day</div>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-3 bg-primary/10 rounded-lg"><User className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">Customer</div>
                    <div className="font-medium text-lg mb-3">{booking.customer_name}</div>
                    <div className="space-y-2">
                      {booking.customer_phone && <div className="flex items-center space-x-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{booking.customer_phone}</span></div>}
                      {booking.customer_email && <div className="flex items-center space-x-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{booking.customer_email}</span></div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Pickup</span></div>
                  <div className="font-medium">{format(new Date(booking.start_date), "MMM d, yyyy")}</div>
                  <div className="text-sm text-muted-foreground">{format(new Date(booking.start_date), "h:mm a")}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Return</span></div>
                  <div className="font-medium">{format(new Date(booking.end_date), "MMM d, yyyy")}</div>
                  <div className="text-sm text-muted-foreground">{format(new Date(booking.end_date), "h:mm a")}</div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Location</span></div>
                <div className="font-medium">{booking.pickup_location}</div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" />Financial Summary</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="text-lg font-bold">${Number(booking.total_value).toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">Paid</div>
                    <div className="text-lg font-bold text-success">${totalPaid.toLocaleString()}</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${balanceDue > 0 ? "bg-warning/10" : "bg-success/10"}`}>
                    <div className="text-sm text-muted-foreground">Balance</div>
                    <div className={`text-lg font-bold ${balanceDue > 0 ? "text-warning" : "text-success"}`}>${balanceDue.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><StickyNote className="h-4 w-4" />Customer Notes</h4>
                <div className="flex gap-2">
                  <Textarea placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px]" />
                  <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} size="sm" className="self-end">
                    {addingNote ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
                {loadingNotes ? <div className="text-sm text-muted-foreground text-center py-4">Loading...</div> : customerNotes.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">No notes yet</div> : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {customerNotes.map((note) => (
                      <div key={note.id} className="p-2 bg-muted/20 rounded text-sm">
                        <div className="text-muted-foreground text-xs mb-1">{note.created_by} • {format(new Date(note.created_at || ""), "MMM d, yyyy")}</div>
                        <div>{note.note}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setShowPaymentDialog(true)} className="w-full"><CreditCard className="h-4 w-4 mr-2" />Take Payment</Button>
                <Button variant="outline" onClick={() => setShowMessageDialog(true)} className="w-full"><MessageSquare className="h-4 w-4 mr-2" />Message</Button>
              </div>

              {booking.status === "pending" && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { updateBookingStatus(booking.id, "cancelled"); onOpenChange(false); }} className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"><XCircle className="h-4 w-4 mr-2" />Cancel</Button>
                  <Button onClick={() => { updateBookingStatus(booking.id, "confirmed"); onOpenChange(false); }} className="flex-1"><CheckCircle className="h-4 w-4 mr-2" />Confirm</Button>
                </div>
              )}
              {booking.status === "confirmed" && <Button onClick={() => { updateBookingStatus(booking.id, "completed"); onOpenChange(false); }} className="w-full"><CheckCircle className="h-4 w-4 mr-2" />Complete</Button>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
