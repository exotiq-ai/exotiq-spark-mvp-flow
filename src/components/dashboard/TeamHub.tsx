import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Settings, Activity, History } from "lucide-react";
import { TeamDirectorySection } from "./TeamDirectorySection";
import { TeamInvitationsSection } from "./TeamInvitationsSection";
import { TeamSettingsSection } from "./TeamSettingsSection";
import { TeamActivityDashboard } from "./TeamActivityDashboard";
import { RoleAuditLogSection } from "./RoleAuditLogSection";
import { useUserRole } from "@/hooks/useUserRole";
import { InviteUserDialog } from "@/components/dialogs/InviteUserDialog";

export const TeamHub = () => {
  const { isAdmin } = useUserRole();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Hub</h2>
          <p className="text-muted-foreground">Manage your team members, activity, and settings</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="directory" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Directory</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Invitations</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="activity">
          <TeamActivityDashboard />
        </TabsContent>

        <TabsContent value="directory">
          <TeamDirectorySection />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invitations">
            <TeamInvitationsSection />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="audit">
            <RoleAuditLogSection />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="settings">
            <TeamSettingsSection />
          </TabsContent>
        )}
      </Tabs>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={() => setShowInviteDialog(false)}
      />
    </div>
  );
};

export default TeamHub;
