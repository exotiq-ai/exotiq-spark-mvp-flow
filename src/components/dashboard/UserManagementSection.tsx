import { useState } from "react";
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
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
  permissions: string[];
}

export const UserManagementSection = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (value: string) => {
    // Limit search query to 100 characters to prevent performance issues
    if (value.length <= 100) {
      setSearchQuery(value);
    }
  };
  
  const users: User[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john.doe@exotiq.ai",
      role: "Admin",
      status: "active",
      lastActive: "2 hours ago",
      permissions: ["full_access", "billing", "user_management"]
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah.j@exotiq.ai",
      role: "Manager",
      status: "active",
      lastActive: "30 minutes ago",
      permissions: ["fleet_management", "bookings", "reports"]
    },
    {
      id: "3",
      name: "Mike Chen",
      email: "mike.chen@exotiq.ai",
      role: "Operator",
      status: "active",
      lastActive: "1 day ago",
      permissions: ["bookings", "customers"]
    },
    {
      id: "4",
      name: "Emma Wilson",
      email: "emma.w@exotiq.ai",
      role: "Operator",
      status: "inactive",
      lastActive: "5 days ago",
      permissions: ["bookings", "customers"]
    }
  ];

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "Manager":
        return "bg-primary/10 text-primary border-primary/20";
      case "Operator":
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

  const handleEditUser = (userId: string) => {
    toast({
      title: "Edit User",
      description: `Editing user ${userId}`,
    });
  };

  const handleDeleteUser = (userId: string) => {
    toast({
      title: "Delete User",
      description: `User ${userId} has been removed from the system.`,
      variant: "destructive"
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Total Users</div>
            </div>
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
          </div>
        </Card>

        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{users.filter(u => u.status === "active").length}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Active</div>
            </div>
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-success flex-shrink-0" />
          </div>
        </Card>

        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{users.filter(u => u.role === "Admin").length}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Admins</div>
            </div>
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-destructive flex-shrink-0" />
          </div>
        </Card>

        <Card className="card-premium p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{users.filter(u => u.role === "Manager").length}</div>
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
          {filteredUsers.map((user) => (
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
                    <Badge className={`${getRoleBadgeColor(user.role)} text-xs`}>
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
                    <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit User
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
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              No users found matching your search criteria.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
