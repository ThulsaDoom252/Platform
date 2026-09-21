import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  default: "bg-surface-2 text-muted",
  success: "tint-green",
  warning: "tint-amber",
  danger: "tint-rose",
  info: "tint-sky",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
