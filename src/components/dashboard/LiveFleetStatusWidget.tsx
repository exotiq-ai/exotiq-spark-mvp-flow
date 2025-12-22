import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, ArrowRight } from "lucide-react";
import { FleetStatusDonut } from "@/components/charts/FleetStatusDonut";
import { motion } from "framer-motion";

interface LiveFleetStatusWidgetProps {
  onViewAll: () => void;
}

export const LiveFleetStatusWidget = ({ onViewAll }: LiveFleetStatusWidgetProps) => {
  return (
    <Card className="p-6 border-2 border-border shadow-sm h-full">
      <motion.div 
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Live Fleet Status</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="group">
          View All
          <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
        </Button>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex justify-center"
      >
        <FleetStatusDonut />
      </motion.div>
    </Card>
  );
};