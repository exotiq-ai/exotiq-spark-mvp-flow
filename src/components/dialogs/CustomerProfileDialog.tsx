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
  DollarSign
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Customer = Database['public']['Tables']['customers']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];

interface CustomerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  bookings: Booking[];
}

export const CustomerProfileDialog = ({
  open,
  onOpenChange,
  customer,
  bookings,
}: CustomerProfileDialogProps) => {
  const { user } = useAuth();
  const { addCustomerNote, updateCustomer, blacklistCustomer, customerNotes } = useFleet();
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{customer.full_name}</DialogTitle>
              <DialogDescription className="flex items-center space-x-2 mt-1">
                <Mail className="w-3 h-3" />
                <span>{customer.email}</span>
              </DialogDescription>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <Car className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{customer.total_bookings || 0}</div>
                <div className="text-xs text-muted-foreground">Total Bookings</div>
              </div>
              <div className="p-4 rounded-lg bg-success/5 border border-success/20 text-center">
                <DollarSign className="w-5 h-5 text-success mx-auto mb-2" />
                <div className="text-2xl font-bold">${(customer.lifetime_value || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Lifetime Value</div>
              </div>
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-center">
                <TrendingUp className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">${totalRevenue > 0 ? (totalRevenue / Math.max(completedBookings.length, 1)).toFixed(0) : '0'}</div>
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

            {/* License & Insurance */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Verification Details</h4>
              <div className="space-y-2">
                {customer.drivers_license && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Driver's License: {customer.drivers_license}</div>
                        <div className="text-xs text-muted-foreground">
                          Expires: {customer.license_expiry ? new Date(customer.license_expiry).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {customer.insurance_provider && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{customer.insurance_provider} - {customer.insurance_policy}</div>
                        <div className="text-xs text-muted-foreground">
                          Expires: {customer.insurance_expiry ? new Date(customer.insurance_expiry).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            {bookings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No bookings found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="p-4 rounded-lg bg-muted/30 border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{booking.pickup_location}</div>
                      <Badge className={
                        booking.status === 'completed' ? 'bg-success/10 text-success' :
                        booking.status === 'confirmed' ? 'bg-primary/10 text-primary' :
                        'bg-warning/10 text-warning'
                      }>
                        {booking.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(booking.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="font-medium text-foreground">${booking.total_value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
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
    </Dialog>
  );
};
