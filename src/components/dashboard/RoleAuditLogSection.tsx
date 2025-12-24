import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { History, Search, UserPlus, UserMinus, Shield, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLogEntry {
  id: string;
  user_id: string;
  changed_by: string | null;
  action: string;
  old_role: string | null;
  new_role: string | null;
  old_permissions: string[] | null;
  new_permissions: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
  changed_by_name?: string;
  affected_user_name?: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  role_change: {
    label: "Role Changed",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  permissions_updated: {
    label: "Permissions Updated",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  user_invited: {
    label: "User Invited",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: <UserPlus className="h-3.5 w-3.5" />,
  },
  user_deleted: {
    label: "User Removed",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: <UserMinus className="h-3.5 w-3.5" />,
  },
};

export function RoleAuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from("role_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profile names for changed_by users
      const changedByIds = [...new Set((logsData || []).map(log => log.changed_by).filter(Boolean))];
      const userIds = [...new Set((logsData || []).map(log => log.user_id).filter(Boolean))];
      const allIds = [...new Set([...changedByIds, ...userIds])];

      let profilesMap: Record<string, string> = {};
      
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", allIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const enrichedLogs: AuditLogEntry[] = (logsData || []).map(log => {
        const metadata = (typeof log.metadata === 'object' && log.metadata !== null) 
          ? log.metadata as Record<string, any>
          : {};
        
        return {
          id: log.id,
          user_id: log.user_id,
          changed_by: log.changed_by,
          action: log.action,
          old_role: log.old_role,
          new_role: log.new_role,
          old_permissions: log.old_permissions,
          new_permissions: log.new_permissions,
          metadata,
          created_at: log.created_at,
          changed_by_name: log.changed_by ? profilesMap[log.changed_by] || "Unknown" : "System",
          affected_user_name: log.user_id ? profilesMap[log.user_id] || 
            (metadata.deleted_user_name || metadata.invited_email || "Unknown") : "Unknown",
        };
      });

      setLogs(enrichedLogs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.affected_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.changed_by_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.metadata?.invited_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.metadata?.deleted_user_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const formatPermissionChange = (oldPerms: string[] | null, newPerms: string[] | null) => {
    const added = newPerms?.filter(p => !oldPerms?.includes(p)) || [];
    const removed = oldPerms?.filter(p => !newPerms?.includes(p)) || [];
    
    return { added, removed };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="role_change">Role Changes</SelectItem>
              <SelectItem value="permissions_updated">Permission Updates</SelectItem>
              <SelectItem value="user_invited">User Invitations</SelectItem>
              <SelectItem value="user_deleted">User Removals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log Entries */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No audit log entries found</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const actionConfig = ACTION_CONFIG[log.action] || {
                  label: log.action,
                  color: "bg-muted text-muted-foreground",
                  icon: <Shield className="h-3.5 w-3.5" />,
                };

                const permChanges = formatPermissionChange(log.old_permissions, log.new_permissions);

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Action Icon */}
                    <div className={`p-2 rounded-full ${actionConfig.color}`}>
                      {actionConfig.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={actionConfig.color}>
                          {actionConfig.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>

                      <div className="mt-1">
                        {log.action === "role_change" && (
                          <p className="text-sm">
                            <span className="font-medium">{log.affected_user_name}</span>'s role changed
                            {log.old_role && log.new_role && (
                              <>
                                {" "}from <Badge variant="outline" className="text-xs">{log.old_role}</Badge>
                                {" "}to <Badge variant="outline" className="text-xs">{log.new_role}</Badge>
                              </>
                            )}
                          </p>
                        )}

                        {log.action === "permissions_updated" && (
                          <div className="text-sm">
                            <p>
                              <span className="font-medium">{log.affected_user_name}</span>'s permissions updated
                            </p>
                            {permChanges.added.length > 0 && (
                              <p className="text-xs text-green-600 mt-1">
                                + Added: {permChanges.added.join(", ")}
                              </p>
                            )}
                            {permChanges.removed.length > 0 && (
                              <p className="text-xs text-red-600">
                                - Removed: {permChanges.removed.join(", ")}
                              </p>
                            )}
                          </div>
                        )}

                        {log.action === "user_invited" && (
                          <p className="text-sm">
                            Invited <span className="font-medium">{log.metadata?.invited_email}</span>
                            {log.new_role && (
                              <> as <Badge variant="outline" className="text-xs">{log.new_role}</Badge></>
                            )}
                          </p>
                        )}

                        {log.action === "user_deleted" && (
                          <div className="text-sm">
                            <p>
                              Removed <span className="font-medium">{log.metadata?.deleted_user_name || log.metadata?.deleted_user_email}</span>
                            </p>
                            {log.metadata?.reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Reason: {log.metadata.reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        by {log.changed_by_name}
                      </p>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
