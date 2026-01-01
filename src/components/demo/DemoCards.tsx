
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  Building, 
  ArrowRight,
  Sparkles,
  BarChart3,
  DollarSign
} from "lucide-react";

const demoPersonas = [
  {
    id: 'fleet-owner',
    title: 'Fleet Owner Demo',
    description: 'Experience Exotiq.ai from the perspective of a luxury fleet owner managing 12 premium vehicles in Miami.',
    icon: DollarSign,
    color: 'text-success',
    bgColor: 'bg-success/10',
    highlights: ['Revenue optimization', 'Fleet profitability', 'AI pricing recommendations']
  },
  {
    id: 'operations-manager',
    title: 'Operations Manager Demo',
    description: 'See how operations managers use Exotiq.ai to oversee 25+ vehicles and streamline daily operations in LA.',
    icon: BarChart3,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    highlights: ['Live analytics', 'Booking management', 'Compliance tracking']
  },
  {
    id: 'business-owner',
    title: 'Business Owner Demo',
    description: 'Discover how business owners leverage Exotiq.ai to scale their luxury rental operations efficiently.',
    icon: TrendingUp,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    highlights: ['Business insights', 'Growth analytics', 'Automated workflows']
  }
];

interface DemoCardsProps {
  onSelectDemo: (persona: string) => void;
}

export const DemoCards: React.FC<DemoCardsProps> = ({ onSelectDemo }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {demoPersonas.map((persona) => (
        <Card key={persona.id} className="card-premium p-6 hover-scale cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${persona.bgColor}`}>
              <persona.icon className={`h-6 w-6 ${persona.color}`} />
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Live Demo
            </Badge>
          </div>
          
          <h3 className="text-xl font-semibold mb-2">{persona.title}</h3>
          <p className="text-muted-foreground mb-4 text-sm">{persona.description}</p>
          
          <div className="space-y-2 mb-6">
            {persona.highlights.map((highlight, index) => (
              <div key={index} className="flex items-center text-sm">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                {highlight}
              </div>
            ))}
          </div>
          
          <Button
            onClick={() => onSelectDemo(persona.id)}
            className="w-full btn-premium group-hover:bg-primary group-hover:text-primary-foreground"
            variant="outline"
          >
            Try This Demo
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      ))}
    </div>
  );
};
