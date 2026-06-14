// Cookie consent v2
// First-visit (and after version bump) banner offering Accept all / Reject
// all / Customize. Choices persisted to localStorage AND, when a user is
// signed in, appended to terms_acceptances (document_type='cookie_consent_v2')
// for the legally required immutable ledger entry.
//
// Today the app loads zero third-party trackers. This component is the
// gate that keeps that promise testable: any future SDK must check
// `useCookieConsent().categories.analytics` (or .marketing) before loading.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Cookie } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_DOCS } from "@/lib/legal/versions";

export type CookieCategories = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

const LS_KEY = "exotiq.cookie_consent.v2";

interface StoredConsent {
  version: string;
  decided_at: string;
  categories: CookieCategories;
}

function readStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== LEGAL_DOCS.cookies.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(categories: CookieCategories) {
  const payload: StoredConsent = {
    version: LEGAL_DOCS.cookies.version,
    decided_at: new Date().toISOString(),
    categories,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
  void recordLedger(payload);
}

async function recordLedger(payload: StoredConsent) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase.from("terms_acceptances") as any).insert({
      user_id: u.user.id,
      document_type: "cookie_consent_v2",
      version: payload.version,
      accepted_at: payload.decided_at,
      ip_address: null,
      user_agent: navigator.userAgent,
      consent_statement: `Cookie preferences set: ${JSON.stringify(payload.categories)}`,
    });
  } catch {
    // Non-blocking; localStorage is the source of truth at runtime.
  }
}

export function getCookieConsent(): CookieCategories | null {
  return readStored()?.categories ?? null;
}

export const CookieConsentBanner = () => {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [cats, setCats] = useState<CookieCategories>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (!readStored()) setOpen(true);
  }, []);

  const accept = (c: CookieCategories) => {
    persist(c);
    setOpen(false);
    setCustomize(false);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg p-4">
          <div className="flex items-start gap-3">
            <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Cookie preferences</p>
              <p className="text-xs text-muted-foreground mt-1">
                We use strictly necessary cookies to run the app. Functional,
                analytics, and marketing cookies are off until you turn them on.
                See our{" "}
                <a href="/cookies" className="underline">
                  Cookie Policy
                </a>
                .
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCustomize(true)}
                >
                  Customize
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    accept({
                      necessary: true,
                      functional: false,
                      analytics: false,
                      marketing: false,
                    })
                  }
                >
                  Reject all
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    accept({
                      necessary: true,
                      functional: true,
                      analytics: true,
                      marketing: true,
                    })
                  }
                >
                  Accept all
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={customize} onOpenChange={setCustomize}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Choose the categories you allow. Strictly necessary cookies
              cannot be disabled because they keep you signed in.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3 py-2">
            <Row
              title="Strictly necessary"
              desc="Authentication, session, CSRF, load balancing, your consent choices."
              checked
              locked
            />
            <Row
              title="Functional"
              desc="Remembers UI preferences such as dashboard layout and locale."
              checked={cats.functional}
              onToggle={(v) => setCats({ ...cats, functional: v })}
            />
            <Row
              title="Analytics"
              desc="Internal analytics only. We do not load third-party trackers today."
              checked={cats.analytics}
              onToggle={(v) => setCats({ ...cats, analytics: v })}
            />
            <Row
              title="Marketing"
              desc="Used for attribution if/when we run paid campaigns. Off today."
              checked={cats.marketing}
              onToggle={(v) => setCats({ ...cats, marketing: v })}
            />
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={() => accept({ necessary: true, functional: false, analytics: false, marketing: false })}>
              Reject all
            </Button>
            <Button onClick={() => accept(cats)}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Row = ({
  title,
  desc,
  checked,
  onToggle,
  locked,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onToggle?: (v: boolean) => void;
  locked?: boolean;
}) => (
  <li className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
    <Switch
      checked={checked}
      disabled={locked}
      onCheckedChange={(v) => onToggle?.(v)}
      aria-label={`Toggle ${title}`}
    />
  </li>
);
