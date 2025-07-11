import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Plus, Eye, Settings, Upload, Car, Clock, User, MapPin, DollarSign, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const Book = () => {
  const [date, setDate] = useState<Date>();
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  const upcomingBookings = [
    {
      id: "BK001",
      vehicle: "Ferrari 488 GTB",
      customer: "James Wilson",
      phone: "+1 (555) 123-4567",
      email: "james.wilson@email.com",
      startDate: "2024-12-15",
      endDate: "2024-12-18",
      duration: "3 days",
      totalAmount: 1350,
      status: "confirmed",
      pickup: "Beverly Hills, CA",
      dropoff: "LAX Airport"
    },
    {
      id: "BK002", 
      vehicle: "Lamborghini Huracan",
      customer: "Sarah Chen",
      phone: "+1 (555) 987-6543",
      email: "sarah.chen@email.com",
      startDate: "2024-12-20",
      endDate: "2024-12-22",
      duration: "2 days",
      totalAmount: 1040,
      status: "pending",
      pickup: "Manhattan Beach, CA",
      dropoff: "Same Location"
    },
    {
      id: "BK003",
      vehicle: "McLaren 720S", 
      customer: "Michael Rodriguez",
      phone: "+1 (555) 456-7890",
      email: "m.rodriguez@email.com",
      startDate: "2024-12-25",
      endDate: "2024-12-27",
      duration: "2 days",
      totalAmount: 760,
      status: "confirmed",
      pickup: "Hollywood, CA",
      dropoff: "Santa Monica, CA"
    }
  ];

  const bookingRequests = [
    {
      id: "REQ001",
      vehicle: "Ferrari 488 GTB",
      customer: "David Park",
      requestDate: "2024-12-12",
      startDate: "2024-12-28",
      endDate: "2024-12-30",
      amount: 1350,
      status: "pending_approval"
    },
    {
      id: "REQ002",
      vehicle: "Porsche 911 Turbo",
      customer: "Emma Thompson",
      requestDate: "2024-12-11",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
      amount: 1200,
      status: "pending_approval"
    }
  ];

  const calendarEvents = [
    { date: 15, status: "booked", vehicle: "Ferrari 488", customer: "James W." },
    { date: 16, status: "booked", vehicle: "Ferrari 488", customer: "James W." },
    { date: 17, status: "booked", vehicle: "Ferrari 488", customer: "James W." },
    { date: 20, status: "pending", vehicle: "Lamborghini", customer: "Sarah C." },
    { date: 21, status: "pending", vehicle: "Lamborghini", customer: "Sarah C." },
    { date: 25, status: "booked", vehicle: "McLaren 720S", customer: "Michael R." },
    { date: 26, status: "booked", vehicle: "McLaren 720S", customer: "Michael R." }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Book</h1>
          <p className="text-muted-foreground">Direct Booking Tools</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button className="btn-premium">
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="bookings">Active Bookings</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card-premium lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Booking Calendar</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Button size="sm">View Day</Button>
                  <Button size="sm" variant="outline">Week View</Button>
                </div>
                
                {/* Booking Grid */}
                <div className="grid grid-cols-7 gap-2 text-sm">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="p-2 font-medium text-center text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: 35 }, (_, i) => {
                    const dayNum = (i % 31) + 1;
                    const event = calendarEvents.find(e => e.date === dayNum);
                    return (
                      <div key={i} className="p-2 h-20 border rounded-lg bg-muted/10 hover:bg-muted/20 cursor-pointer relative">
                        <div className="text-xs text-muted-foreground">{dayNum}</div>
                        {event && (
                          <div className={`text-xs px-1 rounded mt-1 ${
                            event.status === 'booked' ? 'bg-success/20 text-success' : 
                            'bg-warning/20 text-warning'
                          }`}>
                            <div className="font-medium">{event.vehicle}</div>
                            <div className="text-xs">{event.customer}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="card-premium">
                <h3 className="text-lg font-semibold mb-4">Today's Overview</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Active Bookings</span>
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pending Requests</span>
                    <span className="font-bold text-warning">2</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Available Vehicles</span>
                    <span className="font-bold text-success">2</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Today's Revenue</span>
                    <span className="font-bold text-accent">$2,040</span>
                  </div>
                </div>
              </Card>

              <Card className="card-premium">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button className="w-full btn-premium">
                    <Plus className="h-4 w-4 mr-2" />
                    New Booking
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    View All Bookings
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Export Calendar
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Active Bookings</h3>
              <Badge variant="outline">{upcomingBookings.length} active</Badge>
            </div>
            
            <div className="space-y-4">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="p-4 border rounded-lg hover:bg-muted/30 cursor-pointer"
                     onClick={() => setSelectedBooking(booking.id)}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <Car className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{booking.vehicle}</span>
                        <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                          {booking.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{booking.customer}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{booking.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{booking.email}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{booking.startDate} - {booking.endDate}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{booking.pickup}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">${booking.totalAmount}</span>
                            <span className="text-muted-foreground">({booking.duration})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">View</Button>
                      <Button size="sm">Edit</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pending Requests</h3>
              <Badge variant="outline" className="bg-warning/10 text-warning">
                {bookingRequests.length} pending
              </Badge>
            </div>
            
            <div className="space-y-4">
              {bookingRequests.map((request) => (
                <div key={request.id} className="p-4 border rounded-lg bg-warning/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <Car className="h-5 w-5 text-warning" />
                        <span className="font-semibold">{request.vehicle}</span>
                        <Badge variant="outline" className="text-warning">Pending Approval</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Customer: {request.customer}</div>
                        <div>Requested: {request.requestDate}</div>
                        <div>Duration: {request.startDate} - {request.endDate}</div>
                        <div className="font-semibold text-foreground">Amount: ${request.amount}</div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="text-destructive border-destructive">
                        Decline
                      </Button>
                      <Button size="sm" className="bg-success hover:bg-success/90">
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <Badge className="metric-positive">+23%</Badge>
              </div>
              <div className="text-2xl font-bold text-primary">156</div>
              <div className="text-sm text-muted-foreground">Total Bookings (YTD)</div>
            </Card>

            <Card className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-success" />
                <Badge className="metric-positive">+18%</Badge>
              </div>
              <div className="text-2xl font-bold text-primary">$245K</div>
              <div className="text-sm text-muted-foreground">Booking Revenue (YTD)</div>
            </Card>

            <Card className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-accent" />
                <Badge variant="outline">4.2 days</Badge>
              </div>
              <div className="text-2xl font-bold text-primary">87%</div>
              <div className="text-sm text-muted-foreground">Booking Conversion</div>
            </Card>
          </div>

          <Card className="card-premium">
            <h3 className="text-lg font-semibold mb-4">Booking Trends</h3>
            <div className="space-y-4">
              {[
                { month: "Oct 2024", bookings: 23, revenue: 42500, growth: "+15%" },
                { month: "Nov 2024", bookings: 28, revenue: 51200, growth: "+20%" },
                { month: "Dec 2024", bookings: 25, revenue: 47800, growth: "-7%" }
              ].map((month, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium w-20">{month.month}</span>
                    <Badge variant="outline">{month.bookings} bookings</Badge>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="font-bold text-success">${month.revenue.toLocaleString()}</span>
                    <Badge className={month.growth.startsWith('+') ? 'metric-positive' : 'metric-negative'}>
                      {month.growth}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Book;