import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

interface ModuleGridWidgetProps {
  modules: Module[];
  onModuleClick: (moduleId: string) => void;
}

export const ModuleGridWidget = ({ modules, onModuleClick }: ModuleGridWidgetProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 h-full">
      {modules.map((module) => (
        <Card 
          key={module.id} 
          className="p-4 md:p-6 border-2 border-border hover:border-primary/50 shadow-sm hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-1 touch-target"
          onClick={() => onModuleClick(module.id)}
          tabIndex={0}
          role="button"
          aria-label={`Open ${module.name} module - ${module.description}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onModuleClick(module.id);
            }
          }}
        >
          <div className={`p-3 md:p-4 rounded-xl border-2 ${
            module.color === 'text-primary' ? 'border-primary bg-primary/10' : 'border-secondary bg-secondary/10'
          } mb-4 w-fit`}>
            <module.icon className={`h-6 w-6 md:h-8 md:w-8 ${module.color}`} aria-hidden="true" />
          </div>
          <h3 className="text-lg md:text-xl font-semibold mb-2">{module.name}</h3>
          <p className="text-xs md:text-sm text-muted-foreground mb-4">{module.description}</p>
          <Button variant="outline" className="w-full touch-target min-h-[44px]">
            Open Module
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </Card>
      ))}
    </div>
  );
};