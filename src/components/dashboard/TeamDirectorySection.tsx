import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  MoreVertical, 
  Shield, 
  Users, 
  Eye, 
  Wrench,
  UserMinus,
  UserPlus,
  Edit
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { DeactivateUserDialog } from "@/components/dialogs/DeactivateUserDialog";
import { EditUserRoleDialog } from "@/components/dialogs/EditUserRoleDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  avatar_url: string | null;
  is_active: boolean;
  isCurrentUser: boolean;
}

const roleConfig: Record<AppRole, { icon: React.ElementType; color: string; label: string }> = {
  owner: { icon: Shield, color: "bg-primary text-primary-foreground", label: "Owner" },
  admin: { icon: Shield, color: "bg-destructive/10 text-destructive", label: "Admin" },
  manager: { icon: Users, color: "bg-warning/10 text-warning", label: "Manager" },
  operator: { icon: Wrench, color: "bg-success/10 text-success", label: "Operator" },
  viewer: { icon: Eye, color: "bg-muted text-muted-foreground", label: "Viewer" },
};

export const TeamDirectorySection = () => {
  const { user } = useAuth();
  const { isAdmin, isOwner } = useUserRole();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  
  const [deactivateUser, setDeactivateUser] = useState<TeamMember | null>(null);
  const [editUser, setEditUser] = useState<TeamMember | null>(null);

  const fetchTeamMembers = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, is_active");

      if (profilesError) throw profilesError;

      // Get roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]) || []);

      const members: TeamMember[] = (profiles || []).map(profile => ({
        id: profile.id,
        name: profile.full_name || profile.email.split("@")[0],
        email: profile.email,
        role: roleMap.get(profile.id) || "viewer",
        avatar_url: profile.avatar_url,
        is_active: profile.is_active ?? true,
        isCurrentUser: profile.id === user.id,
      }));

      // Sort: current user first, then by role hierarchy, then by name
      const roleOrder: AppRole[] = ["owner", "admin", "manager", "operator", "viewer"];
      members.sort((a, b) => {
        if (a.isCurrentUser) return -1;
        if (b.isCurrentUser) return 1;
        const roleCompare = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
        if (roleCompare !== 0) return roleCompare;
        return a.name.localeCompare(b.name);
      });

      setTeamMembers(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [user?.id]);

  const handleReactivate = async (member: TeamMember) => {
    try {
      const { error } = await supabase.rpc('reactivate_team_member', {
        target_user_id: member.id
      });

      if (error) throw error;

      toast({
        title: "User reactivated",
        description: `${member.name} has been reactivated`,
      });

      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Failed to reactivate user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = showInactive ? !member.is_active : member.is_active;
    return matchesSearch && matchesActive;
  });

  const activeCount = teamMembers.filter(m => m.is_active).length;
  const inactiveCount = teamMembers.filter(m => !m.is_active).length;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header with stats */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={showInactive ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? `Inactive (${inactiveCount})` : `Active (${activeCount})`}
              </Button>
            </div>
          </div>

          {/* Team list */}
          <div className="divide-y">
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {showInactive ? "No inactive members" : "No team members found"}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const config = roleConfig[member.role];
                const Icon = config.icon;

                return (
                  <div 
                    key={member.id} 
                    className={`flex items-center justify-between py-4 ${!member.is_active ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>
                          {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          {member.isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                          {!member.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={config.color}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>

                      {isAdmin && !member.isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditUser(member)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {member.is_active ? (
                              <DropdownMenuItem 
                                onClick={() => setDeactivateUser(member)}
                                className="text-warning"
                              >
                                <UserMinus className="w-4 h-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => handleReactivate(member)}
                                className="text-success"
                              >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <DeactivateUserDialog
        open={!!deactivateUser}
        onOpenChange={(open) => !open && setDeactivateUser(null)}
        user={deactivateUser}
        onSuccess={fetchTeamMembers}
      />

      <EditUserRoleDialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        user={editUser ? {
          id: editUser.id,
          user_id: editUser.id,
          name: editUser.name,
          email: editUser.email,
          role: editUser.role === 'owner' ? 'admin' : editUser.role,
          permissions: [],
          status: editUser.is_active ? 'active' : 'inactive',
        } : null}
        onSave={async (userId, role, permissions) => {
          await supabase
            .from('user_roles')
            .update({ role, permissions })
            .eq('user_id', userId);
          fetchTeamMembers();
        }}
      />
    </>
  );
};