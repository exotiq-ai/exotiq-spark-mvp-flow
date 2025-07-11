import { Car } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-muted/50 py-8 sm:py-12 px-4 sm:px-6">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Car className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <span className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ExotIQ.ai
            </span>
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground text-center">
            © 2024 ExotIQ.ai. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};