import { SpellCheck2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { getPublishedSpellingMistakes } from "@/lib/spelling-mistakes-data";
import { SpellingMistakesView } from "@/components/mistakes/spelling-mistakes-view";

export default async function StudentMistakesPage() {
  const session = await getSession();
  const { t } = await getDict();
  const spelling = await getPublishedSpellingMistakes(session!.userId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <SpellCheck2 className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-content">{t.mistakes.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{t.mistakes.subtitle}</p>
        </div>
      </header>

      <SpellingMistakesView items={spelling} />
    </div>
  );
}
