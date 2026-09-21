import { IconSprout } from "@/components/icons";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center ring-1 ring-line shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <IconSprout className="h-7 w-7" />
        </div>
        <p className="text-base font-semibold text-content">Раздел в разработке</p>
        <p className="max-w-sm text-sm text-faint">
          Этот блок появится в следующей итерации. Сейчас готова главная панель учителя.
        </p>
      </div>
    </div>
  );
}
