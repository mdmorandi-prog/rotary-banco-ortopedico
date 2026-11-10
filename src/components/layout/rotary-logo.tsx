/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

interface RotaryLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  variant?: "wheel" | "full";
}

export function RotaryLogo({
  className,
  size = 40,
  showText = false,
  variant = "wheel",
}: RotaryLogoProps) {
  if (variant === "full" || showText) {
    const height = size;
    const width = Math.round(size * (550 / 170));
    return (
      <div className={cn("inline-flex items-center justify-center", className)}>
        <img
          src="/icons/rotary-farroupilha-logo.png"
          alt="Rotary Club de Farroupilha"
          width={width}
          height={height}
          style={{ height: `${height}px`, width: "auto" }}
          className="object-contain select-none"
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2 shrink-0", className)}>
      <img
        src="/icons/rotary-wheel-official.png"
        alt="Emblema Oficial Rotary Club de Farroupilha"
        width={size}
        height={size}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="object-contain shrink-0 select-none"
      />
    </div>
  );
}
