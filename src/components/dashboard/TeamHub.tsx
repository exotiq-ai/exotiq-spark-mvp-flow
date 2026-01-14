import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Users, UserPlus, Settings } from "lucide-react";
import { TeamDirectorySection } from "./TeamDirectorySection";
import { TeamInvitationsSection } from "./TeamInvitationsSection";
import { TeamSettingsSection } from "./TeamSettingsSection";
import { useUserRole } from "@/hooks/useUserRole";

export const TeamHub = () => {
  const { isAdmin } = useUserRole();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage your team members, invitations, and settings</p>
        </div>
      </div>

      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
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
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <TeamDirectorySection />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invitations">
            <TeamInvitationsSection />
          </TabsContent>
        )}

        <TabsContent value="settings">
          <TeamSettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};