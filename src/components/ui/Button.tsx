import { type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "glass";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-body font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40",
        sizeClasses[size],
        variant === "primary" && [
          "bg-primary text-on-primary",
          "shadow-[0_0_20px_2px_rgba(153,247,255,0.25)]",
          "hover:shadow-[0_0_32px_4px_rgba(153,247,255,0.35)] hover:brightness-105",
        ],
        variant === "glass" && [
          "bg-surface-high/50 backdrop-blur-[16px] text-on-surface",
          "border border-outline-variant/20",
          "hover:bg-surface-highest/60 hover:backdrop-blur-[20px]",
          "hover:shadow-[inset_0_0_0_1px_rgba(153,247,255,0.30)]",
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
