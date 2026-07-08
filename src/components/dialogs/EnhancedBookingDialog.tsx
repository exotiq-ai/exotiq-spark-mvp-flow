import { useState, useEffect, useMemo } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleImageDialog } from "./VehicleImageDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { CheckInOutDialog } from "./CheckInOutDialog";
import { SendMessageDialog } from "./SendMessageDialog";
import { ChangeVehicleDialog } from "./ChangeVehicleDialog";
import { EditBookingDialog } from "./EditBookingDialog";
import { LinkCustomerDialog } from "./LinkCustomerDialog";
import { LinkVehicleDialog } from "./LinkVehicleDialog";
import { SigningCeremony } from "@/components/signing/SigningCeremony";
import { DocumentPicker } from "@/components/signing/DocumentPicker";
import { DocumentPreviewDialog } from "@/components/common/DocumentPreviewDialog";
import { BookingCostsSection } from "@/components/margin/BookingCostsSection";
import { useFleet } from "@/contexts/FleetContext";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { openGoogleCalendar } from "@/lib/googleCalendar";
import { cn } from "@/lib/utils";
import { calculateBookingTotal, getGasFeeForTeam } from "@/lib/pricingUtils";
import { useTeamGasFeeSettings } from '@/hooks/useTeamGasFeeSettings';
import { computeBookingTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import {
  Calendar as CalendarIcon,
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
  LogIn,
  LogOut,
  History,
  AlertTriangle,
  X,
  Save,
  FileText,
  Loader2,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];

import { useBlockIfRestricted } from "@/components/guards/PaymentDueGuard";
import { EntityCommentThread } from "@/components/comments/EntityCommentThread";
interface EnhancedBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  onNavigateToModule?: (moduleId: string, context?: Record<string, any>) => void;
}

// Time options for the time picker
const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
  "22:00"
];

