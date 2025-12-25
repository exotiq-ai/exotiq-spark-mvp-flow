import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadReceiptsProps {
  readers: { user_id: string; read_at: string }[];
  teamMembers: { id: string; name: string; avatar_url: string | null }[];
  isOwn: boolean;
  isSent?: boolean;
}

export const ReadReceipts = ({ readers, teamMembers, isOwn, isSent = true }: ReadReceiptsProps) => {
  if (!isOwn) return null;

  const memberMap = new Map(teamMembers.map(m => [m.id, m]));
  const readerProfiles = readers
    .map(r => memberMap.get(r.user_id))
    .filter(Boolean);

  if (readerProfiles.length === 0) {
    // Show single checkmark for sent
    return (
      <div className="flex items-center justify-end mt-0.5">
        <Check className={cn("h-3 w-3", isSent ? "text-muted-foreground" : "text-muted-foreground/50")} />
      </div>
    );
  }

  // Show double checkmark for read
  if (readerProfiles.length <= 3) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-end mt-0.5 gap-1">
              <CheckCheck className="h-3 w-3 text-primary" />
              {readerProfiles.length > 1 && (
                <div className="flex -space-x-1">
                  {readerProfiles.slice(0, 3).map((profile, i) => (
                    <Avatar key={profile!.id} className="h-3 w-3 border border-background">
                      <AvatarImage src={profile!.avatar_url || undefined} />
                      <AvatarFallback className="text-[6px]">
                        {profile!.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            <p>Read by: {readerProfiles.map(p => p!.name).join(', ')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-end mt-0.5 gap-1">
            <CheckCheck className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">
              {readerProfiles.length}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          <p>Read by {readerProfiles.length} people</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
