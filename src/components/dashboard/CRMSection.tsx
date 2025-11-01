import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFleet } from "@/contexts/FleetContext";
import { SkeletonMetric, SkeletonTable } from "@/components/ui/skeleton-card";
import { EmptyState } from "@/components/common/EmptyState";
import { 
  Users, 
  Search, 
  Star, 
  AlertTriangle,
  TrendingUp,
  Phone,
  Mail,
  Plus,
  Filter
} from "lucide-react";
import { CustomerProfileDialog } from "@/components/dialogs/CustomerProfileDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";

export const CRMSection = () => {
  const { customers, bookings, createCustomer, loading } = useFleet();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchQuery));
    
    const matchesFilter = 
      filterStatus === "all" || 
      customer.customer_status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const vipCustomers = customers.filter(c => c.customer_status === 'vip');
  const activeCustomers = customers.filter(c => c.customer_status === 'active' || c.customer_status === 'vip');
  const totalRevenue = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0);
  const avgBookings = customers.length > 0 
    ? (customers.reduce((sum, c) => sum + (c.total_bookings || 0), 0) / customers.length).toFixed(1)
    : '0';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'vip':
        return <Badge className="bg-primary/10 text-primary border-primary/30"><Star className="w-3 h-3 mr-1" />VIP</Badge>;
      case 'blacklisted':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Blacklisted</Badge>;
      default:
        return <Badge className="bg-success/10 text-success border-success/30">Active</Badge>;
    }
  };

  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowCustomerProfile(true);
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </div>
        <Card className="card-premium p-6">
          <SkeletonTable rows={6} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CRM Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-primary" />
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold">{customers.length}</div>
          <div className="text-sm text-muted-foreground">Total Customers</div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <Star className="h-5 w-5 text-primary" />
            <Badge className="bg-primary/10 text-primary">{vipCustomers.length}</Badge>
          </div>
          <div className="text-2xl font-bold">{Math.round((vipCustomers.length / Math.max(customers.length, 1)) * 100)}%</div>
          <div className="text-sm text-muted-foreground">VIP Customers</div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-xs text-success">+12%</span>
          </div>
          <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total CLV</div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-accent" />
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold">{avgBookings}</div>
          <div className="text-sm text-muted-foreground">Avg Bookings/Customer</div>
        </Card>
      </div>

      {/* Customer List */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Customer Database</h3>
          <Button onClick={() => setShowAddCustomer(true)} className="btn-premium">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              <Filter className="w-4 h-4 mr-2" />
              All ({customers.length})
            </Button>
            <Button
              variant={filterStatus === "vip" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("vip")}
            >
              <Star className="w-4 h-4 mr-2" />
              VIP ({vipCustomers.length})
            </Button>
            <Button
              variant={filterStatus === "blacklisted" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("blacklisted")}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Flagged
            </Button>
          </div>
        </div>

        {/* Customer Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleCustomerClick(customer.id)}
              className="p-4 rounded-lg bg-muted/30 border border-primary/10 hover-scale cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{customer.full_name}</h4>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
                {getStatusBadge(customer.customer_status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Total Bookings</div>
                  <div className="font-medium">{customer.total_bookings || 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Lifetime Value</div>
                  <div className="font-medium text-success">${(customer.lifetime_value || 0).toLocaleString()}</div>
                </div>
              </div>

              {customer.phone && (
                <div className="flex items-center space-x-2 mt-3 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>
          ))}

          {filteredCustomers.length === 0 && searchQuery === "" && filterStatus === "all" && (
            <div className="col-span-2">
              <EmptyState
                icon={<Users className="h-16 w-16" />}
                title="No customers yet"
                description="Start building your customer base by adding your first customer. Track bookings, lifetime value, and communication history."
                action={{
                  label: "Add First Customer",
                  onClick: () => setShowAddCustomer(true)
                }}
              />
            </div>
          )}
          
          {filteredCustomers.length === 0 && (searchQuery !== "" || filterStatus !== "all") && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No customers match your filters</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Dialogs */}
      {selectedCustomer && (
        <CustomerProfileDialog
          open={showCustomerProfile}
          onOpenChange={setShowCustomerProfile}
          customer={selectedCustomer}
          bookings={bookings.filter(b => b.customer_id === selectedCustomer.id)}
        />
      )}

      <AddCustomerDialog
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onSubmit={createCustomer}
      />
    </div>
  );
};
