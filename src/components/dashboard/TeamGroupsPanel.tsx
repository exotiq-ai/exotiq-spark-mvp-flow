import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeamGroups, type TeamGroup } from "@/hooks/useTeamGroups";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Users, Plus, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const TeamGroupsPanel = () => {
  const { groups, loading, createGroup, deleteGroup, setGroupMembers } = useTeamGroups();
  const { isAdmin } = useUserRole();
  const { currentTeam } = useTeam();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editing, setEditing] = useState<TeamGroup | null>(null);
  const [teamMemberDirectory, setTeamMemberDirectory] = useState<
    { id: string; name: string; avatar_url: string | null }[]
  >([]);

  useMemo(() => {
    if (!currentTeam?.id) return;
    supabase
      .from("team_members")
      .select("user_id, profiles(id, full_name, email, avatar_url)")
      .eq("team_id", currentTeam.id)
      .eq("is_active", true)
      .then(({ data }) => {
        setTeamMemberDirectory(
          (data || [])
            .filter((tm) => tm.profiles)
            .map((tm) => {
              const p = tm.profiles as unknown as {
                id: string;
                full_name: string | null;
                email: string;
                avatar_url: string | null;
              };
              return { id: p.id, name: p.full_name || p.email, avatar_url: p.avatar_url };
            }),
        );
      });
  }, [currentTeam?.id]);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

  const handleCreate = async () => {
    const slug = slugify(newSlug || newName);
    if (!newName || !slug) {
      toast({ title: "Name and slug required", variant: "destructive" });
      return;
    }
    const created = await createGroup(newName, slug, newDesc);
    if (created) {
      toast({ title: "Group created", description: `@${slug} is ready to mention.` });
      setShowCreate(false);
      setNewName("");
      setNewSlug("");
      setNewDesc("");
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-2">Team Groups</h3>
        <p className="text-sm text-muted-foreground">
          Only owners, admins, or managers can create or edit groups. Anyone can @mention them.
        </p>
        <GroupListReadOnly groups={groups} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Groups
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create groups like <code className="text-xs">@sales</code> or{" "}
              <code className="text-xs">@detailing</code> to mention multiple teammates at once.
            </p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a team group</DialogTitle>
                <DialogDescription>
                  Group members get notified whenever someone @mentions this group in chat.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      if (!newSlug) setNewSlug(slugify(e.target.value));
                    }}
                    placeholder="Sales Team"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mention handle</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                      @
                    </span>
                    <Input
                      value={newSlug}
                      onChange={(e) => setNewSlug(slugify(e.target.value))}
                      placeholder="sales"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="What is this group for?"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create group</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading groups…</p>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No groups yet. Create one to start mentioning teams.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">@{g.slug}</Badge>
                    <span className="font-medium truncate">{g.name}</span>
                  </div>
                  {g.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {g.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.member_ids.length} {g.member_ids.length === 1 ? "member" : "members"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(g)}>
                  Members
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete @{g.slug}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Existing mentions of this group in old messages will become inactive.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteGroup(g.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit members dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Members of @{editing?.slug}</DialogTitle>
            <DialogDescription>Add or remove teammates from this group.</DialogDescription>
          </DialogHeader>
          {editing && (
            <MemberPicker
              directory={teamMemberDirectory}
              selectedIds={editing.member_ids}
              onSave={async (ids) => {
                await setGroupMembers(editing.id, ids);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const GroupListReadOnly = ({ groups }: { groups: TeamGroup[] }) => (
  <div className="mt-4 flex flex-wrap gap-2">
    {groups.map((g) => (
      <Badge key={g.id} variant="secondary" className="font-mono">
        @{g.slug}
      </Badge>
    ))}
    {groups.length === 0 && (
      <p className="text-xs text-muted-foreground">No groups yet.</p>
    )}
  </div>
);

const MemberPicker = ({
  directory,
  selectedIds,
  onSave,
  onCancel,
}: {
  directory: { id: string; name: string; avatar_url: string | null }[];
  selectedIds: string[];
  onSave: (ids: string[]) => Promise<void> | void;
  onCancel: () => void;
}) => {
  const [picked, setPicked] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <ScrollArea className="h-[300px] -mx-2 px-2">
        <div className="space-y-1">
          {directory.map((m) => {
            const isPicked = picked.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted text-left"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{m.name}</span>
                {isPicked && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
          {directory.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No teammates available.
            </p>
          )}
        </div>
      </ScrollArea>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave([...picked])}>
          Save ({picked.size})
        </Button>
      </DialogFooter>
    </>
  );
};