export const EnhancedBookingDialog = ({
  open,
  onOpenChange,
  bookingId,
  onNavigateToModule,
}: EnhancedBookingDialogProps) => {
  const { bookings, vehicles, payments, customers, updateBookingStatus, updateBookingDetails, createPayment, sendMessage, refreshData } = useFleet();
  const blockIfRestricted = useBlockIfRestricted();
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  const gasFeeSettings = useTeamGasFeeSettings();
  const teamGasFee = getGasFeeForTeam(gasFeeSettings.gasFeeAmount);
  
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showChangeVehicle, setShowChangeVehicle] = useState(false);
  const [showEditBooking, setShowEditBooking] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showLinkCustomer, setShowLinkCustomer] = useState(false);
  const [showLinkVehicle, setShowLinkVehicle] = useState(false);
  const [showCheckInOut, setShowCheckInOut] = useState<"check-out" | "check-in" | null>(null);
  const [showSigningCeremony, setShowSigningCeremony] = useState(false);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [signingDocument, setSigningDocument] = useState<{ id: string; name: string; file_url: string; doc_ref?: string | null; team_id?: string | null } | null>(null);
  const [bookingDocuments, setBookingDocuments] = useState<any[]>([]);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState("");
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [preparingDocument, setPreparingDocument] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  
  // Inline edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    startDate: null as Date | null,
    startTime: "",
    endDate: null as Date | null,
    endTime: "",
    pickupLocation: "",
    dropoffLocation: "",
    notes: ""
  });

  const booking = bookings.find((b) => b.id === bookingId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicle_id);
  const customer = customers.find((c) => c.id === booking?.customer_id);
  const bookingPayments = payments.filter((p) => p.booking_id === bookingId);

  const totalPaid = bookingPayments
    .filter((p) => p.payment_status === "completed")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Number(booking?.total_value || 0) - totalPaid;

  const vehicleImage = vehicle?.image_url || (vehicle ? getVehicleImage(vehicle.name) : null) || null;
  
  // Calculate pricing using centralized utility
  const currentPricing = useMemo(() => {
    if (!booking) return null;
    const startDate = isEditMode && editValues.startDate ? editValues.startDate : new Date(booking.start_date);
    const endDate = isEditMode && editValues.endDate ? editValues.endDate : new Date(booking.end_date);
    const rate = Number(vehicle?.current_rate || booking?.daily_rate || 0);
    
    return calculateBookingTotal({
      startDate,
      endDate,
      dailyRate: rate,
      discountAmount: Number(booking.discount_amount) || 0,
      gasFee: Number((booking as any).gas_fee) || teamGasFee,
      gasFeeWaived: (booking as any).gas_fee_waived ?? false,
      deliveryFee: Number(booking.delivery_fee) || 0,
      durationType: (booking as any).rental_duration_type || 'daily',
    });
  }, [booking, isEditMode, editValues.startDate, editValues.endDate, vehicle?.current_rate]);

  const bookingDays = currentPricing?.rentalDays || 0;
  const dailyRate = Number(vehicle?.current_rate || booking?.daily_rate || 0);

  // Tenant-aware currency & tax config (defaults preserve US behaviour)
  const currency = currentTeam?.currency || "USD";
  const locale = currentTeam?.locale || "en-US";
  const taxLabel = currentTeam?.tax_label || "Tax";
  const taxRate = Number(currentTeam?.tax_rate_percent ?? 0);
  const taxInclusive = !!currentTeam?.tax_inclusive;
  const fmt = (n: number) => formatMoney(n, { currency, locale, decimals: 2 });

  // Tax breakdown: when rate=0 (US default), total == grandTotal — zero behaviour change.
  const taxBreakdown = useMemo(() => {
    const gt = currentPricing?.grandTotal || 0;
    return computeBookingTotals(
      { daily_rate: gt, days: 1 }, // treat grandTotal as the pre-tax/gross base
      { tax_rate_percent: taxRate, tax_inclusive: taxInclusive },
    );
  }, [currentPricing?.grandTotal, taxRate, taxInclusive]);

  const newTotal = taxBreakdown.total;

  // Calculate price difference from original
  const priceDifference = useMemo(() => {
    if (!booking) return 0;
    return newTotal - Number(booking.total_value);
  }, [newTotal, booking]);

  // Download/generate the VAT invoice PDF via edge function.
  const handleDownloadInvoice = async () => {
    if (!booking) return;
    setGeneratingInvoice(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-vat-invoice", {
        body: { booking_id: booking.id },
      });
      if (error) throw error;
      const payload = data as { pdf_base64: string; filename: string; invoice_number: string };
      const binary = atob(payload.pdf_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename || `invoice-${payload.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await refreshData();
      toast({ title: `${taxLabel} invoice ready`, description: payload.invoice_number });
    } catch (err) {
      toast({
        title: "Could not generate invoice",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Form validation
  const isFormValid = useMemo(() => {
    if (!editValues.startDate || !editValues.endDate) return false;
    if (editValues.endDate < editValues.startDate) return false;
    if (!editValues.pickupLocation.trim()) return false;
    if (!editValues.startTime || !editValues.endTime) return false;
    return true;
  }, [editValues]);

  // Validation error messages
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!editValues.startDate) errors.push("Pickup date is required");
    if (!editValues.endDate) errors.push("Return date is required");
    if (editValues.startDate && editValues.endDate && editValues.endDate < editValues.startDate) {
      errors.push("Return date must be after pickup date");
    }
    if (!editValues.pickupLocation.trim()) errors.push("Pickup location is required");
    if (bookingDays < 1) errors.push("Minimum rental is 1 day");
    return errors;
  }, [editValues, bookingDays]);

  // Unsaved changes detection
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditMode || !booking) return false;
    const originalStartDate = new Date(booking.start_date);
    const originalEndDate = new Date(booking.end_date);
    return (
      editValues.startDate?.toDateString() !== originalStartDate.toDateString() ||
      editValues.endDate?.toDateString() !== originalEndDate.toDateString() ||
      editValues.startTime !== format(originalStartDate, "HH:mm") ||
      editValues.endTime !== format(originalEndDate, "HH:mm") ||
      editValues.pickupLocation !== booking.pickup_location ||
      editValues.dropoffLocation !== (booking.dropoff_location || "") ||
      editValues.notes !== (booking.notes || "")
    );
  }, [isEditMode, booking, editValues]);

  // Initialize edit values when entering edit mode
  useEffect(() => {
    if (isEditMode && booking) {
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);
      setEditValues({
        startDate,
        startTime: format(startDate, "HH:mm"),
        endDate,
        endTime: format(endDate, "HH:mm"),
        pickupLocation: booking.pickup_location,
        dropoffLocation: booking.dropoff_location || "",
        notes: booking.notes || ""
      });
    }
  }, [isEditMode, booking]);

  // Reset edit mode when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
      setActiveTab("details");
    }
  }, [open]);

  // Fetch locations for the dropdown
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data } = await supabase
          .from("locations")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        setLocations(data || []);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };
    if (open) fetchLocations();
  }, [open]);
  // Fetch signed documents for this booking
  useEffect(() => {
    const fetchBookingDocs = async () => {
      if (!bookingId) return;
      const { data } = await supabase
        .from("documents")
        .select("id, name, doc_ref, signed_at, signed_by_name, type, file_url")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      setBookingDocuments(data || []);
    };
    if (open && bookingId) fetchBookingDocs();
  }, [open, bookingId]);

  const fillTemplateAndOpen = async (doc: { id: string; name: string; file_url: string; doc_ref?: string | null; team_id?: string | null }) => {
    if (!booking) return;
    setPreparingDocument(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("fill-rental-template", {
        body: { templateDocumentId: doc.id, bookingId: booking.id },
      });
      if (error || result?.error) {
        console.warn("Auto-fill unavailable, using raw template:", error || result?.error);
        setSigningDocument(doc);
      } else {
        // Use the filled PDF URL
        setSigningDocument({ ...doc, file_url: result.filledPdfUrl });
      }
    } catch (e) {
      console.warn("Auto-fill failed, using raw template:", e);
      setSigningDocument(doc);
    } finally {
      setPreparingDocument(false);
      setShowSigningCeremony(true);
    }
  };

  const handleSignDocument = async () => {
    if (!currentTeam?.id || !booking) return;
    const { data: defaultDoc } = await supabase
      .from("documents")
      .select("id, name, file_url, doc_ref, team_id")
      .eq("team_id", currentTeam.id)
      .eq("type", "rental_agreement")
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();

    if (defaultDoc) {
      await fillTemplateAndOpen(defaultDoc);
    } else {
      setShowDocumentPicker(true);
    }
  };

  useEffect(() => {
    const fetchCustomerNotes = async () => {
      if (!booking?.customer_id) return;
      setLoadingNotes(true);
      try {
        // Fetch booking-specific notes first, then general customer notes
        const { data } = await supabase
          .from("customer_notes")
          .select("*")
          .eq("customer_id", booking.customer_id)
          .order("created_at", { ascending: false })
          .limit(20);
        // Sort: booking-specific notes first, then general
        const sorted = (data || []).sort((a, b) => {
          const aIsBooking = (a as any).booking_id === bookingId;
          const bIsBooking = (b as any).booking_id === bookingId;
          if (aIsBooking && !bIsBooking) return -1;
          if (!aIsBooking && bIsBooking) return 1;
          return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
        });
        setCustomerNotes(sorted);
      } catch (error) {
        console.error("Error fetching customer notes:", error);
      } finally {
        setLoadingNotes(false);
      }
    };
    if (open && booking?.customer_id) fetchCustomerNotes();
  }, [open, booking?.customer_id, bookingId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !booking?.customer_id) return;
    setAddingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("customer_notes")
        .insert({ customer_id: booking.customer_id, user_id: user.id, note: newNote.trim(), created_by: "You", booking_id: booking.id } as any)
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

  const handleSaveChanges = async (andApprove = false) => {
    if (!booking) return;
    if (blockIfRestricted()) return;
    setSaving(true);
    
    try {
      // Combine date and time
      const startDateTime = new Date(editValues.startDate!);
      const [startHours, startMinutes] = editValues.startTime.split(':').map(Number);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const endDateTime = new Date(editValues.endDate!);
      const [endHours, endMinutes] = editValues.endTime.split(':').map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      // Update booking details
      await updateBookingDetails(booking.id, {
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        pickup_location: editValues.pickupLocation,
        dropoff_location: editValues.dropoffLocation || null,
        notes: editValues.notes || null,
        total_value: newTotal,
        subtotal: taxBreakdown.subtotal,
        tax_amount: taxBreakdown.tax_amount,
        tax_rate_percent: taxRate,
        tax_inclusive: taxInclusive,
        currency,
      } as any);

      // If Save & Approve, also update status
      if (andApprove) {
        await updateBookingStatus(booking.id, 'confirmed');
        toast({ title: "Booking saved and approved" });
        onOpenChange(false);
      } else {
        toast({ title: "Booking updated successfully" });
        setIsEditMode(false);
      }
      
      refreshData();
    } catch (error) {
      console.error('Error saving booking:', error);
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmed) return;
    }
    setIsEditMode(false);
  };

  // Handle dialog close with unsaved changes check
  const handleDialogClose = (open: boolean) => {
    if (!open && isEditMode && hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmed) return;
    }
    onOpenChange(open);
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
      {booking && showCheckInOut && (
        <CheckInOutDialog
          open={!!showCheckInOut}
          onOpenChange={(v) => { if (!v) setShowCheckInOut(null); }}
          booking={booking}
          mode={showCheckInOut}
          vehicleId={vehicle?.id}
          vehicleName={vehicle?.name || booking.vehicle_name || undefined}
          onComplete={() => refreshData(true)}
          onCollectPayment={() => { setShowCheckInOut(null); setShowPaymentDialog(true); }}
        />
      )}
      <SendMessageDialog open={showMessageDialog} onOpenChange={setShowMessageDialog} bookings={booking ? [booking] : []} onSubmit={sendMessage} />
      <LinkCustomerDialog
        open={showLinkCustomer}
        onOpenChange={setShowLinkCustomer}
        bookingId={booking.id}
        currentCustomerName={booking.customer_name}
        currentCustomerEmail={booking.customer_email || undefined}
        currentCustomerPhone={booking.customer_phone || undefined}
        onCustomerLinked={refreshData}
      />
      <LinkVehicleDialog
        open={showLinkVehicle}
        onOpenChange={setShowLinkVehicle}
        bookingId={booking.id}
        currentVehicleName={booking.vehicle_name || undefined}
        startDate={booking.start_date}
        endDate={booking.end_date}
        onVehicleLinked={refreshData}
      />
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

      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">
                {isEditMode ? "Edit Booking" : "Booking Details"}
                {!isEditMode && (booking as any)?.booking_ref && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {(booking as any).booking_ref}
                  </span>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditMode(true)}
                    className="h-7 relative"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
                {isEditMode && hasUnsavedChanges && (
                  <span className="h-2 w-2 rounded-full bg-warning animate-pulse" title="Unsaved changes" />
                )}
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
                      {fmt(Number(vehicle?.current_rate || 0))}/day
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
              {/* Quick Actions - hidden in edit mode */}
              {!isEditMode && (
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
                  
                  {/* Link Customer Button - shown when customer_id is null */}
                  {!booking.customer_id && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowLinkCustomer(true)}
                      className="border-warning text-warning hover:bg-warning/10"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Link Customer
                    </Button>
                  )}
                  
                  {/* Link Vehicle Button - shown when vehicle_id is null */}
                  {!booking.vehicle_id && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowLinkVehicle(true)}
                      className="border-warning text-warning hover:bg-warning/10"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Link Vehicle
                    </Button>
                  )}
                  
                  {/* Check-Out Button - for confirmed bookings */}
                  {booking.vehicle_id && (booking.status === "confirmed" || booking.status === "pending") && (
                    <Button
                      size="sm"
                      onClick={() => setShowCheckInOut("check-out")}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      Check Out
                    </Button>
                  )}

                  {/* Check-In Button - for active bookings */}
                  {booking.vehicle_id && booking.status === "active" && (
                    <Button
                      size="sm"
                      onClick={() => setShowCheckInOut("check-in")}
                      className="bg-success hover:bg-success/90 text-success-foreground"
                    >
                      <LogIn className="h-3 w-3 mr-1" />
                      Check In
                    </Button>
                  )}
                </div>
              )}

              {/* Edit Mode Content */}
              {isEditMode ? (
                <div className="space-y-4">
                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        Please fix the following:
                      </div>
                      <ul className="text-sm text-destructive/80 list-disc list-inside">
                        {validationErrors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Date & Time Grid - responsive */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Pickup Date */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Pickup Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editValues.startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editValues.startDate ? format(editValues.startDate, "MMM d, yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editValues.startDate || undefined}
                            onSelect={(date) => setEditValues(prev => ({ ...prev, startDate: date || null }))}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Pickup Time */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Pickup Time
                      </Label>
                      <Select
                        value={editValues.startTime}
                        onValueChange={(val) => setEditValues(prev => ({ ...prev, startTime: val }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time} value={time}>
                              {format(new Date(`2000-01-01T${time}`), "h:mm a")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Return Date */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Return Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editValues.endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editValues.endDate ? format(editValues.endDate, "MMM d, yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editValues.endDate || undefined}
                            onSelect={(date) => setEditValues(prev => ({ ...prev, endDate: date || null }))}
                            initialFocus
                            className="p-3 pointer-events-auto"
                            disabled={(date) => editValues.startDate ? date < editValues.startDate : false}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Return Time */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Return Time
                      </Label>
                      <Select
                        value={editValues.endTime}
                        onValueChange={(val) => setEditValues(prev => ({ ...prev, endTime: val }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time} value={time}>
                              {format(new Date(`2000-01-01T${time}`), "h:mm a")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Price Breakdown - Enhanced */}
                  {currentPricing && (
                  <div className="p-4 bg-primary/5 rounded-lg space-y-2 border border-primary/10 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Rental ({currentPricing.rentalDays} day{currentPricing.rentalDays !== 1 ? "s" : ""} × {fmt(dailyRate)})
                      </span>
                      <span className="font-medium text-foreground">{fmt(currentPricing.rentalSubtotal)}</span>
                    </div>
                    {currentPricing.discountAmount > 0 && (
                      <div className="flex items-center justify-between text-success">
                        <span>Discount {booking.discount_reason && `(${booking.discount_reason})`}</span>
                        <span>-{fmt(currentPricing.discountAmount)}</span>
                      </div>
                    )}
                    {currentPricing.gasFee > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Gas/Re-fueling Fee</span>
                        <span className="font-medium text-foreground">{fmt(currentPricing.gasFee)}</span>
                      </div>
                    )}
                    {currentPricing.deliveryFee > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Delivery Fee</span>
                        <span className="font-medium text-foreground">{fmt(currentPricing.deliveryFee)}</span>
                      </div>
                    )}
                    {taxRate > 0 && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Subtotal {taxInclusive ? `(excl. ${taxLabel.toLowerCase()})` : ""}</span>
                          <span className="font-medium text-foreground">{fmt(taxBreakdown.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{taxLabel} ({taxRate}%{taxInclusive ? ", included" : ""})</span>
                          <span className="font-medium text-foreground">{fmt(taxBreakdown.tax_amount)}</span>
                        </div>
                      </>
                    )}
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold text-primary text-lg">{fmt(taxBreakdown.total)}</span>
                    </div>
                    {priceDifference !== 0 && (
                      <div className={cn(
                        "text-xs text-right",
                        priceDifference > 0 ? "text-success" : "text-warning"
                      )}>
                        {priceDifference > 0 ? "+" : ""}{fmt(priceDifference)} from original
                      </div>
                    )}
                    {taxRate > 0 && !isEditMode && (
                      <div className="pt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={generatingInvoice}
                          onClick={handleDownloadInvoice}
                          className="w-full"
                        >
                          {generatingInvoice
                            ? "Generating…"
                            : booking.invoice_number
                              ? `Download ${taxLabel} invoice (${booking.invoice_number})`
                              : `Issue ${taxLabel} invoice`}
                        </Button>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Location Fields */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Pickup Location</Label>
                      {locations && locations.length > 0 ? (
                        <Select
                          value={editValues.pickupLocation}
                          onValueChange={(val) => setEditValues(prev => ({ ...prev, pickupLocation: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map(loc => (
                              <SelectItem key={loc.id} value={loc.name}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={editValues.pickupLocation}
                          onChange={(e) => setEditValues(prev => ({ ...prev, pickupLocation: e.target.value }))}
                          placeholder="Enter pickup location"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Return Location</Label>
                      {locations && locations.length > 0 ? (
                        <Select
                          value={editValues.dropoffLocation || "same"}
                          onValueChange={(val) => setEditValues(prev => ({ ...prev, dropoffLocation: val === "same" ? "" : val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Same as pickup" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Same as pickup</SelectItem>
                            {locations.map(loc => (
                              <SelectItem key={loc.id} value={loc.name}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={editValues.dropoffLocation}
                          onChange={(e) => setEditValues(prev => ({ ...prev, dropoffLocation: e.target.value }))}
                          placeholder="Same as pickup (leave empty)"
                        />
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notes</Label>
                    <Textarea
                      value={editValues.notes}
                      onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add any notes about this booking..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <Separator />

                  {/* Edit Mode Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="flex-1"
                      disabled={saving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Discard
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSaveChanges(false)}
                      disabled={saving || !isFormValid}
                      title={!isFormValid ? "Please fix validation errors" : undefined}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Draft"}
                    </Button>
                    {booking.status === "pending" && (
                      <Button
                        onClick={() => handleSaveChanges(true)}
                        disabled={saving || !isFormValid}
                        className="flex-1"
                        title={!isFormValid ? "Please fix validation errors" : undefined}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save & Approve"}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* View Mode Content */
                <>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
                      <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
                      <TabsTrigger value="customer" className="text-xs sm:text-sm">Customer</TabsTrigger>
                      <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
                      <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
                    </TabsList>

                    {/* Details Tab */}
                    <TabsContent value="details" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Pickup</span>
                          </div>
                          <div className="font-medium">{format(new Date(booking.start_date), "MMM d, yyyy")}</div>
                          <div className="text-sm text-muted-foreground">{format(new Date(booking.start_date), "h:mm a")}</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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
                            <div className="text-lg font-bold">{fmt(Number(booking.total_value))}</div>
                          </div>
                          <div className="p-3 bg-success/10 rounded-lg text-center">
                            <div className="text-sm text-muted-foreground">Paid</div>
                            <div className="text-lg font-bold text-success">{fmt(totalPaid)}</div>
                          </div>
                          <div className={`p-3 rounded-lg text-center ${balanceDue > 0 ? "bg-warning/10" : "bg-success/10"}`}>
                            <div className="text-sm text-muted-foreground">Balance</div>
                            <div className={`text-lg font-bold ${balanceDue > 0 ? "text-warning" : "text-success"}`}>
                              {fmt(balanceDue)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Documents & Signing */}
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documents
                        </h4>
                        {bookingDocuments.length > 0 ? (
                          <div className="space-y-2">
                        {bookingDocuments.map((doc) => (
                              <div key={doc.id} className="p-3 bg-muted/20 rounded-lg flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-sm">{doc.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {doc.doc_ref && `${doc.doc_ref} • `}
                                    {doc.signed_by_name && `Signed by ${doc.signed_by_name}`}
                                    {doc.signed_at && ` • ${format(new Date(doc.signed_at), "MMM d, yyyy")}`}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setPreviewDocUrl(doc.file_url);
                                      setPreviewDocName(doc.name);
                                      setShowDocPreview(true);
                                    }}
                                  >
                                    View
                                  </Button>
                                  <Badge variant="outline" className="bg-success/10 text-success text-xs">
                                    Signed
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No signed documents for this booking.</p>
                        )}
                        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSignDocument} disabled={preparingDocument}>
                          {preparingDocument ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Preparing Agreement...
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Sign Document
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onNavigateToModule?.("pulse", { bookingId: booking.id }); }}>
                          <CreditCard className="h-3 w-3 mr-1" />Record / view payments<ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Payments Tab */}
                    <TabsContent value="payments" className="space-y-4 mt-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted/30 rounded-lg text-center">
                          <div className="text-sm text-muted-foreground">Total</div>
                          <div className="text-lg font-bold">{fmt(Number(booking.total_value))}</div>
                        </div>
                        <div className="p-3 bg-success/10 rounded-lg text-center">
                          <div className="text-sm text-muted-foreground">Paid</div>
                          <div className="text-lg font-bold text-success">{fmt(totalPaid)}</div>
                        </div>
                        <div className={`p-3 rounded-lg text-center ${balanceDue > 0 ? "bg-warning/10" : "bg-success/10"}`}>
                          <div className="text-sm text-muted-foreground">Balance</div>
                          <div className={`text-lg font-bold ${balanceDue > 0 ? "text-warning" : "text-success"}`}>
                            {fmt(balanceDue)}
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
                                <div className="font-semibold">{fmt(Number(payment.amount))}</div>
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

                      <Separator />

                      <BookingCostsSection bookingId={booking.id} />
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

                    {/* Activity Tab — @mentions + record-scoped comments */}
                    <TabsContent value="activity" className="space-y-2 mt-4">
                      {booking.team_id && (
                        <EntityCommentThread
                          entityType="booking"
                          entityId={booking.id}
                          teamId={booking.team_id}
                          recordLabel={booking.booking_ref || "this booking"}
                        />
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
                        onClick={() => setShowCancelConfirm(true)}
                        className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4 mr-2" />Cancel
                      </Button>
                      <Button
                        onClick={() => { if (blockIfRestricted()) return; updateBookingStatus(booking.id, "confirmed"); onOpenChange(false); }}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />Confirm
                      </Button>
                    </div>
                  )}
                  {booking.status === "confirmed" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelConfirm(true)}
                        className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4 mr-2" />Cancel Booking
                      </Button>
                      <Button
                        onClick={() => { if (blockIfRestricted()) return; updateBookingStatus(booking.id, "completed"); onOpenChange(false); }}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />Complete Booking
                      </Button>
                    </div>
                  )}
                  <ConfirmationDialog
                    open={showCancelConfirm}
                    onOpenChange={setShowCancelConfirm}
                    title="Cancel Booking?"
                    description={`Are you sure you want to cancel the booking for ${booking.customer_name}${booking.vehicle_name ? ` — ${booking.vehicle_name}` : ''}? This action cannot be undone.`}
                    confirmText="Yes, Cancel Booking"
                    cancelText="Keep Booking"
                    variant="destructive"
                    onConfirm={() => {
                      if (blockIfRestricted()) { setShowCancelConfirm(false); return; }
                      updateBookingStatus(booking.id, "cancelled");
                      setShowCancelConfirm(false);
                      onOpenChange(false);
                    }}
                  />
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {booking && signingDocument && (
        <SigningCeremony
          open={showSigningCeremony}
          onOpenChange={setShowSigningCeremony}
          booking={{
            id: booking.id,
            customer_name: booking.customer_name,
            customer_email: booking.customer_email,
            vehicle_name: booking.vehicle_name || vehicle?.name,
            vehicle_id: booking.vehicle_id,
            customer_id: booking.customer_id,
            start_date: booking.start_date,
            end_date: booking.end_date,
            total_value: Number(booking.total_value),
            daily_rate: Number(booking.daily_rate),
          }}
          document={signingDocument}
          onComplete={async (docRef) => {
            toast({ title: "Document Signed", description: `Reference: ${docRef}` });
            // Refresh booking documents
            const { data } = await supabase
              .from("documents")
              .select("id, name, doc_ref, signed_at, signed_by_name, type, file_url")
              .eq("booking_id", booking.id)
              .order("created_at", { ascending: false });
            setBookingDocuments(data || []);

            // Auto-send signed document via email
            const signedDoc = data?.find((d: any) => d.doc_ref === docRef);
            if (signedDoc) {
              supabase.functions.invoke("send-signed-document", {
                body: { documentId: signedDoc.id, sendToRenter: true, sendToOperator: true },
              }).then(({ error }) => {
                if (!error) toast({ title: "Signed agreement emailed to renter and operator" });
              });
            }
          }}
        />
      )}
      <DocumentPicker
        open={showDocumentPicker}
        onOpenChange={setShowDocumentPicker}
        onSelect={async (doc) => {
          setShowDocumentPicker(false);
          await fillTemplateAndOpen(doc);
        }}
      />
      <DocumentPreviewDialog
        open={showDocPreview}
        onOpenChange={setShowDocPreview}
        documentUrl={previewDocUrl}
        documentName={previewDocName}
      />
    </>
  );
};
