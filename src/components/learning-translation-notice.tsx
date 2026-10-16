"use client";

import { useT } from "@/components/i18n-provider";

const messages = {
  en: "Automatic translation is temporarily unavailable. Showing the saved material in its original language. Your answers and progress are unchanged.",
  ru: "Автоперевод временно недоступен. Показан сохранённый материал на исходном языке. Ответы и прогресс не изменены.",
  uk: "Автопереклад тимчасово недоступний. Показано збережений матеріал мовою оригіналу. Відповіді та прогрес не змінені.",
};

export function LearningTranslationNotice({ show }: { show?: boolean }) {
  const { locale } = useT();
  if (!show) return null;
  return <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-content">{messages[locale]}</div>;
}
