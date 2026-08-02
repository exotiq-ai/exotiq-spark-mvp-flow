import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
}

const sizeConfig = {
  sm: { emblem: "h-6 w-6", text: "text-base" },
  md: { emblem: "h-7 w-7", text: "text-xl" },
  lg: { emblem: "h-9 w-9", text: "text-2xl" },
};

export const Logo = ({ className, size = "md", iconOnly = false }: LogoProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const emblemSrc = isDark
    ? "/brand/logos/exotiq-mark-white.png"
    : "/brand/logos/exotiq-mark-black.png";

  const { emblem, text } = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={emblemSrc}
        alt="exotiq"
        className={cn(emblem, "object-contain")}
      />
      {!iconOnly && (
        <span
          className={cn(
            text,
            "font-brand font-bold tracking-tight",
            isDark ? "text-white" : "text-[hsl(var(--foreground))]"
          )}
        >
          exotiq
        </span>
      )}
    </div>
  );
};
