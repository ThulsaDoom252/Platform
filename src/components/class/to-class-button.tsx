"use client";

/**
 * «В класс» из списка учеников.
 *
 * Открывает класс с этим учеником и сразу переводит учителя в него:
 * отдельный выбор на странице класса в этом случае лишний шаг.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { enterClassAction } from "@/lib/actions/class";
import { IconVideo } from "@/components/icons";

export function ToClassButton({
  studentId,
  label,
}: {
  studentId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={label}
      title={label}
      onClick={() =>
        startBusy(async () => {
          await enterClassAction(studentId);
          router.push("/teacher/class");
        })
      }
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-[13px] font-semibold text-content transition hover:border-accent hover:text-accent disabled:opacity-50 sm:w-auto sm:px-3.5"
    >
      <IconVideo className="h-4 w-4 sm:hidden" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
