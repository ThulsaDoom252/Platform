"use client";

/**
 * Пул скороговорок.
 *
 * Карточки — снимки, поэтому главное здесь показать их достаточно
 * крупно: три режима от плитки до одной на всю ширину. Порядок ручной,
 * перетаскиванием: учитель раскладывает их так, как идёт по ним на
 * уроке, и дата загрузки к этому отношения не имеет.
 */
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  deleteTwisterAction,
  listTwistersAction,
  renameTwisterAction,
  reorderTwistersAction,
  uploadTwistersAction,
  type Twister,
} from "@/lib/actions/tongue-twisters";
import {
  moveItem,
  sortTwisters,
  TWISTER_SORTS,
  TWISTER_VIEWS,
  type TwisterSort,
  type TwisterView,
} from "@/lib/twisters";
import { useLocalJson } from "@/lib/use-local-json";
import { TwisterAssign } from "./twister-assign";
import { TwisterViewer } from "./twister-viewer";
import { IconGrid, IconList, IconPlus, IconTrash, IconUser, IconEye } from "@/components/icons";
import { cn } from "@/lib/utils";

const VIEW_CLASS: Record<TwisterView, string> = {
  grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
  list: "flex flex-col gap-2",
  large: "grid grid-cols-1 gap-4 lg:grid-cols-2",
};

