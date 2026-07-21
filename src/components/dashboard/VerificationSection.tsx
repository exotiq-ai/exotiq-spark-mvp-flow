import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  IdCard,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Upload,
  Eye,
  RefreshCw,
  Users,
  ShieldQuestion,
  Copy,
  Mail,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { InsuranceUploadDialog } from "@/components/dialogs/InsuranceUploadDialog";

interface CustomerVerification {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  drivers_license: string | null;
  license_expiry: string | null;
  insurance_provider: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  id_verified: boolean;
  id_document_url: string | null;
  id_verified_at: string | null;
  insurance_verified: boolean;
  insurance_document_url: string | null;
  insurance_verified_at: string | null;
  total_bookings: number | null;
  identity_status: string | null;
  identity_session_id: string | null;
}

type IdentityStatus =
  | "created"
  | "processing"
  | "verified"
  | "requires_input"
  | "manual_review"
  | "canceled"
  | "redacted";

export const VerificationSection = () => {
  const { customers, loading: fleetLoading, refreshCustomers } = useLocationFilteredFleet();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerVerification | null>(null);
  const [insuranceUploadOpen, setInsuranceUploadOpen] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{
    customer: CustomerVerification;
    url: string;
  } | null>(null);


  useEffect(() => {
    if (!fleetLoading) {
      setLoading(false);
    }
  }, [fleetLoading]);

  const customerList = customers as unknown as CustomerVerification[];

  // Calculate verification stats
  const isIdVerified = (c: CustomerVerification) => c.id_verified || c.identity_status === "verified";
  const verifiedCount = customerList.filter(c => isIdVerified(c) && c.insurance_verified).length;
  const partialCount = customerList.filter(c => isIdVerified(c) !== c.insurance_verified).length;
  const unverifiedCount = customerList.filter(c => !isIdVerified(c) && !c.insurance_verified).length;
  const expiringCount = customerList.filter(c => {
    if (!c.license_expiry && !c.insurance_expiry) return false;
    const licenseExpiring = c.license_expiry && differenceInDays(new Date(c.license_expiry), new Date()) <= 30;
    const insuranceExpiring = c.insurance_expiry && differenceInDays(new Date(c.insurance_expiry), new Date()) <= 30;
    return licenseExpiring || insuranceExpiring;
  }).length;

  const verificationRate = customerList.length > 0 
    ? Math.round((verifiedCount / customerList.length) * 100) 
    : 0;

  const filteredCustomers = customerList.filter(customer => 
    customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.drivers_license?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getVerificationStatus = (customer: CustomerVerification) => {
    if (customer.id_verified && customer.insurance_verified) {
      return { label: "Verified", variant: "default" as const, icon: CheckCircle2 };
    }
    if (customer.id_verified || customer.insurance_verified) {
      return { label: "Partial", variant: "secondary" as const, icon: Clock };
    }
    return { label: "Unverified", variant: "outline" as const, icon: XCircle };
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return { label: "Expired", variant: "destructive" as const };
    if (days <= 30) return { label: `${days}d left`, variant: "secondary" as const };
    return { label: "Valid", variant: "default" as const };
  };

  const handleUploadComplete = async () => {
    await refreshCustomers();
    setInsuranceUploadOpen(false);
    setSelectedCustomer(null);
    toast.success("Document uploaded successfully");
  };

  const getIdentityBadge = (
    status: string | null,
    idVerifiedAt: string | null,
  ): { label: string; className: string; Icon: typeof CheckCircle2 } | null => {
    switch (status as IdentityStatus | null) {
      case "verified":
        return {
          label: idVerifiedAt
            ? `ID Verified · ${format(new Date(idVerifiedAt), "MMM d, yyyy")}`
            : "ID Verified",
          className: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
          Icon: CheckCircle2,
        };
      case "created":
        return {
          label: "Link sent",
          className: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100",
          Icon: Clock,
        };
      case "processing":
        return {
          label: "Processing",
          className: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100",
          Icon: Clock,
        };
      case "requires_input":
        return {
          label: "Action needed",
          className: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
          Icon: AlertTriangle,
        };
      case "manual_review":
        return {
          label: "Needs review",
          className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
          Icon: AlertTriangle,
        };
      case "canceled":
        return {
          label: "Canceled",
          className: "bg-muted text-muted-foreground border-border hover:bg-muted",
          Icon: XCircle,
        };
      case "redacted":
        return {
          label: "Expired / redacted",
          className: "bg-muted text-muted-foreground border-border hover:bg-muted",
          Icon: XCircle,
        };
      default:
        return null;
    }
  };

  const handleVerifyId = async (customer: CustomerVerification) => {
    setVerifyingId(customer.id);
    try {
      const { data, error } = await supabase.functions.invoke("identity-create-session", {
        body: { customer_id: customer.id },
      });

      // Manual review: edge function returns HTTP 409. supabase.functions.invoke
      // surfaces non-2xx as an error with a context.response we can inspect.
      if (error) {
        const resp = (error as any)?.context;
        if (resp && typeof resp.json === "function") {
          try {
            const payload = await resp.json();
            if (payload?.status === "manual_review") {
              toast.error("This customer has reached the self-serve attempt limit. Needs manual review.");
              await refreshCustomers();
              return;
            }
          } catch {
            /* fall through */
          }
        }
        throw error;
      }

      if (data?.status === "verified" && data?.reused) {
        toast.success("Already verified");
        await refreshCustomers();
        return;
      }

      if (data?.url) {
        setLinkDialog({ customer, url: data.url });
        await refreshCustomers();
        return;
      }

      toast.error("Could not start verification");
    } catch (err: any) {
      console.error("[VerificationSection] identity-create-session failed", err);
      toast.error(err?.message || "Could not start verification");
    } finally {
      setVerifyingId(null);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Verification link copied");
    } catch {
      toast.error("Copy failed — select the link manually");
    }
  };

  const emailLink = (customer: CustomerVerification, url: string) => {
    const subject = encodeURIComponent("Verify your ID for your upcoming rental");
    const body = encodeURIComponent(
      `Hi ${customer.full_name?.split(" ")[0] || "there"},\n\n` +
        `Please complete your ID verification using the secure link below. It only takes a minute:\n\n${url}\n\n` +
        `Thank you.`,
    );
    window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, "_blank");
  };


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
            <CardTitle className="text-sm font-medium">Fully Verified</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{verifiedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ID & Insurance verified
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partial Verification</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{partialCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Missing documents
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unverified</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unverifiedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No documents on file
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{expiringCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Within 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Verification Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fleet Verification Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer verification progress</span>
              <span className="font-medium">{verificationRate}%</span>
            </div>
            <Progress value={verificationRate} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {verifiedCount} of {customerList.length} customers fully verified
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customer Verification List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Verification Status
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refreshCustomers()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No customers found</p>
              <p className="text-sm">Add customers to start verification</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer) => {
                const status = getVerificationStatus(customer);
                const StatusIcon = status.icon;
                const licenseStatus = getExpiryStatus(customer.license_expiry);
                const insuranceStatus = getExpiryStatus(customer.insurance_expiry);

                return (
                  <div
                    key={customer.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        status.variant === "default" ? "bg-emerald-100 text-emerald-600" :
                        status.variant === "secondary" ? "bg-amber-100 text-amber-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{customer.full_name}</p>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                      {/* ID Status */}
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        {(() => {
                          const badge = getIdentityBadge(
                            customer.identity_status,
                            customer.id_verified_at,
                          );
                          const isVerified =
                            customer.identity_status === "verified" || customer.id_verified;

                          if (isVerified) {
                            const Icon = badge?.Icon ?? CheckCircle2;
                            return (
                              <Badge
                                variant="outline"
                                className={
                                  badge?.className ??
                                  "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                }
                              >
                                <Icon className="h-3 w-3 mr-1" />
                                {badge?.label ?? "ID Verified"}
                              </Badge>
                            );
                          }

                          return (
                            <>
                              {badge && (
                                <Badge variant="outline" className={badge.className}>
                                  <badge.Icon className="h-3 w-3 mr-1" />
                                  {badge.label}
                                </Badge>
                              )}
                              {/* Show verify button unless we're mid-flow */}
                              {(!badge ||
                                customer.identity_status === "requires_input" ||
                                customer.identity_status === "canceled") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={verifyingId === customer.id}
                                  onClick={() => handleVerifyId(customer)}
                                >
                                  <ShieldQuestion className="h-3 w-3 mr-1" />
                                  {verifyingId === customer.id
                                    ? "Starting…"
                                    : customer.identity_status
                                      ? "Resend link"
                                      : "Verify ID"}
                                </Button>
                              )}
                              {customer.identity_session_id && (
                                <a
                                  href={`https://dashboard.stripe.com/${import.meta.env.PROD ? '' : 'test/'}identity/verification-sessions/${customer.identity_session_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                                  title="View in Stripe"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </>
                          );
                        })()}
                        {licenseStatus && (
                          <Badge variant={licenseStatus.variant} className="text-xs">
                            {licenseStatus.label}
                          </Badge>
                        )}
                      </div>


                      {/* Insurance Status */}
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                        {customer.insurance_verified ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Insurance
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setInsuranceUploadOpen(true);
                            }}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload Insurance
                          </Button>
                        )}
                        {insuranceStatus && (
                          <Badge variant={insuranceStatus.variant} className="text-xs">
                            {insuranceStatus.label}
                          </Badge>
                        )}
                      </div>

                      {/* View Documents */}
                      {(customer.id_document_url || customer.insurance_document_url) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            // Open document preview
                            const url = customer.id_document_url || customer.insurance_document_url;
                            if (url) window.open(url, "_blank");
                          }}
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Dialogs */}
      <InsuranceUploadDialog
        open={insuranceUploadOpen}
        onOpenChange={setInsuranceUploadOpen}
        customer={selectedCustomer}
        onComplete={handleUploadComplete}
      />

      {/* Verification link dialog (Stripe Identity hosted URL) */}
      <Dialog open={!!linkDialog} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verification link ready</DialogTitle>
            <DialogDescription>
              Share this secure Stripe Identity link with {linkDialog?.customer.full_name}. The link
              guides them through document + selfie capture — no ID images are stored in Exotiq.
            </DialogDescription>
          </DialogHeader>
          {linkDialog && (
            <div className="rounded-md border bg-muted/40 p-2 text-xs break-all font-mono">
              {linkDialog.url}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            {linkDialog && (
              <>
                <Button variant="outline" onClick={() => copyLink(linkDialog.url)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy link
                </Button>
                <Button onClick={() => emailLink(linkDialog.customer, linkDialog.url)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email to customer
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
