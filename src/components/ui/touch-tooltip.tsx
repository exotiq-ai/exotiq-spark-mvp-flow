import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface TouchTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  children?: ReactNode;
  formatter?: (value: number, name: string) => [string, string];
}

export const TouchTooltip = ({ 
  active, 
  payload, 
  label,
  formatter
}: TouchTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -5 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="bg-card border border-border rounded-xl p-3 shadow-xl backdrop-blur-sm"
        style={{
          minWidth: '120px',
          maxWidth: '200px',
        }}
      >
        {label && (
          <p className="text-xs font-semibold text-foreground mb-2 pb-1.5 border-b border-border">
            {label}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((entry, index) => {
            const [formattedValue, formattedName] = formatter 
              ? formatter(entry.value, entry.name)
              : [entry.value, entry.name];
            
            return (
              <div 
                key={index} 
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-1.5">
                  <motion.span 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color || entry.stroke }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {formattedName}
                  </span>
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {formattedValue}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Touch-optimized cursor for charts
export const touchCursorStyle = {
  stroke: 'hsl(var(--primary))',
  strokeWidth: 1.5,
  strokeDasharray: '4 4',
  fill: 'hsl(var(--primary) / 0.1)',
};

// Active dot configuration for touch devices
export const getTouchActiveDot = (color: string) => ({
  r: 8,
  stroke: color,
  strokeWidth: 3,
  fill: 'hsl(var(--card))',
  style: {
    filter: `drop-shadow(0 0 6px ${color})`,
    cursor: 'pointer',
  }
});
