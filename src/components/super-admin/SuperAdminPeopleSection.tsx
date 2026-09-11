import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, UserPlus } from 'lucide-react';

const ROLES = ['owner', 'admin', 'manager', 'operator', 'viewer'] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  operator: 'Operator',
  viewer: 'Viewer',
};

interface Member {
  user_id: string;
  role: Role;
  is_active: boolean;
  full_name: string | null;
  email: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string | null;
  expires_at: string | null;
}

interface Props {
  teamId: string;
  teamName: string;
}

export const SuperAdminPeopleSection = ({ teamId, teamName }: Props) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ member: Member; role: Role } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('owner');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-set-team-role', {
        body: { action: 'list', team_id: teamId },
      });
      if (error) throw error;
      setMembers((data?.members ?? []) as Member[]);
      setInvitations((data?.invitations ?? []) as Invitation[]);
    } catch (e) {
      console.error('[SuperAdminPeople] load failed', e);
      toast({ title: 'Could not load people', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [teamId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const applyRole = async (member: Member, role: Role) => {
    setSavingId(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-set-team-role', {
        body: { action: 'set_role', team_id: teamId, user_id: member.user_id, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMembers(prev =>
        prev.map(m => (m.user_id === member.user_id ? { ...m, role } : m)),
      );
      toast({
        title: 'Role updated',
        description: `${member.full_name || member.email || 'This person'} is now ${ROLE_LABEL[role]} of ${teamName}.`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: 'Could not change the role', description: message, variant: 'destructive' });
      load();
    } finally {
      setSavingId(null);
      setPending(null);
    }
  };

  const handleSelect = (member: Member, role: Role) => {
    if (role === member.role) return;
    if (role === 'owner' || member.role === 'owner') {
      setPending({ member, role });
      return;
    }
    applyRole(member, role);
  };

  const sendInvite = async () => {
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-set-team-role', {
        body: {
          action: 'invite',
          team_id: teamId,
          email: inviteEmail,
          role: inviteRole,
          app_origin: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Invitation sent', description: `${inviteEmail} was invited to ${teamName}.` });
      setInviteOpen(false);
      setInviteEmail('');
      load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: 'Could not send the invitation', description: message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            People &amp; roles
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInviteOpen(v => !v)}>
            <UserPlus className="h-3.5 w-3.5" /> Invite
          </Button>
        </div>

        {inviteOpen && (
          <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-muted/40">
            <Input
              type="email"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={v => setInviteRole(v as Role)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No members in this workspace yet.</p>
        ) : (
          <div className="space-y-1">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center gap-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.full_name || member.email || 'Unnamed user'}
                    {!member.is_active && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </p>
                  {member.email && (
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  )}
                </div>
                <Select
                  value={member.role}
                  disabled={savingId === member.user_id}
                  onValueChange={v => handleSelect(member, v as Role)}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {invitations.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <p className="text-xs text-muted-foreground">Pending invitations</p>
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{inv.email}</span>
                <Badge variant="outline" className="text-[10px]">
                  {inv.role ? ROLE_LABEL[inv.role as Role] ?? inv.role : 'Viewer'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground pt-1">
          Every change here is recorded with your name and takes effect immediately.
        </p>
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={o => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.role === 'owner' ? 'Make this person an owner?' : 'Remove owner access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.role === 'owner'
                ? `${pending?.member.full_name || pending?.member.email} will get full control of ${teamName}, including billing and account deletion. Existing owners keep their access.`
                : `${pending?.member.full_name || pending?.member.email} will lose owner access to ${teamName} and become ${pending ? ROLE_LABEL[pending.role] : ''}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && applyRole(pending.member, pending.role)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default SuperAdminPeopleSection;
