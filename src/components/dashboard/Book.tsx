import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Plus, Eye, Settings, Upload } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const Book = () => {
  const [date, setDate] = useState<Date>();

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
            </div>
            
            {/* Booking Grid */}
            <div className="grid grid-cols-7 gap-2 text-sm">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 font-medium text-center text-muted-foreground">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }, (_, i) => (
                <div key={i} className="p-2 h-20 border rounded-lg bg-muted/10 hover:bg-muted/20 cursor-pointer">
                  <div className="text-xs text-muted-foreground">{(i % 31) + 1}</div>
                  {Math.random() > 0.7 && (
                    <div className="text-xs bg-primary/20 text-primary px-1 rounded mt-1">
                      Booked
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="card-premium">
            <h3 className="text-lg font-semibold mb-4">Booking Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Active Bookings</span>
                <span className="font-bold text-primary">18</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Requests</span>
                <span className="font-bold text-warning">5</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Available Vehicles</span>
                <span className="font-bold text-success">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Monthly Revenue</span>
                <span className="font-bold text-accent">$24,680</span>
              </div>
            </div>
          </Card>

          <Card className="card-premium">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button className="w-full" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View All Bookings
              </Button>
              <Button className="w-full" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Export Calendar
              </Button>
              <Button className="w-full btn-premium">
                <Plus className="h-4 w-4 mr-2" />
                Manual Booking
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Book;