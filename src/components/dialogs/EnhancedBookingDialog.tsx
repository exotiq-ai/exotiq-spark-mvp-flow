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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleImageDialog } from "./VehicleImageDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { SendMessageDialog } from "./SendMessageDialog";
import { ChangeVehicleDialog } from "./ChangeVehicleDialog";
import { EditBookingDialog } from "./EditBookingDialog";
import { useFleet } from "@/contexts/FleetContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { openGoogleCalendar } from "@/lib/googleCalendar";
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
  Edit,
  Repeat,
  Clock,
  CalendarPlus,
  Shield,
  Star,
  History,
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
  const { bookings, vehicles, payments, customers, updateBookingStatus, createPayment, sendMessage, refreshData } = useFleet();
  const { toast } = useToast();
  
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showChangeVehicle, setShowChangeVehicle] = useState(false);
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const booking = bookings.find((b) => b.id === bookingId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicle_id);
  const customer = customers.find((c) => c.id === booking?.customer_id);
  const bookingPayments = payments.filter((p) => p.booking_id === bookingId);

  const totalPaid = bookingPayments
    .filter((p) => p.payment_status === "completed")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Number(booking?.total_value || 0) - totalPaid;

  const vehicleImage = vehicle ? getVehicleImage(vehicle.name) : null;
  const bookingDays = booking ? differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) || 1 : 0;

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

  const handleAddToGoogleCalendar = () => {
    if (!booking) return;
    openGoogleCalendar(booking, vehicle?.name);
    toast({ title: "Opening Google Calendar" });
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
      {vehicle && (
        <ChangeVehicleDialog
          open={showChangeVehicle}
          onOpenChange={setShowChangeVehicle}
          bookingId={booking.id}
          currentVehicleId={vehicle.id}
          startDate={booking.start_date}
          endDate={booking.end_date}
          onVehicleChanged={refreshData}
        />
      )}
      {vehicle && (
        <EditBookingDialog
          open={showEditBooking}
          onOpenChange={setShowEditBooking}
          booking={booking}
          dailyRate={Number(vehicle.current_rate)}
          onBookingUpdated={refreshData}
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Booking Details</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(booking.status || "pending")}>
                  {(booking.status || "pending").toUpperCase()}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Vehicle Hero Section */}
          <div className="px-6 pt-4">
            <div 
              className="relative rounded-xl overflow-hidden bg-gradient-to-br from-muted/50 to-muted cursor-pointer group"
              onClick={() => setShowVehicleImage(true)}
            >
              <div className="flex items-center gap-4 p-4">
                {vehicleImage ? (
                  <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                    <img src={vehicleImage} alt={vehicle?.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                ) : (
                  <div className="w-24 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Car className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                    {vehicle?.name || booking?.vehicle_name || "Unknown Vehicle"}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {Number(vehicle?.current_rate || 0).toLocaleString()}/day
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {bookingDays} day{bookingDays !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[calc(90vh-220px)]">
            <div className="px-6 pb-6 space-y-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowChangeVehicle(true)}>
                  <Repeat className="h-3 w-3 mr-1" />Change Vehicle
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowEditBooking(true)}>
                  <Edit className="h-3 w-3 mr-1" />Edit Booking
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddToGoogleCalendar}>
                  <CalendarPlus className="h-3 w-3 mr-1" />Add to Google
                </Button>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
                  <TabsTrigger value="customer" className="text-xs sm:text-sm">Customer</TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Pickup</span>
                      </div>
                      <div className="font-medium">{format(new Date(booking.start_date), "MMM d, yyyy")}</div>
                      <div className="text-sm text-muted-foreground">{format(new Date(booking.start_date), "h:mm a")}</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Return</span>
                      </div>
                      <div className="font-medium">{format(new Date(booking.end_date), "MMM d, yyyy")}</div>
                      <div className="text-sm text-muted-foreground">{format(new Date(booking.end_date), "h:mm a")}</div>
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Location</span>
                    </div>
                    <div className="font-medium">{booking.pickup_location}</div>
                    {booking.dropoff_location && booking.dropoff_location !== booking.pickup_location && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Return: {booking.dropoff_location}
                      </div>
                    )}
                  </div>

                  {/* Financial Summary */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Financial Summary
                    </h4>
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
                        <div className={`text-lg font-bold ${balanceDue > 0 ? "text-warning" : "text-success"}`}>
                          ${balanceDue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
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
                </TabsContent>

                {/* Payments Tab */}
                <TabsContent value="payments" className="space-y-4 mt-4">
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
                      <div className={`text-lg font-bold ${balanceDue > 0 ? "text-warning" : "text-success"}`}>
                        ${balanceDue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <h4 className="font-semibold flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Payment History
                  </h4>
                  
                  {bookingPayments.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No payments recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bookingPayments.map((payment) => (
                        <div key={payment.id} className="p-3 bg-muted/20 rounded-lg flex items-center justify-between">
                          <div>
                            <div className="font-medium capitalize">{payment.payment_type}</div>
                            <div className="text-xs text-muted-foreground">
                              {payment.transaction_date ? format(new Date(payment.transaction_date), "MMM d, yyyy") : "N/A"}
                              {payment.payment_method && ` • ${payment.payment_method}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${Number(payment.amount).toLocaleString()}</div>
                            <Badge variant="outline" className={`text-xs ${payment.payment_status === "completed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                              {payment.payment_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button onClick={() => setShowPaymentDialog(true)} className="w-full">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </TabsContent>

                {/* Customer Tab */}
                <TabsContent value="customer" className="space-y-4 mt-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium text-lg">{booking.customer_name}</div>
                          {customer?.customer_status === "vip" && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                              <Star className="h-3 w-3 mr-1" />VIP
                            </Badge>
                          )}
                        </div>
                        
                        {/* Customer Stats */}
                        {customer && (
                          <div className="grid grid-cols-2 gap-2 my-3">
                            <div className="p-2 bg-background/50 rounded text-center">
                              <div className="text-lg font-bold">{customer.total_bookings || 0}</div>
                              <div className="text-xs text-muted-foreground">Total Rentals</div>
                            </div>
                            <div className="p-2 bg-background/50 rounded text-center">
                              <div className="text-lg font-bold">${(Number(customer.lifetime_value) || 0).toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">Lifetime Value</div>
                            </div>
                          </div>
                        )}

                        {/* Verification Status */}
                        <div className="flex gap-2 mb-3">
                          <Badge variant="outline" className={customer?.id_verified ? "bg-success/10 text-success border-success/30" : "bg-muted"}>
                            <Shield className="h-3 w-3 mr-1" />
                            ID {customer?.id_verified ? "Verified" : "Pending"}
                          </Badge>
                          <Badge variant="outline" className={customer?.insurance_verified ? "bg-success/10 text-success border-success/30" : "bg-muted"}>
                            <Shield className="h-3 w-3 mr-1" />
                            Insurance {customer?.insurance_verified ? "Verified" : "Pending"}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          {booking.customer_phone && (
                            <a href={`tel:${booking.customer_phone}`} className="flex items-center space-x-2 text-sm hover:text-primary transition-colors">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{booking.customer_phone}</span>
                            </a>
                          )}
                          {booking.customer_email && (
                            <a href={`mailto:${booking.customer_email}`} className="flex items-center space-x-2 text-sm hover:text-primary transition-colors">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{booking.customer_email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => { onOpenChange(false); onNavigateToModule?.("core", { customerId: booking.customer_id }); }}>
                    <User className="h-4 w-4 mr-2" />
                    View Full Profile
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </Button>
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note about this booking..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} size="sm" className="self-end">
                      {addingNote ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                  </div>

                  {loadingNotes ? (
                    <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
                  ) : customerNotes.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No notes yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerNotes.map((note) => (
                        <div key={note.id} className="p-3 bg-muted/20 rounded-lg">
                          <div className="text-muted-foreground text-xs mb-1">
                            {note.created_by} • {format(new Date(note.created_at || ""), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                          <div className="text-sm">{note.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Separator />

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setShowPaymentDialog(true)} className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />Take Payment
                </Button>
                <Button variant="outline" onClick={() => setShowMessageDialog(true)} className="w-full">
                  <MessageSquare className="h-4 w-4 mr-2" />Message
                </Button>
              </div>

              {booking.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { updateBookingStatus(booking.id, "cancelled"); onOpenChange(false); }}
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />Cancel
                  </Button>
                  <Button
                    onClick={() => { updateBookingStatus(booking.id, "confirmed"); onOpenChange(false); }}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />Confirm
                  </Button>
                </div>
              )}
              {booking.status === "confirmed" && (
                <Button
                  onClick={() => { updateBookingStatus(booking.id, "completed"); onOpenChange(false); }}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />Complete Booking
                </Button>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
