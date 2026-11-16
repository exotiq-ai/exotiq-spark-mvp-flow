import { describe, it, expect } from 'vitest';
import { resolveSidebarCollapsed } from '@/lib/sidebarCollapse';

describe('resolveSidebarCollapsed', () => {
  it('starts collapsed on a tablet when the user has not chosen', () => {
    expect(resolveSidebarCollapsed(null, true)).toBe(true);
  });

  it('starts open on a desktop when the user has not chosen', () => {
    expect(resolveSidebarCollapsed(null, false)).toBe(false);
  });

  it("keeps the user's own choice on any screen", () => {
    expect(resolveSidebarCollapsed(false, true)).toBe(false);
    expect(resolveSidebarCollapsed(true, false)).toBe(true);
  });

  it('treats an unreadable stored value as no choice', () => {
    expect(resolveSidebarCollapsed(undefined, true)).toBe(true);
    expect(resolveSidebarCollapsed('yes' as unknown as boolean, false)).toBe(false);
  });
});
