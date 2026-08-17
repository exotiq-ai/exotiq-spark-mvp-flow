delete from public.user_invitations where email = 'probe@example.com';

insert into public.user_invitations (email, invited_by, role, permissions, token, status, team_id, expires_at)
values (
  'exoticsbythebay@exotiq.ai',
  '05668c86-0a4c-4217-858b-818ca12b94dc',
  'admin',
  ARRAY['full_access','billing','user_management','fleet_management','bookings','reports','customers']::text[],
  'a72d18a1-8626-4766-b3b4-eec6521735c4-f06e60b6-1117-40bb-ac2a-4fff5bcecf1e',
  'pending',
  '780f425c-3733-40c7-855f-ff3c5addbb60',
  now() + interval '7 days'
);