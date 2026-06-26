import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  Download, 
  Search, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  XCircle,
  CreditCard,
  Banknote,
  ArrowUpRight,
  Filter,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { PaymentExportDialog } from "@/components/dialogs/PaymentExportDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  description: string;
  customer_email: string | null;
  customer_name: string | null;
  payment_method: string;
  receipt_url: string | null;
}

interface LocalPayment {
  id: string;
  amount: number;
  payment_type: string;
  payment_method: string | null;
  payment_status: string | null;
  transaction_date: string | null;
  created_at: string | null;
  notes: string | null;
  bookings: {
    customer_name: string;
    customer_email: string | null;
    vehicle_id: string;
    vehicles: { name: string; make: string; model: string } | null;
  } | null;
}

interface BalanceData {
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  payouts: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    arrival_date: string;
    created: string;
    description: string;
    method: string;
  }>;
  summary: {
    total_collected: number;
    pending_deposits_count: number;
    held_security_deposits: Array<{
      id: string;
      customer_name: string;
      security_deposit_amount: number;
      security_deposit_status: string;
    }>;
  };
}

export const PaymentsSection = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stripePayments, setStripePayments] = useState<StripePayment[]>([]);
  const [localPayments, setLocalPayments] = useState<LocalPayment[]>([]);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const fetchPaymentData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to view payments");
        return;
      }

      // Fetch payment history
      const { data: historyData, error: historyError } = await supabase.functions.invoke(
        "stripe-payment-history",
        {
          body: { limit: 50 },
        }
      );

      if (historyError) {
        console.error("Payment history error:", historyError);
      } else if (historyData) {
        setStripePayments(historyData.stripe_payments || []);
        setLocalPayments(historyData.local_payments || []);
      }

      // Fetch balance data
      const { data: balData, error: balError } = await supabase.functions.invoke(
        "stripe-get-balance"
      );

      if (balError) {
        console.error("Balance error:", balError);
      } else if (balData) {
        setBalanceData(balData);
      }
    } catch (error) {
      console.error("Error fetching payment data:", error);
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPaymentData();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      succeeded: { variant: "default", icon: CheckCircle2 },
      completed: { variant: "default", icon: CheckCircle2 },
      pending: { variant: "secondary", icon: Clock },
      processing: { variant: "secondary", icon: Clock },
      failed: { variant: "destructive", icon: XCircle },
      canceled: { variant: "outline", icon: XCircle },
    };

    const config = statusConfig[status?.toLowerCase()] || { variant: "outline" as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const filteredLocalPayments = localPayments.filter((payment) => {
    const matchesSearch = 
      payment.bookings?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.bookings?.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.payment_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || payment.payment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(balanceData?.balance.available || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for payout
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(balanceData?.balance.pending || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Processing payments
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(balanceData?.summary.total_collected || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time revenue
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Deposits Held</CardTitle>
            <Banknote className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {balanceData?.summary.held_security_deposits?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active deposits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Payouts */}
      {balanceData?.payouts && balanceData.payouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              Upcoming Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {balanceData.payouts.slice(0, 3).map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{formatCurrency(payout.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      Arriving {format(new Date(payout.arrival_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Deposits Held */}
      {balanceData?.summary.held_security_deposits && balanceData.summary.held_security_deposits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-purple-500" />
              Security Deposits Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {balanceData.summary.held_security_deposits.map((deposit) => (
                <div key={deposit.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{deposit.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(deposit.security_deposit_amount || 0)}
                    </p>
                  </div>
                  <Badge variant="secondary">Held</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment History
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLocalPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payments found</p>
              <p className="text-sm">Payments will appear here once you start collecting</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLocalPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.bookings?.customer_name || "Unknown Customer"}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.bookings?.vehicles?.make} {payment.bookings?.vehicles?.model} • {payment.payment_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(payment.amount || 0)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.created_at ? format(new Date(payment.created_at), "MMM d, yyyy") : "N/A"}
                      </p>
                    </div>
                    {getStatusBadge(payment.payment_status || "pending")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </div>
  );
};
