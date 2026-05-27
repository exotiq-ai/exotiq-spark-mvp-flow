## Fix co-branding hierarchy

You're right — I flipped the sidebar. Correct intent:

- **Sidebar (left)**: Exotiq is the hero lockup on top, customer logo sits smaller below as the co-brand. Always co-branded when a customer logo exists.
- **Header (top)**: Small Exotiq **D emblem** + customer logo (Exotiq wordmark removed here, since the sidebar already carries the full Exotiq brand).

### Changes

**`src/components/dashboard/DashboardSidebarEnhanced.tsx`** — expanded state, when `currentTeam?.logo_url` exists:
- Top: full `<Logo size="lg" />` (Exotiq lockup) — hero
- Below: customer logo, smaller (`h-7 max-w-[140px] object-contain opacity-90`)
- Without customer logo: unchanged (full Exotiq lockup only)
- Collapsed state: unchanged (Exotiq D emblem only, since space is tight)

**`src/components/dashboard/DashboardHeader.tsx`** — already correct from last pass (D emblem + customer logo). No change needed.

### Out of scope
Settings, upload UI, legacy `DashboardSidebar.tsx`, login/legal/marketing pages.
