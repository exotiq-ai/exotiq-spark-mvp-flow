import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  names: string[];
}

export const TypingIndicator = ({ names }: TypingIndicatorProps) => {
  if (names.length === 0) return null;

  const displayText = names.length === 1 
    ? `${names[0]} is typing`
    : names.length === 2 
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span>{displayText}</span>
    </motion.div>
  );
};
