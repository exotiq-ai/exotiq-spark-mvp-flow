import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Eye, Settings } from "lucide-react";

const Book = () => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-premium">
          <h3 className="text-lg font-semibold mb-4">Calendar Management</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <Calendar className="h-8 w-8 text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Calendar integration coming soon</p>
            </div>
          </div>
        </Card>

        <Card className="card-premium">
          <h3 className="text-lg font-semibold mb-4">Booking Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Active Bookings</span>
              <span className="font-bold">18</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pending Requests</span>
              <span className="font-bold">5</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Book;