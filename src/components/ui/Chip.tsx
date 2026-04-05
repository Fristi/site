import { type ReactNode } from "react";
import { clsx } from "clsx";

interface ChipProps {
  children: ReactNode;
  className?: string;
}

export function Chip({ children, className }: ChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1",
        "bg-secondary-container text-on-secondary-container",
        "font-body text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}
