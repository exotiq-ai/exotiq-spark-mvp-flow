import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SEOHead } from "@/components/common/SEOHead";

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  effectiveDate: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export const LegalPageLayout = ({
  title,
  subtitle,
  effectiveDate,
  lastUpdated,
  children,
}: LegalPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${title} — Exotiq`}
        description={`${title} for the Exotiq Command Center platform.`}
        url={`/${title.toLowerCase().replace(/\s+/g, "-")}`}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-4xl flex items-center justify-between px-4 sm:px-6 h-16">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-10">
          <h1 className="font-brand text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg text-muted-foreground mb-4">{subtitle}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Effective Date: {effectiveDate}</span>
            <span>•</span>
            <span>Last Updated: {lastUpdated}</span>
          </div>
        </div>

        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-brand prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-muted-foreground prose-li:text-muted-foreground prose-td:text-muted-foreground prose-th:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-table:text-sm">
          {children}
        </article>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-border/50">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/acceptable-use" className="hover:text-foreground transition-colors">Acceptable Use</Link>
            <Link to="/data-processing" className="hover:text-foreground transition-colors">Data Processing</Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Exotiq Inc. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};