export function TwisterPool({ initial }: { initial: Twister[] }) {
  const { t } = useT();
  const [pool, setPool] = useState(initial);
  const [view, setView] = useLocalJson<TwisterView>("lingora-twister-view", "grid");
  const [sort, setSort] = useLocalJson<TwisterSort>("lingora-twister-sort", "manual");
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Twister | null>(null);
  const [watching, setWatching] = useState<Twister | null>(null);
  const [busy, startBusy] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const dragged = useRef<number | null>(null);

  // Порядок правится только руками; в остальных режимах перетаскивать
  // нечего — переставленное всё равно не сохранилось бы.
  const manual = sort === "manual";
  const shown = sortTwisters(pool, sort);

  const reload = () => startBusy(async () => setPool(await listTwistersAction()));

  /*
   * Отправляем по одной картинке за вызов. Выбрать можно сколько угодно,
   * но десяток снимков разом не влезает в ограничение на тело запроса, и
   * вся пачка отваливалась бы целиком из-за одного лишнего мегабайта.
   */
  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);
    startBusy(async () => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("images", file);
        const result = await uploadTwistersAction(form);
        if (result.error) {
          setError(result.error);
          break;
        }
      }
      setPool(await listTwistersAction());
    });
  }

  function drop(to: number) {
    const from = dragged.current;
    dragged.current = null;
    if (from === null || from === to || !manual) return;

    const next = moveItem(shown, from, to);
    setPool(next.map((item, i) => ({ ...item, sortOrder: i + 1 })));
    startBusy(async () => {
      await reorderTwistersAction(next.map((item) => item.id));
    });
  }

  const tab = <T extends string>(
    value: T,
    current: T,
    onPick: (next: T) => void,
    label: string,
    icon?: React.ReactNode,
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => onPick(value)}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition",
        current === value
          ? "bg-accent text-white"
          : "text-muted hover:bg-surface-2 hover:text-content",
      )}
    >
      {icon}
      {label}
    </button>
  );

  const viewLabel: Record<TwisterView, string> = {
    grid: t.twisters.viewGrid,
    list: t.twisters.viewList,
    large: t.twisters.viewLarge,
  };
  const viewIcon: Record<TwisterView, React.ReactNode> = {
    grid: <IconGrid className="h-3.5 w-3.5" />,
    list: <IconList className="h-3.5 w-3.5" />,
    large: <IconEye className="h-3.5 w-3.5" />,
  };
  const sortLabel: Record<TwisterSort, string> = {
    manual: t.twisters.sortManual,
    newest: t.twisters.sortNewest,
    title: t.twisters.sortTitle,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Панель: загрузка, вид, порядок */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-2.5 ring-1 ring-line">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={busy}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <IconPlus className="h-4 w-4" />
          {busy ? t.twisters.uploading : t.twisters.upload}
        </button>
        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />

        <span className="ml-1 text-[12px] text-faint">
          {fmt(t.twisters.count, { n: pool.length })}
        </span>

        <span className="ml-auto flex items-center gap-1 rounded-xl bg-surface-2 p-1">
          {TWISTER_VIEWS.map((v) => tab(v, view, setView, viewLabel[v], viewIcon[v]))}
        </span>
        <span className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
          {TWISTER_SORTS.map((s) => tab(s, sort, setSort, sortLabel[s]))}
        </span>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      {manual && pool.length > 1 && (
        <p className="text-[12px] text-faint">{t.twisters.dragHint}</p>
      )}

      {pool.length === 0 ? (
        <div className="rounded-2xl bg-surface p-10 text-center ring-1 ring-line">
          <p className="text-sm font-semibold text-content">{t.twisters.empty}</p>
          <p className="mt-1 text-[12px] text-faint">{t.twisters.emptyHint}</p>
        </div>
      ) : (
        <div className={VIEW_CLASS[view]}>
          {shown.map((item, i) => (
            <Card
              key={item.id}
              item={item}
              view={view}
              draggable={manual}
              onDragStart={() => (dragged.current = i)}
              onDrop={() => drop(i)}
              onOpen={() => setWatching(item)}
              onAssign={() => setAssigning(item)}
              onRename={(title) =>
                startBusy(async () => {
                  await renameTwisterAction(item.id, title);
                  setPool((prev) =>
                    prev.map((row) =>
                      row.id === item.id ? { ...row, title: title.trim() || null } : row,
                    ),
                  );
                })
              }
              onDelete={() => {
                if (!confirm(t.twisters.deleteConfirm)) return;
                startBusy(async () => {
                  await deleteTwisterAction(item.id);
                  setPool((prev) => prev.filter((row) => row.id !== item.id));
                });
              }}
            />
          ))}
        </div>
      )}

      {watching && (
        <TwisterViewer
          items={shown}
          startId={watching.id}
          onClose={() => setWatching(null)}
        />
      )}

      {assigning && (
        <TwisterAssign
          twister={assigning}
          onClose={() => setAssigning(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}

function Card({
  item,
  view,
  draggable,
  onDragStart,
  onDrop,
  onOpen,
  onAssign,
  onRename,
  onDelete,
}: {
  item: Twister;
  view: TwisterView;
  draggable: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onOpen: () => void;
  onAssign: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const row = view === "list";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-accent",
        row && "flex items-center gap-3 p-2",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "relative block overflow-hidden bg-surface-2",
          row ? "h-16 w-24 shrink-0 rounded-xl" : "aspect-[4/3] w-full",
        )}
      >
        <Image
          src={item.imageUrl}
          alt={item.title ?? t.twisters.untitled}
          fill
          sizes={row ? "96px" : "(max-width: 640px) 50vw, 25vw"}
          className="object-contain"
        />
      </button>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", row ? "" : "p-2.5")}>
        {/* Поле неуправляемое: набранное принадлежит полю, а пришедшее
            с сервера название въезжает через key — так правка соседней
            карточки не стирает то, что сейчас печатают в этой. */}
        <input
          key={item.title ?? ""}
          defaultValue={item.title ?? ""}
          onBlur={(e) => e.target.value !== (item.title ?? "") && onRename(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder={t.twisters.titlePlaceholder}
          className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-semibold text-content outline-none transition placeholder:font-normal placeholder:text-faint hover:border-line focus:border-accent focus:bg-surface-2"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAssign}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-soft px-2 text-[12px] font-semibold text-accent transition hover:opacity-90"
          >
            <IconUser className="h-3.5 w-3.5" />
            {t.twisters.assign}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t.common.delete}
            aria-label={t.common.delete}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-rose-500"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
