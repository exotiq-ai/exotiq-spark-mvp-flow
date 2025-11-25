import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RariVoiceWaveformProps {
  isActive: boolean;
  isSpeaking?: boolean;
  className?: string;
}

export const RariVoiceWaveform = ({ 
  isActive, 
  isSpeaking = false,
  className 
}: RariVoiceWaveformProps) => {
  const [bars] = useState(() => Array.from({ length: 5 }, (_, i) => i));

  if (!isActive) {
    return (
      <div className={cn("flex items-center justify-center gap-1 h-12", className)}>
        {bars.map((i) => (
          <div
            key={i}
            className="w-1 h-2 bg-gulf-blue/30 rounded-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center gap-1 h-12", className)}>
      {bars.map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full animate-wave",
            isSpeaking ? "bg-gulf-blue" : "bg-accent"
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
            height: isSpeaking ? '60%' : '40%'
          }}
        />
      ))}
    </div>
  );
};
