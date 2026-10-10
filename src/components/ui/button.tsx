import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-ink-900 text-white shadow-sm hover:bg-ink-800 active:scale-[0.98]",
        brand:
          "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_6px_16px_-6px_rgb(91_69_230/0.6)] hover:from-brand-500 hover:to-brand-700 active:scale-[0.98]",
        secondary:
          "bg-white text-ink-800 ring-1 ring-line shadow-sm hover:bg-ink-50 hover:ring-ink-200",
        ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
        danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
        "danger-soft": "bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100",
        link: "text-brand-600 underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
