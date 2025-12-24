import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Search, 
  UserPlus, 
  Shield, 
  Mail, 
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EditUserRoleDialog, type AppRole } from "@/components/dialogs/EditUserRoleDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface UserWithRole {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: AppRole;
  permissions: string[];
  status: string;
  lastActive: string;
}

export const UserManagementSection = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, updated_at');

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const mergedUsers: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const lastUpdated = profile.updated_at 
          ? new Date(profile.updated_at)
          : new Date();
        const now = new Date();
        const diffMs = now.getTime() - lastUpdated.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        let lastActive = "Just now";
        if (diffDays > 0) {
          lastActive = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
          lastActive = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMins > 0) {
          lastActive = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        }

        return {
          id: userRole?.id || profile.id,
          user_id: profile.id,
          name: profile.full_name || 'Unknown User',
          email: profile.email,
          role: (userRole?.role as AppRole) || 'viewer',
          permissions: userRole?.permissions || [],
          status: 'active',
          lastActive
        };
      });

      setUsers(mergedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchChange = (value: string) => {
    if (value.length <= 100) {
      setSearchQuery(value);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "manager":
        return "bg-primary/10 text-primary border-primary/20";
      case "operator":
        return "bg-accent/10 text-accent border-accent/20";
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === "active" 
      ? "bg-success/10 text-success border-success/20"
      : "bg-muted/10 text-muted-foreground border-muted/20";
  };

  const handleAddUser = () => {
    toast({
      title: "Feature Coming Soon",
      description: "User creation interface will be available in the next update.",
    });
  };

  const handleEditUser = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleSaveRole = async (userId: string, role: AppRole, permissions: string[]) => {
    try {
      // Check if user already has a role entry
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role, permissions })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role, permissions });

        if (error) throw error;
      }

      toast({
        title: "Role Updated",
        description: "User role and permissions have been updated successfully.",
      });

      // Refresh user list
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role. You may not have admin permissions.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = (userId: string) => {
    toast({
      title: "Delete User",
      description: `User ${userId} has been removed from the system.`,
      variant: "destructive"
    });
  };

  const activeUsers = users.filter(u => u.status === "active").length;
  const adminCount = users.filter(u => u.role === "admin").length;
  const managerCount = users.filter(u => u.role === "manager").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Total Users</div>
            </div>
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
          </div>
        </Card>

        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold">{activeUsers}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Active</div>
            </div>
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-success flex-shrink-0" />
          </div>
        </Card>

        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold">{adminCount}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Admins</div>
            </div>
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-destructive flex-shrink-0" />
          </div>
        </Card>

        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold">{managerCount}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Managers</div>
            </div>
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-accent flex-shrink-0" />
          </div>
        </Card>
      </div>

      {/* User List */}
      <Card className="card-premium p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold">User Management</h3>
          <Button onClick={handleAddUser} className="btn-premium w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            maxLength={100}
          />
        </div>

        <div className="space-y-3 sm:space-y-4">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 sm:p-4 rounded-lg bg-muted/30 border border-primary/10">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="p-3 sm:p-4 rounded-lg bg-muted/30 border border-primary/10 hover:border-primary/20 transition-smooth">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name and badges */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                      <h4 className="font-semibold text-sm sm:text-base truncate">{user.name}</h4>
                      <Badge className={`${getRoleBadgeColor(user.role)} text-xs capitalize`}>
                        {user.role}
                      </Badge>
                      <Badge className={`${getStatusBadgeColor(user.status)} text-xs`}>
                        {user.status}
                      </Badge>
                    </div>
                    
                    {/* Email and last active - stacked on mobile */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="whitespace-nowrap">Last active: {user.lastActive}</span>
                      </div>
                    </div>

                    {/* Permissions - wrap on mobile */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Permissions:</span>
                      {user.permissions.slice(0, 2).map((permission, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {permission.replace(/_/g, " ")}
                        </Badge>
                      ))}
                      {user.permissions.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.permissions.length - 2}
                        </Badge>
                      )}
                      {user.permissions.length === 0 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          No permissions
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditUser(user)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Role
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}

          {!isLoading && filteredUsers.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              No users found matching your search criteria.
            </div>
          )}
        </div>
      </Card>

      {/* Edit User Role Dialog */}
      <EditUserRoleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSave={handleSaveRole}
      />
    </div>
  );
};
