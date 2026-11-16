import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const rpc = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      rpc: (...args: unknown[]) => rpc(...args),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
      channel: () => channel,
      removeChannel: () => undefined,
    },
  };
});

const authUser = { id: 'u1', email: 'op@example.com' };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }));

import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const RoleReader = ({ n }: { n: number }) => {
  const { role, loading } = useUserRole();
  return <span data-testid={`role-${n}`}>{loading ? 'loading' : role ?? 'none'}</span>;
};

const ProfileReader = ({ n }: { n: number }) => {
  const { displayName, loading } = useProfile();
  return <span data-testid={`profile-${n}`}>{loading ? 'loading' : displayName}</span>;
};

describe('user lookups shared across the app', () => {
  beforeEach(() => {
    rpc.mockReset();
    maybeSingle.mockReset();
  });

  it('asks for the role once, however many components read it', async () => {
    rpc.mockResolvedValue({ data: [{ role: 'admin', permissions: [] }], error: null });
    wrap(<>{[1, 2, 3, 4, 5].map((n) => <RoleReader key={n} n={n} />)}</>);
    await waitFor(() => expect(screen.getByTestId('role-5').textContent).toBe('admin'));
    expect(screen.getByTestId('role-1').textContent).toBe('admin');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('treats a user with no role row as unrestricted, not viewer', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    wrap(<RoleReader n={1} />);
    await waitFor(() => expect(screen.getByTestId('role-1').textContent).toBe('none'));
  });

  it('reads the profile once, however many components read it', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'u1', email: 'op@example.com', full_name: 'Op Erator' }, error: null });
    wrap(<>{[1, 2, 3].map((n) => <ProfileReader key={n} n={n} />)}</>);
    await waitFor(() => expect(screen.getByTestId('profile-3').textContent).toBe('Op Erator'));
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('falls back to the email name when there is no profile row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    wrap(<ProfileReader n={1} />);
    await waitFor(() => expect(screen.getByTestId('profile-1').textContent).toBe('op'));
  });
});
