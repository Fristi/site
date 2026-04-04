import { type InputHTMLAttributes, useId } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id: idProp, ...props }: InputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="font-body text-sm font-medium text-on-surface-variant"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          "w-full rounded-xl px-4 py-3",
          "bg-surface-lowest text-on-surface font-body text-sm",
          // No box border — glowing bottom line instead via outline trick
          "border-0 outline-none",
          "border-b-2 border-outline-variant/30",
          "transition-all duration-200",
          "focus:border-primary focus:shadow-[0_2px_0_0_theme(colors.primary)]",
          "placeholder:text-on-surface-variant/50",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    </div>
  );
}
