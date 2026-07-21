import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet } from "@/contexts/FleetContext";
import { Database } from "@/integrations/supabase/types";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  CreditCard,
  Shield,
  Car,
  Star,
  AlertTriangle,
  Plus,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowRight,
  FileText,
  Truck,
  Pencil,
  UserCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { EnhancedBookingDialog } from "@/components/dialogs/EnhancedBookingDialog";
import { EditCustomerDialog } from "@/components/dialogs/EditCustomerDialog";
import { formatCurrency } from "@/lib/utils";
import { CustomerTimeline } from "@/components/crm/CustomerTimeline";
import { EntityCommentThread } from "@/components/comments/EntityCommentThread";
import { useTeam } from "@/contexts/TeamContext";
import { useMoney } from "@/hooks/useMoney";

type Customer = Database['public']['Tables']['customers']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];

interface CustomerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  bookings: Booking[];
  onAddBooking?: (customer: Customer) => void;
}

export const CustomerProfileDialog = ({
  open,
  onOpenChange,
  customer,
  bookings,
  onAddBooking,
}: CustomerProfileDialogProps) => {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { money } = useMoney();
  const { addCustomerNote, updateCustomer, blacklistCustomer, deleteCustomer, customerNotes, refreshCustomers } = useFleet();
  const [newNote, setNewNote] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const customerNotesList = customerNotes.filter(note => note.customer_id === customer.id);
  
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.total_value || 0), 0);

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;
    
    setIsAddingNote(true);
    try {
      await addCustomerNote(customer.id, newNote, user.email || 'Admin');
      setNewNote("");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleToggleVIP = async () => {
    const newStatus = customer.customer_status === 'vip' ? 'active' : 'vip';
    await updateCustomer(customer.id, { customer_status: newStatus });
  };

  const handleBlacklist = async () => {
    const reason = prompt("Enter reason for blacklisting:");
    if (reason) {
      await blacklistCustomer(customer.id, reason);
      onOpenChange(false);
    }
  };

  const getStatusBadge = () => {
    switch (customer.customer_status) {
      case 'vip':
        return <Badge className="bg-primary/10 text-primary border-primary/30"><Star className="w-3 h-3 mr-1" />VIP Customer</Badge>;
      case 'blacklisted':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Blacklisted</Badge>;
      default:
        return <Badge className="bg-success/10 text-success border-success/30">Active</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                {customer.full_name}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowEditDialog(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </DialogTitle>
              <DialogDescription className="flex items-center space-x-2 mt-1">
                <Mail className="w-3 h-3" />
                <span>{customer.email}</span>
              </DialogDescription>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-1">

            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <Car className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{customer.total_bookings || 0}</div>
                <div className="text-xs text-muted-foreground">Total Bookings</div>
              </div>
              <div className="p-4 rounded-lg bg-success/5 border border-success/20 text-center">
                <DollarSign className="w-5 h-5 text-success mx-auto mb-2" />
                <div className="text-2xl font-bold">{money(customer.lifetime_value || 0)}</div>
                <div className="text-xs text-muted-foreground">Lifetime Value</div>
              </div>
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-center">
                <TrendingUp className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{money(totalRevenue > 0 ? totalRevenue / Math.max(completedBookings.length, 1) : 0)}</div>
                <div className="text-xs text-muted-foreground">Avg Booking Value</div>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Contact Information</h4>
              <div className="grid grid-cols-2 gap-3">
                {customer.phone && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{customer.phone}</div>
                      <div className="text-xs text-muted-foreground">Phone</div>
                    </div>
                  </div>
                )}
                {(customer as any).secondary_phone && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{(customer as any).secondary_phone}</div>
                      <div className="text-xs text-muted-foreground">Secondary Phone</div>
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{customer.address}</div>
                      <div className="text-xs text-muted-foreground">Address</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Contact */}
            {((customer as any).emergency_contact_name || (customer as any).emergency_contact_phone) && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground">Emergency Contact</h4>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    {(customer as any).emergency_contact_name && (
                      <div className="text-sm font-medium">{(customer as any).emergency_contact_name}</div>
                    )}
                    {(customer as any).emergency_contact_phone && (
                      <div className="text-xs text-muted-foreground">{(customer as any).emergency_contact_phone}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Verification */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Verification Details</h4>
              <div className="space-y-2">
                {/* ID Verification (Stripe Identity) */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3 min-w-0">
                    <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                        ID Verification
                        {renderIdentityBadge((customer as any).identity_status)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(customer as any).verified_name && `Verified: ${(customer as any).verified_name}`}
                        {(customer as any).document_expiry && ` · Expires ${new Date((customer as any).document_expiry).toLocaleDateString()}`}
                        {!(customer as any).verified_name && !(customer as any).document_expiry && "Powered by Stripe Identity"}
                      </div>
                      {customer.drivers_license && (
                        <div className="text-xs text-muted-foreground truncate">
                          License #{customer.drivers_license}
                          {customer.license_expiry && ` · exp ${new Date(customer.license_expiry).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(customer as any).identity_status !== "verified" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartVerification}
                        disabled={verifyingId}
                      >
                        {verifyingId ? "Starting…" : "Verify ID"}
                      </Button>
                    )}
                    {(customer as any).identity_session_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(stripeIdentityDashboardUrl((customer as any).identity_session_id), "_blank")}
                        title="View in Stripe"
                      >
                        View in Stripe
                      </Button>
                    )}
                  </div>
                </div>

                {/* Insurance on file (neutral — no verification claim) */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3 min-w-0">
                    <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {customer.insurance_provider
                          ? `Insurance on file · ${customer.insurance_provider}`
                          : "Insurance not on file"}
                      </div>
                      {(customer.insurance_policy || customer.insurance_expiry) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {customer.insurance_policy && `Policy ${customer.insurance_policy}`}
                          {customer.insurance_expiry && ` · Expires ${new Date(customer.insurance_expiry).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleToggleVIP} className="flex-1">
                <Star className="w-4 h-4 mr-2" />
                {customer.customer_status === 'vip' ? 'Remove VIP Status' : 'Make VIP'}
              </Button>
              {customer.customer_status !== 'blacklisted' && (
                <Button variant="outline" onClick={handleBlacklist} className="flex-1 text-destructive hover:text-destructive">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Blacklist
                </Button>
              )}
            </div>

            {/* Delete Customer */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Customer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove <strong>{customer.full_name}</strong> from the CRM. Historical bookings will retain the customer name but lose the CRM link. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      const success = await deleteCustomer(customer.id);
                      if (success) onOpenChange(false);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <CustomerTimeline bookings={bookings} notes={customerNotesList} />
            {currentTeam?.id && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Team Discussion</h4>
                <EntityCommentThread
                  entityType="customer"
                  entityId={customer.id}
                  teamId={currentTeam.id}
                  recordLabel={customer.full_name}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            {onAddBooking && (
              <Button onClick={() => onAddBooking(customer)} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            )}
            {bookings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No bookings found</p>
                {onAddBooking && (
                  <Button variant="outline" onClick={() => onAddBooking(customer)} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Booking
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => {
                  const startDate = new Date(booking.start_date);
                  const endDate = new Date(booking.end_date);
                  const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                  
                  const getPaymentBadge = () => {
                    switch (booking.payment_status) {
                      case 'paid': return <Badge className="bg-success/10 text-success border-success/30">Paid</Badge>;
                      case 'partial': return <Badge className="bg-warning/10 text-warning border-warning/30">Partial</Badge>;
                      default: return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Unpaid</Badge>;
                    }
                  };

                  return (
                    <div
                      key={booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className="p-4 rounded-lg bg-muted/30 border border-primary/10 cursor-pointer hover:border-primary/30 transition-colors space-y-3"
                    >
                      {/* Header: Vehicle + Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">{booking.vehicle_name || 'No Vehicle Assigned'}</span>
                        </div>
                        <Badge className={
                          booking.status === 'completed' ? 'bg-success/10 text-success' :
                          booking.status === 'confirmed' ? 'bg-primary/10 text-primary' :
                          booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                          'bg-warning/10 text-warning'
                        }>
                          {booking.status}
                        </Badge>
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{startDate.toLocaleDateString()}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{endDate.toLocaleDateString()}</span>
                        <Badge variant="secondary" className="ml-1 text-xs">{duration}d</Badge>
                      </div>

                      {/* Locations */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{booking.pickup_location}</span>
                        {booking.dropoff_location && booking.dropoff_location !== booking.pickup_location && (
                          <>
                            <ArrowRight className="w-3 h-3" />
                            <span>{booking.dropoff_location}</span>
                          </>
                        )}
                      </div>

                      {/* Delivery */}
                      {booking.requires_delivery && booking.delivery_address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Truck className="w-3.5 h-3.5" />
                          <span>{booking.delivery_address}</span>
                          {booking.delivery_fee ? <span className="text-foreground font-medium">+{formatCurrency(booking.delivery_fee)}</span> : null}
                        </div>
                      )}

                      {/* Pricing + Payment */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{formatCurrency(booking.daily_rate)}/day × {duration}d</span>
                          {getPaymentBadge()}
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(booking.total_value)}</span>
                      </div>

                      {/* Notes */}
                      {booking.notes && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{booking.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            {/* Add Note */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note about this customer..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="h-24"
              />
              <Button onClick={handleAddNote} disabled={!newNote.trim() || isAddingNote} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {isAddingNote ? 'Adding...' : 'Add Note'}
              </Button>
            </div>

            <Separator />

            {/* Notes List */}
            <div className="space-y-3">
              {customerNotesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notes yet</p>
                </div>
              ) : (
                customerNotesList.map((note) => (
                  <div key={note.id} className="p-4 rounded-lg bg-muted/30 border border-primary/10">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-sm">{note.created_by}</div>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-sm">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      <EnhancedBookingDialog
        open={!!selectedBookingId}
        onOpenChange={(open) => !open && setSelectedBookingId(null)}
        bookingId={selectedBookingId || ''}
      />
      <EditCustomerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={customer}
        onSubmit={async (id, updates) => {
          await updateCustomer(id, updates);
          refreshCustomers();
        }}
      />
    </Dialog>
  );
};
