"use client";

import type { ReactNode } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";
import { useLocalFlag } from "@/lib/use-local-flag";

const STORAGE_KEY = "teacher-students-shared-packages-hidden";

/** Переключатель и содержимое читают один локальный флаг и обновляются вместе. */
export function SharedPackagesToggle({
  showLabel,
  hideLabel,
}: {
  showLabel: string;
  hideLabel: string;
}) {
  const [hidden, setHidden] = useLocalFlag(STORAGE_KEY);
  const Icon = hidden ? IconEye : IconEyeOff;

  return (
    <button
      type="button"
      aria-expanded={!hidden}
      onClick={() => setHidden(!hidden)}
      className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-content"
    >
      <Icon className="h-3.5 w-3.5" />
      {hidden ? showLabel : hideLabel}
    </button>
  );
}

export function SharedPackagesContent({
  children,
}: {
  children: ReactNode;
}) {
  const [hidden] = useLocalFlag(STORAGE_KEY);
  if (hidden) return null;

  return <div className="flex flex-col gap-4">{children}</div>;
}
