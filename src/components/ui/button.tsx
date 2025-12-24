import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-md hover:shadow-lg active:shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:scale-[1.02] shadow-md hover:shadow-lg active:shadow-sm",
        outline:
          "border-2 border-border bg-card text-foreground hover:bg-accent/10 hover:text-accent-foreground hover:border-accent/50 hover:scale-[1.01] dark:border-border dark:bg-card dark:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-[1.02] shadow-sm hover:shadow-md",
        ghost: "text-foreground hover:bg-accent/10 hover:text-accent-foreground hover:scale-[1.02] dark:text-foreground dark:hover:bg-accent/10",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-dark",
        premium: "bg-primary text-primary-foreground hover:bg-primary-dark shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-xl hover:scale-[1.02]",
        success: "bg-success text-success-foreground hover:bg-success/90 hover:scale-[1.02] shadow-md hover:shadow-lg",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 hover:scale-[1.02] shadow-md hover:shadow-lg",
        glass: "bg-background/60 backdrop-blur-xl border border-border/50 text-foreground hover:bg-background/80 hover:scale-[1.02] shadow-sm hover:shadow-md",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
        xl: "h-12 rounded-xl px-10 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
