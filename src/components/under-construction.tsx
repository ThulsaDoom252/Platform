"use client";

import { useT } from "@/components/i18n-provider";
import { IconSettings } from "@/components/icons";

export function UnderConstruction({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { t } = useT();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center ring-1 ring-line shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <IconSettings className="h-7 w-7" />
        </div>
        <p className="text-base font-semibold text-content">{t.comingSoon.title}</p>
        <p className="max-w-sm text-sm text-faint">{t.comingSoon.text}</p>
      </div>
    </div>
  );
}
