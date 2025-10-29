import { cn } from "@/lib/utils";

interface ModulePaginationProps {
  total: number;
  current: number;
  onDotClick?: (index: number) => void;
}

export const ModulePagination = ({ total, current, onDotClick }: ModulePaginationProps) => {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onDotClick?.(index)}
          className={cn(
            "h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            index === current
              ? "w-8 bg-primary"
              : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
          )}
          aria-label={`Go to page ${index + 1}`}
          aria-current={index === current ? "true" : "false"}
        />
      ))}
    </div>
  );
};
