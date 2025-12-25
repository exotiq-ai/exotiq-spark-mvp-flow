import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  Hash, 
  Megaphone, 
  Search,
  X,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: { id: string; name: string; email: string; avatar_url: string | null }[];
  onCreateConversation: (
    type: 'direct' | 'group' | 'channel',
    memberIds: string[],
    name?: string,
    description?: string,
    isCompanyWide?: boolean
  ) => Promise<void>;
  currentUserId?: string;
}

export const NewConversationDialog = ({
  open,
  onOpenChange,
  teamMembers,
  onCreateConversation,
  currentUserId
}: NewConversationDialogProps) => {
  const [type, setType] = useState<'direct' | 'group' | 'channel'>('direct');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCompanyWide, setIsCompanyWide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredMembers = teamMembers.filter(m => {
    if (m.id === currentUserId) return false;
    const search = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(search) || m.email.toLowerCase().includes(search);
  });

  const toggleMember = (memberId: string) => {
    if (type === 'direct') {
      setSelectedMembers([memberId]);
    } else {
      setSelectedMembers(prev => 
        prev.includes(memberId) 
          ? prev.filter(id => id !== memberId)
          : [...prev, memberId]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedMembers.length === 0 && !isCompanyWide) return;
    if ((type === 'group' || type === 'channel') && !name.trim()) return;

    setIsCreating(true);
    try {
      await onCreateConversation(
        type,
        selectedMembers,
        type === 'direct' ? undefined : name,
        type === 'channel' ? description : undefined,
        isCompanyWide
      );
      onOpenChange(false);
      // Reset form
      setType('direct');
      setSelectedMembers([]);
      setName('');
      setDescription('');
      setIsCompanyWide(false);
      setSearchQuery('');
    } finally {
      setIsCreating(false);
    }
  };

  const getMemberInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start a Conversation</DialogTitle>
          <DialogDescription>
            Send a direct message, create a group, or start a channel
          </DialogDescription>
        </DialogHeader>

        <Tabs value={type} onValueChange={(v) => {
          setType(v as typeof type);
          setSelectedMembers([]);
          setIsCompanyWide(false);
        }}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Group
            </TabsTrigger>
            <TabsTrigger value="channel" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Channel
            </TabsTrigger>
          </TabsList>

          {/* Direct Message */}
          <TabsContent value="direct" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                      selectedMembers.includes(member.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getMemberInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    {selectedMembers.includes(member.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No team members found
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Group Chat */}
          <TabsContent value="group" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., Fleet Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Add members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Selected Members */}
            <AnimatePresence>
              {selectedMembers.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  {selectedMembers.map(memberId => {
                    const member = teamMembers.find(m => m.id === memberId);
                    if (!member) return null;
                    return (
                      <Badge
                        key={memberId}
                        variant="secondary"
                        className="flex items-center gap-1 pl-1 pr-2"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getMemberInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{member.name}</span>
                        <button
                          onClick={() => toggleMember(memberId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
            
            <ScrollArea className="h-[150px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                      selectedMembers.includes(member.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getMemberInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    {selectedMembers.includes(member.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Channel */}
          <TabsContent value="channel" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="channelName">Channel Name</Label>
              <Input
                id="channelName"
                placeholder="e.g., #announcements"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channelDesc">Description (optional)</Label>
              <Textarea
                id="channelDesc"
                placeholder="What is this channel about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <Checkbox
                id="companyWide"
                checked={isCompanyWide}
                onCheckedChange={(checked) => setIsCompanyWide(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="companyWide" className="flex items-center gap-2 cursor-pointer">
                  <Megaphone className="h-4 w-4 text-warning" />
                  Company-wide channel
                </Label>
                <p className="text-xs text-muted-foreground">
                  Everyone in the organization can see and join
                </p>
              </div>
            </div>

            {!isCompanyWide && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Add members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-[120px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                          selectedMembers.includes(member.id)
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getMemberInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{member.name}</p>
                        </div>
                        {selectedMembers.includes(member.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              isCreating ||
              (type === 'direct' && selectedMembers.length === 0) ||
              (type === 'group' && (!name.trim() || selectedMembers.length === 0)) ||
              (type === 'channel' && !name.trim() && !isCompanyWide)
            }
          >
            {isCreating ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            ) : null}
            {type === 'direct' ? 'Start Chat' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
