import { type ReactNode } from "react";
import { clsx } from "clsx";

interface TypographyProps {
  children: ReactNode;
  className?: string;
}

export function Display({ children, className }: TypographyProps) {
  return (
    <h1
      className={clsx(
        "font-display font-extrabold text-[3.5rem] leading-[1.1] tracking-[-0.02em] text-on-surface",
        className
      )}
    >
      {children}
    </h1>
  );
}

export function Headline({ children, className }: TypographyProps) {
  return (
    <h2
      className={clsx(
        "font-display font-bold text-[2rem] leading-[1.2] tracking-[-0.01em] text-on-surface",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function Title({ children, className }: TypographyProps) {
  return (
    <h3
      className={clsx(
        "font-display font-semibold text-lg leading-snug text-on-surface",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function BodyText({ children, className }: TypographyProps) {
  return (
    <p
      className={clsx(
        "font-body text-base leading-relaxed text-on-surface-variant",
        className
      )}
    >
      {children}
    </p>
  );
}

export function Caption({ children, className }: TypographyProps) {
  return (
    <span
      className={clsx(
        "font-body text-xs leading-normal text-on-surface-variant/70",
        className
      )}
    >
      {children}
    </span>
  );
}
