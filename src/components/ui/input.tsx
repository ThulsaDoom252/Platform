import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
