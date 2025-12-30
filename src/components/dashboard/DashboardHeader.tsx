import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
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
import { useTeamMessaging } from "@/hooks/useTeamMessaging";
import { FeedbackSubmissionDialog } from "@/components/feedback/FeedbackSubmissionDialog";

interface DashboardHeaderProps {
  onOpenChat?: () => void;
}

export const DashboardHeader = ({ onOpenChat }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { profile, displayName } = useProfile();
  const { conversations } = useTeamMessaging();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Calculate total unread messages
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const getInitials = () => {
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        <Logo />
        
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <EnhancedGlobalSearch />
        </div>

        <div className="flex items-center space-x-2">
          <UnifiedNotificationCenter />
          
          {/* Team Chat Button */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onOpenChat}
            title="Team Chat"
          >
            <MessageSquare className="h-5 w-5" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </Button>
          
          {/* Feedback Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFeedbackOpen(true)}
            className="hidden sm:flex"
            title="Send Feedback"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
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
              <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Feedback Dialog */}
      <FeedbackSubmissionDialog 
        open={feedbackOpen} 
        onOpenChange={setFeedbackOpen}
      />
    </header>
  );
};
