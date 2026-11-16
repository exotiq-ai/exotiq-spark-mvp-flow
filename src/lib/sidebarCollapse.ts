/**
 * Whether the dashboard sidebar is collapsed to icons.
 *
 * The user's own choice (saved when they press Collapse/Expand) always wins.
 * Without one, tablets (768–1023 px) start collapsed: the full 240 px sidebar
 * left too little room, so the header overlapped and names wrapped badly.
 */
export function resolveSidebarCollapsed(saved: boolean | null | undefined, isTablet: boolean): boolean {
  return typeof saved === 'boolean' ? saved : isTablet;
}
