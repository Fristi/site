import { clsx } from "clsx";

type BlobColor = "primary" | "secondary";
type BlobPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

interface BackgroundBlobProps {
  color?: BlobColor;
  position?: BlobPosition;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const positionClasses: Record<BlobPosition, string> = {
  "top-left": "-top-32 -left-32",
  "top-right": "-top-32 -right-32",
  "bottom-left": "-bottom-32 -left-32",
  "bottom-right": "-bottom-32 -right-32",
  "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "w-64 h-64",
  md: "w-96 h-96",
  lg: "w-[600px] h-[600px]",
};

export function BackgroundBlob({
  color = "primary",
  position = "top-right",
  size = "md",
  className,
}: BackgroundBlobProps) {
  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none absolute rounded-full blur-[80px]",
        sizeClasses[size],
        positionClasses[position],
        color === "primary" && "bg-primary opacity-[0.05]",
        color === "secondary" && "bg-secondary opacity-[0.05]",
        className
      )}
    />
  );
}

/** Convenience wrapper: renders a section with two complementary blobs */
export function BlobBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <BackgroundBlob color="primary" position="top-right" size="lg" />
      <BackgroundBlob color="secondary" position="bottom-left" size="md" />
      {children}
    </div>
  );
}
