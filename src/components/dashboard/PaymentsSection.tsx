import { useState, useEffect, useRef } from "react";
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
import { useTeam } from "@/contexts/TeamContext";
import { useMoney } from "@/hooks/useMoney";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { describeFunctionError } from "@/lib/functionError";

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
    balance_due: number;
    balance_due_count: number;
    outstanding?: OutstandingBooking[];
  };
}

interface OutstandingBooking {
  id: string;
  booking_ref: string | null;
  customer_name: string | null;
  customer_email: string | null;
  vehicle_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  booking_source: string | null;
  payment_due_at: string | null;
  amount_due: number;
  total_value: number;
}

const PAGE_SIZE = 50;
const VISIBLE_OUTSTANDING = 6;

export const PaymentsSection = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [stripePayments, setStripePayments] = useState<StripePayment[]>([]);
  const [localPayments, setLocalPayments] = useState<LocalPayment[]>([]);
  const [localTotal, setLocalTotal] = useState(0);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [sendingLinkId, setSendingLinkId] = useState<string | null>(null);
  const { currentTeam } = useTeam();
  const { money } = useMoney();
  const { goToPayments, goToBookingDetails } = useModuleNavigation();
  const outstandingRef = useRef<HTMLDivElement | null>(null);

  const outstanding = balanceData?.summary.outstanding ?? [];

  const scrollToOutstanding = () => {
    outstandingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sendPaymentLink = async (b: OutstandingBooking) => {
    setSendingLinkId(b.id);
    try {
      const { data, error } = await supabase.functions.invoke("rent-resend-payment-link", {
        body: { booking_id: b.id },
      });
      if (error) throw new Error(await describeFunctionError(error));
      toast.success(`Payment link emailed to ${data?.sent_to || b.customer_email || "the renter"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send payment link");
    } finally {
      setSendingLinkId(null);
    }
  };

  // Server-side search: the history lives in the database, not in the first
  // page of results, so the query goes to the backend rather than filtering
  // whatever happened to be loaded.
  const fetchHistory = async (opts: { search: string; offset: number; append: boolean }) => {
    const { data, error } = await supabase.functions.invoke("stripe-payment-history", {
      body: {
        limit: PAGE_SIZE,
        offset: opts.offset,
        search: opts.search,
        team_id: currentTeam?.id,
      },
    });
    if (error) {
      console.error("Payment history error:", error);
      return;
    }
    if (!data) return;
    setStripePayments(data.stripe_payments || []);
    setLocalPayments((prev) =>
      opts.append ? [...prev, ...(data.local_payments || [])] : (data.local_payments || []),
    );
    setLocalTotal(data.local_total ?? (data.local_payments?.length || 0));
  };

  const fetchPaymentData = async (search = debouncedQuery) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to view payments");
        return;
      }

      await fetchHistory({ search, offset: 0, append: false });

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
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchPaymentData("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeam?.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSearching(true);
    fetchHistory({ search: debouncedQuery, offset: 0, append: false }).finally(() =>
      setSearching(false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const handleLoadMore = async () => {
    setSearching(true);
    await fetchHistory({ search: debouncedQuery, offset: localPayments.length, append: true });
    setSearching(false);
  };

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

  // Search runs server-side across the whole team history; only the status
  // filter stays local since it applies to the already-returned page.
  const filteredLocalPayments = localPayments.filter(
    (payment) => statusFilter === "all" || payment.payment_status === statusFilter,
  );

  const hasMore = localPayments.length < localTotal;

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
              {money(balanceData?.balance.available || 0)}
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
              {money(balanceData?.balance.pending || 0)}
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
              {money(balanceData?.summary.total_collected || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time revenue
            </p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={scrollToOutstanding}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scrollToOutstanding(); } }}
          className="border-l-4 border-l-purple-500 cursor-pointer transition-colors hover:border-purple-500/60 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
            <Banknote className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {money(balanceData?.summary.balance_due || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {balanceData?.summary.balance_due_count || 0} open bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Awaiting payment — who still owes money, straight from the tile above */}
      <Card ref={outstandingRef}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-purple-500" />
              Awaiting payment
            </CardTitle>
            {outstanding.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => goToPayments()}>
                View all {outstanding.length > VISIBLE_OUTSTANDING ? `(${outstanding.length})` : ""}
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {outstanding.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50 text-emerald-500" />
              <p className="text-sm">Every open booking is paid up.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outstanding.slice(0, VISIBLE_OUTSTANDING).map((b) => {
                const isMarketplace = b.booking_source === "marketplace";
                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/30 transition-colors md:flex-row md:items-center md:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => goToBookingDetails(b.id)}
                      className="text-left min-w-0 flex-1"
                    >
                      <p className="font-medium truncate">
                        {b.customer_name || "Renter"}
                        {b.booking_ref ? <span className="text-muted-foreground font-normal"> · {b.booking_ref}</span> : null}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {b.vehicle_name || "Vehicle"}
                        {b.start_date ? ` · ${format(new Date(b.start_date), "MMM d")}` : ""}
                        {b.end_date ? ` – ${format(new Date(b.end_date), "MMM d, yyyy")}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isMarketplace ? "Collected automatically from the renter's card" : "Collected by you"}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <div className="mr-1">
                        <div className="text-base font-semibold text-purple-600">{money(b.amount_due)}</div>
                        <div className="text-xs text-muted-foreground">of {money(b.total_value)}</div>
                      </div>
                      {isMarketplace ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendingLinkId === b.id}
                          onClick={() => sendPaymentLink(b)}
                        >
                          {sendingLinkId === b.id ? "Sending..." : "Send payment link"}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => goToPayments(b.id)}>
                          Record payment
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <p className="font-medium">{money(payout.amount)}</p>
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
                  placeholder="Search name, email, booking ref, vehicle..."
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
                      <p className="font-semibold">{money(payment.amount || 0)}</p>
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
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={handleLoadMore} disabled={searching}>
                {searching ? "Loading..." : `Load more (${localTotal - localPayments.length} left)`}
              </Button>
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
