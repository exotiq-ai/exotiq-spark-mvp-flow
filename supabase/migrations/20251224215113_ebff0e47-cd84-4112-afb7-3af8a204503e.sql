-- Create role audit log table
CREATE TABLE public.role_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    changed_by UUID,
    action TEXT NOT NULL,
    old_role TEXT,
    new_role TEXT,
    old_permissions TEXT[],
    new_permissions TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view all, users can view their own
CREATE POLICY "Admins can view all audit logs"
ON public.role_audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- Only system/admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
ON public.role_audit_log FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR changed_by = auth.uid());

-- Create user invitations table
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_by UUID NOT NULL,
    role TEXT DEFAULT 'viewer',
    permissions TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can view invitations"
ON public.user_invitations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invitations"
ON public.user_invitations FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invitations"
ON public.user_invitations FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations"
ON public.user_invitations FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));