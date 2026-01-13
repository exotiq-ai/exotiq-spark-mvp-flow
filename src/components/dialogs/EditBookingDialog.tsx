import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFleet } from "@/contexts/FleetContext";
import { format, differenceInDays } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  dailyRate: number;
  onBookingUpdated: () => void;
}

export const EditBookingDialog = ({
  open,
  onOpenChange,
  booking,
  dailyRate,
  onBookingUpdated,
}: EditBookingDialogProps) => {
  const { updateBookingDetails } = useFleet();
  
  const [startDate, setStartDate] = useState<Date>(new Date(booking.start_date));
  const [endDate, setEndDate] = useState<Date>(new Date(booking.end_date));
  const [pickupLocation, setPickupLocation] = useState(booking.pickup_location);
  const [dropoffLocation, setDropoffLocation] = useState(booking.dropoff_location || booking.pickup_location);
  const [notes, setNotes] = useState(booking.notes || "");
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate new total based on dates
  const days = differenceInDays(endDate, startDate) || 1;
  const newTotal = days * dailyRate;
  const totalDiff = newTotal - Number(booking.total_value);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateBookingDetails(booking.id, {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        notes,
        total_value: newTotal,
        daily_rate: dailyRate,
      });
      onBookingUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update booking:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Edit Booking
          </DialogTitle>
          <DialogDescription>
            Update booking dates, location, and notes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pickup Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Return Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      disabled={(date) => date < startDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Duration & Price */}
            <div className="p-3 rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Duration
                </span>
                <span className="font-medium">{days} day{days !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  New Total
                </span>
                <span className="font-medium">${newTotal.toLocaleString()}</span>
              </div>
              {totalDiff !== 0 && (
                <div className={`text-xs text-right ${totalDiff > 0 ? "text-success" : "text-warning"}`}>
                  {totalDiff > 0 ? "+" : ""}${totalDiff.toLocaleString()} from original
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Pickup Location
              </Label>
              <Input
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Enter pickup location"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Drop-off Location
              </Label>
              <Input
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="Enter drop-off location (same as pickup if blank)"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special instructions..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating} className="min-h-[44px]">
            {isUpdating ? "Updating..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
