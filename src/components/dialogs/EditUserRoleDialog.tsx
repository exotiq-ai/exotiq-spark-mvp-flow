import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Shield, Info, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'admin' | 'manager' | 'operator' | 'viewer';

interface UserWithRole {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: AppRole;
  permissions: string[];
  status: string;
}

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRole | null;
  onSave: (userId: string, role: AppRole, permissions: string[]) => Promise<void>;
}

const ROLE_CONFIG: Record<AppRole, { 
  label: string; 
  description: string; 
  defaultPermissions: string[];
  color: string;
}> = {
  admin: {
    label: "Admin",
    description: "Full system access including billing and user management",
    defaultPermissions: ["full_access", "billing", "user_management", "fleet_management", "bookings", "reports", "customers"],
    color: "bg-destructive/10 text-destructive border-destructive/20"
  },
  manager: {
    label: "Manager",
    description: "Fleet management, bookings, reports, and customer access",
    defaultPermissions: ["fleet_management", "bookings", "reports", "customers"],
    color: "bg-primary/10 text-primary border-primary/20"
  },
  operator: {
    label: "Operator",
    description: "Bookings, customers, and inspections access",
    defaultPermissions: ["bookings", "customers", "inspections"],
    color: "bg-accent/10 text-accent border-accent/20"
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to dashboard and reports",
    defaultPermissions: ["dashboard_view", "reports_view"],
    color: "bg-muted/10 text-muted-foreground border-muted/20"
  }
};

const ALL_PERMISSIONS = [
  { id: "full_access", label: "Full Access" },
  { id: "billing", label: "Billing" },
  { id: "user_management", label: "User Management" },
  { id: "fleet_management", label: "Fleet Management" },
  { id: "bookings", label: "Bookings" },
  { id: "reports", label: "Reports" },
  { id: "customers", label: "Customers" },
  { id: "inspections", label: "Inspections" },
  { id: "dashboard_view", label: "Dashboard View" },
  { id: "reports_view", label: "Reports View" },
];

export const EditUserRoleDialog = ({ 
  open, 
  onOpenChange, 
  user,
  onSave 
}: EditUserRoleDialogProps) => {
  const { user: currentUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [adminCount, setAdminCount] = useState<number>(0);

  // Check if this is editing your own role
  const isEditingSelf = user?.user_id === currentUser?.id;
  const isCurrentlyAdmin = user?.role === 'admin';
  const isDemotingFromAdmin = isCurrentlyAdmin && selectedRole !== 'admin';
  const isLastAdmin = adminCount <= 1;

  // Determine if save should be blocked
  const isSelfDemotion = isEditingSelf && isDemotingFromAdmin;
  const isRemovingLastAdmin = isDemotingFromAdmin && isLastAdmin;
  const isSaveBlocked = isSelfDemotion || isRemovingLastAdmin;

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedPermissions(user.permissions);
    }
  }, [user]);

  // Fetch admin count when dialog opens
  useEffect(() => {
    if (open) {
      const fetchAdminCount = async () => {
        const { count } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');
        setAdminCount(count || 0);
      };
      fetchAdminCount();
    }
  }, [open]);

  const handleRoleChange = (role: AppRole) => {
    setSelectedRole(role);
    // Auto-populate default permissions for the role
    setSelectedPermissions(ROLE_CONFIG[role].defaultPermissions);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSave = async () => {
    if (!user || isSaveBlocked) return;
    
    setIsSaving(true);
    try {
      await onSave(user.user_id, selectedRole, selectedPermissions);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Edit User Role
          </DialogTitle>
          <DialogDescription>
            Modify role and permissions for this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Self-demotion Warning */}
          {isSelfDemotion && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You cannot remove your own admin role. Ask another admin to change your role.
              </AlertDescription>
            </Alert>
          )}

          {/* Last Admin Warning */}
          {isRemovingLastAdmin && !isSelfDemotion && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is the last admin. At least one admin must exist at all times.
              </AlertDescription>
            </Alert>
          )}

          {/* User Info Header */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-primary/10">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">
                {user.name}
                {isEditingSelf && (
                  <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                )}
              </h4>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
            <Badge className={ROLE_CONFIG[user.role].color}>
              {ROLE_CONFIG[user.role].label}
            </Badge>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={(v) => handleRoleChange(v as AppRole)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_CONFIG) as AppRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    <div className="flex items-center gap-2">
                      <Badge className={`${ROLE_CONFIG[role].color} text-xs`}>
                        {ROLE_CONFIG[role].label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Role Description */}
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                {ROLE_CONFIG[selectedRole].description}
              </span>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-3">
              {ALL_PERMISSIONS.map((permission) => (
                <div key={permission.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission.id}
                    checked={selectedPermissions.includes(permission.id)}
                    onCheckedChange={() => handlePermissionToggle(permission.id)}
                  />
                  <label
                    htmlFor={permission.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {permission.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || isSaveBlocked} 
            className="btn-premium"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
