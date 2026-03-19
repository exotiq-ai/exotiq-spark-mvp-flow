import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
}

const sizeConfig = {
  sm: { emblem: "h-7 w-7", text: "text-base" },
  md: { emblem: "h-9 w-9", text: "text-xl" },
  lg: { emblem: "h-11 w-11", text: "text-2xl" },
};

export const Logo = ({ className, size = "md", iconOnly = false }: LogoProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const emblemSrc = isDark
    ? "/brand/logos/svg/d-emblem-white-transparent.svg"
    : "/brand/logos/svg/d-emblem-gulf-blue-transparent.svg";

  const { emblem, text } = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={emblemSrc}
        alt="Exotiq"
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
          Exotiq
        </span>
      )}
    </div>
  );
};
