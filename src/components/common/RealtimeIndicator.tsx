import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RealtimeIndicatorProps {
  show?: boolean;
  message?: string;
}

export const RealtimeIndicator = ({ show = false, message = "Live update received" }: RealtimeIndicatorProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 right-4 z-50"
        >
          <Badge 
            variant="outline" 
            className="bg-success/10 text-success border-success/30 px-4 py-2 shadow-lg animate-pulse-soft"
          >
            <Radio className="w-3 h-3 mr-2 animate-pulse" />
            {message}
          </Badge>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
