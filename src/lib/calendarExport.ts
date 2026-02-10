import { format } from "date-fns";

interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  uid: string;
}

/**
 * Generate an ICS file content for calendar events
 */
export const generateICS = (events: CalendarEvent[]): string => {
  const formatDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const escapeText = (text: string) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\n/g, "\\n");
  };

  const vevents = events.map((event) => {
    return [
      "BEGIN:VEVENT",
      `UID:${event.uid}@exotiq-fleet`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(event.startDate)}`,
      `DTEND:${formatDate(event.endDate)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      `LOCATION:${escapeText(event.location)}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ExotiQ Fleet//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return icsContent;
};

/**
 * Download an ICS file
 */
export const downloadICS = (events: CalendarEvent[], filename: string = "bookings.ics") => {
  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Convert bookings to calendar events
 */
export const bookingsToCalendarEvents = (
  bookings: Array<{
    id: string;
    customer_name: string;
    pickup_location: string;
    start_date: string;
    end_date: string;
    notes?: string | null;
    vehicle_id?: string | null;
  }>,
  vehicleMap: Record<string, string>
): CalendarEvent[] => {
  return bookings.map((booking) => {
    const vehicleName = booking.vehicle_id ? vehicleMap[booking.vehicle_id] || '' : '';
    return {
      uid: booking.id,
      title: vehicleName ? `${vehicleName} - ${booking.customer_name}` : `Rental: ${booking.customer_name}`,
      description: [
        `Customer: ${booking.customer_name}`,
        `Location: ${booking.pickup_location}`,
        booking.notes || '',
      ].filter(Boolean).join('\n'),
      location: booking.pickup_location,
      startDate: new Date(booking.start_date),
      endDate: new Date(booking.end_date),
    };
  });
};
