import { type ReactNode } from "react";
import { clsx } from "clsx";

interface GlassCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ title, children, className, glow = false }: GlassCardProps) {
  return (
    <div
      className={clsx(
        "relative rounded-2xl overflow-hidden",
        // Glass base
        "bg-surface-high/50 backdrop-blur-[16px]",
        // Ghost border
        "border border-outline-variant/20",
        // Tinted gradient overlay via pseudo-element workaround using a nested div
        "transition-all duration-300",
        glow && "shadow-[0_0_40px_2px_rgba(153,247,255,0.08)]",
        "hover:shadow-[0_0_40px_4px_rgba(153,247,255,0.12)] hover:border-outline-variant/30",
        className
      )}
    >
      {/* Soulful gradient tint */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.04] bg-gradient-to-br from-primary to-primary-container"
        aria-hidden
      />
      <div className="relative px-6 py-6">
        {title && (
          <h3 className="font-display font-semibold text-lg text-on-surface mb-6 tracking-tight">
            {title}
          </h3>
        )}
        <div className="font-body text-sm text-on-surface-variant leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
