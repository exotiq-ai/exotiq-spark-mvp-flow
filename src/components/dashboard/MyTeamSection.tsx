import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Search, 
  Mail, 
  Shield,
  Crown,
  UserCheck,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useTeam } from "@/contexts/TeamContext";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  isCurrentUser: boolean;
}

const roleIcons: Record<AppRole, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5" />,
  admin: <Crown className="h-3.5 w-3.5" />,
  manager: <Shield className="h-3.5 w-3.5" />,
  operator: <UserCheck className="h-3.5 w-3.5" />,
  viewer: <Eye className="h-3.5 w-3.5" />,
};

const roleColors: Record<AppRole, string> = {
  owner: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  manager: "bg-primary/10 text-primary border-primary/20",
  operator: "bg-accent/10 text-accent border-accent/20",
  viewer: "bg-muted text-muted-foreground border-muted",
};

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Manager",
  operator: "Operator",
  viewer: "Viewer",
};

export const MyTeamSection = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { currentTeam } = useTeam();
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        // Fetch profiles - admins can see all, others see based on company
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name');

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          return;
        }

        // Fetch user roles
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        }

        // Merge profiles with roles
        const members: TeamMember[] = (profiles || []).map(profile => {
          const userRole = roles?.find(r => r.user_id === profile.id);
          return {
            id: profile.id,
            name: profile.full_name || 'Unknown User',
            email: profile.email,
            role: (userRole?.role as AppRole) || 'viewer',
            isCurrentUser: profile.id === user.id,
          };
        });

        // Sort: current user first, then by role hierarchy
        const roleOrder: Record<AppRole, number> = { owner: 0, admin: 1, manager: 2, operator: 3, viewer: 4 };
        members.sort((a, b) => {
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return roleOrder[a.role] - roleOrder[b.role];
        });

        setTeamMembers(members);
      } catch (error) {
        console.error('Error fetching team members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamMembers();
  }, [user?.id, isAdmin]);

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Role stats
  const roleStats = {
    total: teamMembers.length,
    admins: teamMembers.filter(m => m.role === 'admin').length,
    managers: teamMembers.filter(m => m.role === 'manager').length,
    operators: teamMembers.filter(m => m.role === 'operator').length,
    viewers: teamMembers.filter(m => m.role === 'viewer').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">My Team</h2>
          <p className="text-muted-foreground">View team members and their roles</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-8 mb-1" />
              ) : (
                <div className="text-2xl font-bold">{roleStats.total}</div>
              )}
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        
        {(['admin', 'manager', 'operator', 'viewer'] as AppRole[]).map(role => (
          <Card key={role} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                {isLoading ? (
                  <Skeleton className="h-7 w-8 mb-1" />
                ) : (
                  <div className="text-2xl font-bold">
                    {role === 'admin' ? roleStats.admins : 
                     role === 'manager' ? roleStats.managers :
                     role === 'operator' ? roleStats.operators : roleStats.viewers}
                  </div>
                )}
                <div className="text-xs text-muted-foreground capitalize">{role}s</div>
              </div>
              <div className={`p-1.5 rounded ${roleColors[role]}`}>
                {roleIcons[role]}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          maxLength={100}
        />
      </div>

      {/* Team Members List */}
      <Card className="p-4 sm:p-6">
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No team members match your search' : 'No team members found'}
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div 
                key={member.id} 
                className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                  member.isCurrentUser 
                    ? 'bg-primary/5 border border-primary/20' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  member.isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <span className="text-sm font-medium">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{member.name}</span>
                    {member.isCurrentUser && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{member.email}</span>
                  </div>
                </div>

                {/* Role Badge */}
                <Badge className={`${roleColors[member.role]} flex items-center gap-1`}>
                  {roleIcons[member.role]}
                  <span className="hidden sm:inline">{roleLabels[member.role]}</span>
                  <span className="sm:hidden capitalize">{member.role}</span>
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Info for non-admins */}
      {!isAdmin && !roleLoading && (
        <p className="text-sm text-muted-foreground text-center">
          Contact your administrator to change team member roles or invite new users.
        </p>
      )}
    </div>
  );
};
