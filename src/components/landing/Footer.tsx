import { Logo } from "@/components/ui/logo";
import { Link } from "react-router-dom";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 py-16 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="col-span-2 md:col-span-1">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              AI-powered fleet management for exotic car rental operators.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                {/* FD-01: /features is not a registered route; link to the on-page anchor */}
                <a href="/#features" className="hover:text-foreground transition-colors">Features</a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              </li>
              <li>
                <Link to="/auth" className="hover:text-foreground transition-colors">Demo</Link>
              </li>
            </ul>
          </div>

          {/* Company — FD-08: no real URLs known; rendered as non-interactive text to avoid false affordance */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="cursor-default">About</span>
              </li>
              <li>
                <span className="cursor-default">Blog</span>
              </li>
              <li>
                <span className="cursor-default">Careers</span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">Legal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              </li>
              <li>
                <Link to="/acceptable-use" className="hover:text-foreground transition-colors">Acceptable Use</Link>
              </li>
              <li>
                <Link to="/data-processing" className="hover:text-foreground transition-colors">Data Processing</Link>
              </li>
              <li>
                <Link to="/sms" className="hover:text-foreground transition-colors">SMS Policy</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom — FD-08: social icon links removed; real Exotiq social URLs are not yet established */}
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Exotiq.ai. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
