/**
 * SuperAdminDashboard - Support team interface for customer management
 * 
 * Purpose: Centralized dashboard for Exotiq support to:
 * - View all customer accounts
 * - Search and filter users
 * - View system-wide statistics
 * - Access audit logs
 * - (Future: Impersonate users, manage billing)
 * 
 * Access: Protected by SuperAdminGuard - only accessible to super admins
 */

import { useState, useEffect } from 'react';
import { SuperAdminBillingTab } from '@/components/super-admin/SuperAdminBillingTab';
import { MaintenanceModeSection } from '@/components/super-admin/MaintenanceModeSection';
import { PlatformPulseStrip } from '@/components/super-admin/PlatformPulseStrip';
import { TenantHealthTab } from '@/components/super-admin/TenantHealthTab';
import { VehicleAuditTab } from '@/components/super-admin/VehicleAuditTab';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Shield,
  Users,
  Search,
  Database,
  AlertCircle,
  ArrowLeft,
  CreditCard,
  Wrench,
  Activity,
  Car,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";

interface Customer {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role?: string;
}


interface AuditLogEntry {
  id: string;
  action: string;
  user_id: string;
  changed_by: string | null;
  created_at: string | null;
  metadata: unknown;
}

export const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);


  // Log super admin access
  useEffect(() => {
    const logAccess = async () => {
      if (!user) return;

      try {
        await supabase.rpc('log_admin_action', {
          p_action: 'view_dashboard',
          p_details: {
            timestamp: new Date().toISOString(),
            page: 'super_admin_dashboard'
          }
        });
      } catch (error) {
        console.error('[SuperAdmin] Failed to log access:', error);
      }
    };

    logAccess();
  }, [user]);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_super_admin_customers');
        if (error) throw error;

        const combinedCustomers: Customer[] = (data || []).map((row: Customer) => ({
          id: row.id,
          email: row.email || 'No email',
          full_name: row.full_name || null,
          created_at: row.created_at,
          role: row.role || 'viewer'
        }));

        setCustomers(combinedCustomers);
        setFilteredCustomers(combinedCustomers);
      } catch (error) {
        console.error('[SuperAdmin] Error fetching customers:', error);
        toast.error("Error loading customers", { description: error instanceof Error ? error.message : "Unknown error" });
      }
    };

    fetchCustomers();
  }, [toast]);


  // Fetch recent audit logs from role_audit_log table
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_super_admin_audit_logs');

        if (error) throw error;
        setAuditLogs(data || []);
      } catch (error) {
        console.error('[SuperAdmin] Error fetching audit logs:', error);
      }
    };

    fetchAuditLogs();
  }, []);

  // Filter customers based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = customers.filter(c => 
      c.email.toLowerCase().includes(term) ||
      (c.full_name && c.full_name.toLowerCase().includes(term))
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Customer support & system management
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToDashboard}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Button>
        </div>

        {/* Warning Badge */}
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>
                <strong>Super Admin Mode:</strong> You have full read access to all customer data. All actions are logged.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Platform Pulse */}
        <PlatformPulseStrip />


        {/* Main Content Tabs */}
        <Tabs defaultValue="tenants" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="tenants">
              <Activity className="h-4 w-4 mr-2" />
              Tenant Health
            </TabsTrigger>
            <TabsTrigger value="vehicle-audit">
              <Car className="h-4 w-4 mr-2" />
              Vehicle Audit
            </TabsTrigger>
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Wrench className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Database className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
            <TenantHealthTab />
          </TabsContent>

          <TabsContent value="vehicle-audit" className="space-y-4">
            <VehicleAuditTab />
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <SuperAdminBillingTab />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <MaintenanceModeSection />
          </TabsContent>




          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Search</CardTitle>
                <CardDescription>
                  Search by email or name to view customer details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Customer List */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No customers found' : 'No customers yet'}
                    </div>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{customer.full_name || 'No name'}</p>
                            <Badge variant="outline" className="text-xs">
                              {customer.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined {new Date(customer.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Admin Actions</CardTitle>
                <CardDescription>
                  All super admin actions are logged for security and compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit logs yet
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {log.action}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1">
                            <span className="font-medium">User: {log.user_id.slice(0, 8)}...</span>
                            {log.changed_by && log.changed_by !== log.user_id && (
                              <>
                                {' by '}
                                <span className="text-muted-foreground">{log.changed_by.slice(0, 8)}...</span>
                              </>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown date'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
