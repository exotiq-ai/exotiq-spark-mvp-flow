import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Database } from "@/integrations/supabase/types";

type MessageInsert = Omit<Database['public']['Tables']['messages']['Insert'], 'user_id'>;
type Booking = Database['public']['Tables']['bookings']['Row'];

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: Booking[];
  onSubmit: (message: MessageInsert) => Promise<void>;
}

export const SendMessageDialog = ({ 
  open, 
  onOpenChange, 
  bookings,
  onSubmit 
}: SendMessageDialogProps) => {
  const [bookingId, setBookingId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [messageType, setMessageType] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const messageTemplates = {
    confirmation: {
      subject: "Booking Confirmation - ExotiQ Fleet",
      body: "Thank you for your booking! Your reservation has been confirmed. We look forward to serving you."
    },
    reminder: {
      subject: "Reminder: Your Upcoming Rental",
      body: "This is a friendly reminder about your upcoming rental. Please ensure you arrive on time for pickup."
    },
    thankyou: {
      subject: "Thank You for Choosing ExotiQ",
      body: "Thank you for your business! We hope you enjoyed your experience. We'd love to hear your feedback."
    }
  };

  const handleBookingChange = (selectedBookingId: string) => {
    setBookingId(selectedBookingId);
    const booking = bookings.find(b => b.id === selectedBookingId);
    if (booking) {
      setRecipientName(booking.customer_name);
      setRecipientEmail(booking.customer_email || "");
      setRecipientPhone(booking.customer_phone || "");
    }
  };

  const handleTemplateSelect = (template: keyof typeof messageTemplates) => {
    setSubject(messageTemplates[template].subject);
    setBody(messageTemplates[template].body);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipientName || !body || !messageType) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        booking_id: bookingId || null,
        recipient_name: recipientName,
        recipient_email: recipientEmail || null,
        recipient_phone: recipientPhone || null,
        message_type: messageType,
        subject: messageType === 'email' ? subject : null,
        body,
        status: 'sent'
      });

      // Reset form
      setBookingId("");
      setRecipientName("");
      setRecipientEmail("");
      setRecipientPhone("");
      setMessageType("email");
      setSubject("");
      setBody("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking">Link to Booking (Optional)</Label>
            <Select value={bookingId} onValueChange={handleBookingChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select booking" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((booking) => (
                  <SelectItem key={booking.id} value={booking.id}>
                    {booking.customer_name} - {new Date(booking.start_date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name *</Label>
              <Input
                id="recipientName"
                placeholder="John Smith"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="messageType">Message Type *</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageType !== 'sms' && (
              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Email Address</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            )}

            {messageType !== 'email' && (
              <div className="space-y-2">
                <Label htmlFor="recipientPhone">Phone Number</Label>
                <Input
                  id="recipientPhone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTemplateSelect('confirmation')}
              >
                Confirmation
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTemplateSelect('reminder')}
              >
                Reminder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTemplateSelect('thankyou')}
              >
                Thank You
              </Button>
            </div>
          </div>

          {messageType !== 'sms' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Your booking confirmation"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};