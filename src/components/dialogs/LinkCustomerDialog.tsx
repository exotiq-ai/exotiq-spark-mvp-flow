import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFleet } from '@/contexts/FleetContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { Search, User, Mail, Phone, Check, Plus, Loader2 } from 'lucide-react';

interface LinkCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  currentCustomerName?: string;
  currentCustomerEmail?: string;
  currentCustomerPhone?: string;
  onCustomerLinked: () => void;
}

export function LinkCustomerDialog({
  open,
  onOpenChange,
  bookingId,
  currentCustomerName,
  currentCustomerEmail,
  currentCustomerPhone,
  onCustomerLinked
}: LinkCustomerDialogProps) {
  const { customers, refreshData } = useFleet();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 20);
    
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.full_name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    ).slice(0, 20);
  }, [customers, searchQuery]);

  const handleLinkCustomer = async (customerId: string) => {
    setIsLinking(true);
    setSelectedCustomerId(customerId);
    
    try {
      const customer = customers.find(c => c.id === customerId);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          customer_id: customerId,
          customer_name: customer?.full_name || currentCustomerName,
          customer_email: customer?.email,
          customer_phone: customer?.phone
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      toast('Customer linked', { description: `Successfully linked ${customer?.full_name} to this booking.` });
      
      await refreshData();
      onCustomerLinked();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking customer:', error);
      toast.error('Failed to link customer', { description: 'Please try again.' });
    } finally {
      setIsLinking(false);
      setSelectedCustomerId(null);
    }
  };

  const handleCreateAndLink = async () => {
    if (!currentCustomerName) return;
    
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get team_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // Get team_id from an existing booking or customer
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('team_id')
        .eq('id', bookingId)
        .single();

      // Duplicate check: look for existing customer with same email
      if (currentCustomerEmail) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id, full_name')
          .eq('email', currentCustomerEmail)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          // Link existing instead of creating duplicate
          await handleLinkCustomer(existing.id);
          toast('Existing customer found', { description: `Linked existing CRM record for ${existing.full_name}.` });
          return;
        }
      }

      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          full_name: currentCustomerName,
          email: currentCustomerEmail || `${currentCustomerName.toLowerCase().replace(/\s+/g, '.')}@placeholder.com`,
          phone: currentCustomerPhone || null,
          user_id: user.id,
          team_id: bookingData?.team_id || null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Link to booking
      const { error: linkError } = await supabase
        .from('bookings')
        .update({
          customer_id: newCustomer.id,
          customer_name: newCustomer.full_name,
          customer_email: newCustomer.email,
          customer_phone: newCustomer.phone,
        })
        .eq('id', bookingId);

      if (linkError) throw linkError;

      toast('Customer created & linked', { description: `Created CRM record for ${newCustomer.full_name} and linked to this booking.` });

      await refreshData();
      onCustomerLinked();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating and linking customer:', error);
      toast.error('Failed to create customer', { description: 'Please try again.' });
    } finally {
      setIsCreating(false);
    }
  };

  const hasBookingData = currentCustomerName && (currentCustomerEmail || currentCustomerPhone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Link Customer
          </DialogTitle>
          <DialogDescription>
            Select a customer from your CRM to link to this booking.
            {currentCustomerName && (
              <span className="block mt-1 text-muted-foreground">
                Current name: <strong>{currentCustomerName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Customer List */}
          <ScrollArea className="h-[300px] rounded-md border">
            {filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No customers found</p>
                {searchQuery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Try a different search term
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{customer.full_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {customer.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {customer.email}
                          </span>
                        )}
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLinkCustomer(customer.id)}
                      disabled={isLinking}
                    >
                      {isLinking && selectedCustomerId === customer.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Link
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Create & Link */}
          <div className="pt-2 border-t">
            {hasBookingData ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  No match? Create a new CRM record from this booking's data:
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">{currentCustomerName}</p>
                    {currentCustomerEmail && (
                      <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{currentCustomerEmail}</p>
                    )}
                    {currentCustomerPhone && (
                      <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{currentCustomerPhone}</p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleCreateAndLink}
                  disabled={isCreating || isLinking}
                  className="w-full"
                  size="sm"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create & Link
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Can't find the customer? Create them in CRM first.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
