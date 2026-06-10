import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExotiqLogo, ExotiqLogoBranded } from "@/components/common/ExotiqLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { LogOut, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EnhancedGlobalSearch } from "@/components/common/EnhancedGlobalSearch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UnifiedNotificationCenter } from "@/components/common/UnifiedNotificationCenter";
import { LocationSwitcher } from "@/components/common/LocationSwitcher";
import { AddLocationDialog } from "@/components/dialogs/AddLocationDialog";
import { useTeamMessaging } from "@/hooks/useTeamMessaging";
import { useTeam } from "@/contexts/TeamContext";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DashboardHeaderProps {
  onOpenChat?: () => void;
  onOpenRari?: (query?: string) => void;
}

export const DashboardHeader = ({ onOpenChat, onOpenRari }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { profile, displayName } = useProfile();
  const { conversations } = useTeamMessaging();
  const { currentTeam, refreshTeam } = useTeam();
  const [addLocationOpen, setAddLocationOpen] = useState(false);

  // Calculate total unread messages
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const getInitials = () => {
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLocationAdded = async () => {
    setAddLocationOpen(false);
    await refreshTeam();
  };

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4">
        <div className="flex flex-row items-center gap-2 sm:gap-3 min-w-0">
          {currentTeam?.logo_url ? (
            <>
              <ExotiqLogo variant="auto" size="sm" />
              <img
                src={currentTeam.logo_url}
                alt={currentTeam.name || "Company logo"}
                className="h-7 sm:h-8 w-auto object-contain max-w-[120px] sm:max-w-[160px]"
              />
            </>
          ) : (
            <>
              <ExotiqLogoBranded variant="gulf-blue" size="sm" className="sm:hidden" />
              <ExotiqLogoBranded variant="gulf-blue" size="md" className="hidden sm:flex" />
            </>
          )}
          <LocationSwitcher onAddLocation={() => setAddLocationOpen(true)} />
        </div>
        
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <EnhancedGlobalSearch onOpenRari={onOpenRari} />
        </div>

        <div className="flex items-center space-x-2">
          <UnifiedNotificationCenter />
          
          {/* Team Chat Button */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onOpenChat}
            aria-label={totalUnread > 0 ? `Team messages, ${totalUnread} unread` : 'Team messages'}
          >
            <MessageSquare className="h-5 w-5" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </Button>
          
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void signOut();
                }}
                className="text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    <AddLocationDialog
      open={addLocationOpen}
      onOpenChange={setAddLocationOpen}
      onSuccess={handleLocationAdded}
    />
    </>
  );
};
