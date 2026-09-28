import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { listVocabNodesAction } from "@/lib/actions/phrase-images";
import { fmt } from "@/lib/i18n";
import { IconGrid, IconChevronRight } from "@/components/icons";

/**
 * Активности: витрина игр.
 *
 * Играют в классе — там известен ученик, — поэтому отсюда ведёт ссылка
 * в класс, а не вторая копия настройки. Здесь же видно, сколько слов
 * готово к игре: без картинок играть не во что.
 */
export default async function ActivitiesPage() {
  const { t } = await getDict();
  const nodes = await listVocabNodesAction();

  const words = nodes.reduce((sum, n) => sum + n.words, 0);
  const ready = nodes.reduce((sum, n) => sum + n.ready, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.nav.activities}</h1>
        <p className="mt-1 text-sm text-muted">{t.game.subtitle}</p>
      </div>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grad-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <IconGrid className="h-6 w-6" />
          </span>
          <div className="min-w-[12rem] flex-1">
            <p className="font-semibold text-content">{t.game.title}</p>
            <p className="mt-0.5 text-sm text-muted">{t.game.subtitle}</p>
          </div>
          <span className="tint-green rounded-full px-3 py-1 text-xs font-semibold">
            {fmt(t.pictures.ready, { ready, words })}
          </span>
        </div>

        <Link
          href="/teacher/class"
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {t.nav.myClass} <IconChevronRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-content">{t.pictures.title}</p>
        <p className="mt-1 text-[13px] text-muted">{t.pictures.hint}</p>

        <div className="mt-3 flex flex-col divide-y divide-line">
          {nodes.length === 0 && (
            <p className="text-sm text-faint">{t.game.noVocab}</p>
          )}
          {nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-content">
                {node.icon ? `${node.icon} ` : ""}
                {node.name}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  node.ready === node.words && node.words > 0
                    ? "tint-green"
                    : node.ready > 0
                      ? "tint-amber"
                      : "bg-surface-2 text-muted"
                }`}
              >
                {fmt(t.pictures.ready, { ready: node.ready, words: node.words })}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/teacher/materials"
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-semibold text-content transition hover:border-accent hover:text-accent"
        >
          {t.nav.materials} <IconChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
