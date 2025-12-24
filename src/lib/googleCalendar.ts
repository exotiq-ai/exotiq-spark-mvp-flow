import { format } from "date-fns";

interface GoogleCalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Generate a Google Calendar URL for adding an event
 */
export const generateGoogleCalendarUrl = (event: GoogleCalendarEvent): string => {
  const formatGoogleDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description,
    location: event.location,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generate Google Calendar URL for a booking
 */
export const bookingToGoogleCalendarUrl = (booking: {
  customer_name: string;
  pickup_location: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  total_value?: number | null;
}, vehicleName?: string): string => {
  const title = vehicleName 
    ? `${vehicleName} - ${booking.customer_name}`
    : `Rental: ${booking.customer_name}`;

  const description = [
    `Customer: ${booking.customer_name}`,
    booking.total_value ? `Total: $${Number(booking.total_value).toLocaleString()}` : "",
    booking.notes || "",
  ].filter(Boolean).join("\n");

  return generateGoogleCalendarUrl({
    title,
    description,
    location: booking.pickup_location,
    startDate: new Date(booking.start_date),
    endDate: new Date(booking.end_date),
  });
};

/**
 * Open Google Calendar with the event pre-filled
 */
export const openGoogleCalendar = (booking: {
  customer_name: string;
  pickup_location: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  total_value?: number | null;
}, vehicleName?: string) => {
  const url = bookingToGoogleCalendarUrl(booking, vehicleName);
  window.open(url, "_blank", "noopener,noreferrer");
};
