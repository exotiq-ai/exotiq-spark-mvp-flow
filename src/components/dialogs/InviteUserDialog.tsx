import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, UserPlus, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AppRole = 'admin' | 'manager' | 'operator' | 'viewer';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ROLE_CONFIG: Record<AppRole, {
  label: string;
  description: string;
  defaultPermissions: string[];
}> = {
  admin: {
    label: "Admin",
    description: "Full system access including user management",
    defaultPermissions: ['full_access', 'billing', 'user_management', 'fleet_management', 'bookings', 'reports', 'customers'],
  },
  manager: {
    label: "Manager",
    description: "Can manage fleet, bookings, and view reports",
    defaultPermissions: ['fleet_management', 'bookings', 'reports', 'customers'],
  },
  operator: {
    label: "Operator",
    description: "Can handle bookings and customer interactions",
    defaultPermissions: ['bookings', 'customers', 'inspections'],
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to dashboard",
    defaultPermissions: ['dashboard_view'],
  },
};

const ALL_PERMISSIONS = [
  { id: 'full_access', label: 'Full Access' },
  { id: 'billing', label: 'Billing' },
  { id: 'user_management', label: 'User Management' },
  { id: 'fleet_management', label: 'Fleet Management' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'reports', label: 'Reports' },
  { id: 'customers', label: 'Customers' },
  { id: 'inspections', label: 'Inspections' },
  { id: 'dashboard_view', label: 'Dashboard View' },
];

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("viewer");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(ROLE_CONFIG.viewer.defaultPermissions);
  const [isSending, setIsSending] = useState(false);

  const handleRoleChange = (role: AppRole) => {
    setSelectedRole(role);
    setSelectedPermissions(ROLE_CONFIG[role].defaultPermissions);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSendInvitation = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          role: selectedRole,
          permissions: selectedPermissions,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${email}`,
      });

      // Reset form
      setEmail("");
      setSelectedRole("viewer");
      setSelectedPermissions(ROLE_CONFIG.viewer.defaultPermissions);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to send invitation:", error);
      toast({
        title: "Failed to send invitation",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Send an email invitation to add a new team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={(value) => handleRoleChange(value as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <SelectItem key={role} value={role}>
                    <div className="flex flex-col">
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLE_CONFIG[selectedRole].description}
            </p>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((permission) => (
                <div key={permission.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission.id}
                    checked={selectedPermissions.includes(permission.id)}
                    onCheckedChange={() => handlePermissionToggle(permission.id)}
                  />
                  <label
                    htmlFor={permission.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {permission.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The invitation will be valid for 7 days. The user will receive an email with a link to create their account.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSendInvitation} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
