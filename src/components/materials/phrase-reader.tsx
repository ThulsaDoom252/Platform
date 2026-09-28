"use client";

import { useEffect, useState, useTransition } from "react";
import {
  movePhraseAction,
  clearPhraseNoteAction,
  deletePhraseAction,
  repairPhraseIconAction,
  renameSectionAction,
  deleteSectionAction,
} from "@/lib/actions/materials";
import { useT } from "@/components/i18n-provider";
import { hasTranscription } from "@/lib/phrase-words";
import { fmt } from "@/lib/i18n";
import { useSpeech } from "./speech";
import { cn } from "@/lib/utils";
import {
  IconVolume,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconTrash,
} from "@/components/icons";

export type PhraseExample = { en: string; tr: string };

export type MaterialPhrase = {
  id: string;
  icon: string | null;
  imageUrl: string | null;
  phrase: string;
  transcription: string | null;
  /** Американский и британский варианты; у старых записей их нет. */
  transcriptionUs: string | null;
  transcriptionUk: string | null;
  translation: string | null;
  /** Заметка «что стоит знать» под словом. */
  note: string | null;
  /** Данные для игр: ученик их не видит, учитель — по своему желанию. */
  description?: string | null;
  gameImageUrl?: string | null;
  section: string | null;
  kind: string;
  examples: PhraseExample[];
};


function SpeakButton({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition",
        active
          ? "bg-accent text-white"
          : "bg-surface-2 text-muted hover:bg-accent-soft hover:text-accent",
      )}
    >
      <IconVolume className={cn("h-3.5 w-3.5", active && "animate-pulse")} />
      {label}
    </button>
  );
}

/** Карандаш в углу карточки — правка записи. */
function EditBadge({ onEdit }: { onEdit?: () => void }) {
  if (!onEdit) return null;
  return (
    <button
      type="button"
      onClick={onEdit}
      title="Изменить запись"
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-faint opacity-0 transition hover:text-accent group-hover:opacity-100"
    >
      <IconPencil className="h-4 w-4" />
    </button>
  );
}

/**
 * Корзина рядом с карандашом.
 *
 * Спрашиваем подтверждение: запись уходит насовсем, а промахнуться по
 * соседней кнопке легко. Зато это одно нажатие вместо окна правки.
 */
function DeleteBadge({
  phrase,
  onDelete,
}: {
  phrase: string;
  onDelete?: () => void;
}) {
  if (!onDelete) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`Удалить «${phrase}» из словника?`)) onDelete();
      }}
      title="Удалить запись"
      className="absolute right-20 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-faint opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
    >
      <IconTrash className="h-4 w-4" />
    </button>
  );
}

/** Точечный подбор иконки виден только учителю. */
function RepairIconBadge({
  onRepair,
  busy,
}: {
  onRepair?: () => void;
  busy?: boolean;
}) {
  if (!onRepair) return null;
  return (
    <button
      type="button"
      draggable={false}
      disabled={busy}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onRepair}
      title="Исправить иконку только этой записи"
      className="absolute right-11 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-sm text-amber-500 opacity-70 transition hover:bg-amber-500/25 hover:opacity-100 disabled:cursor-wait disabled:opacity-40"
    >
      <span aria-hidden>{busy ? "…" : "✨"}</span>
    </button>
  );
}

function PhraseCard({
  p,
  index,
  hidden,
  gameData = false,
  hints = true,
  imageScale = 100,
  speech,
  onEdit,
  onDelete,
  onClearNote,
  onRepairIcon,
  repairBusy,
}: {
  p: MaterialPhrase;
  index: number;
  /** Что спрятано: ничего, перевод или само слово. */
  hidden: "none" | "translation" | "word";
  /** Показывать ли описание и картинку, по которым спрашивают игры. */
  gameData?: boolean;
  /** Показывать ли заметку «что стоит знать». */
  hints?: boolean;
  /** Размер картинки слова в процентах от обычного. */
  imageScale?: number;
  speech: ReturnType<typeof useSpeech>;
  onEdit?: () => void;
  onDelete?: () => void;
  onClearNote?: () => void;
  onRepairIcon?: () => void;
  repairBusy?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const grad = ["grad-c1", "grad-c2", "grad-c3", "grad-c4"][index % 4];
  // Обычный размер картинки — 80; масштаб задаёт страница целиком.
  const imageSide = Math.round((80 * imageScale) / 100);

  const wordVisible = hidden !== "word" || revealed;
  const translationVisible = hidden !== "translation" || revealed;

  /*
   * Транскрипция принадлежит слову, поэтому прячется вместе с ним: она
   * и есть подсказка, как это слово звучит.
   *
   * Показывается только у одного слова — у выражения читать её целиком
   * никто не станет, а места она занимает столько же, сколько фраза.
   */
  const showIpa = wordVisible && hasTranscription(p.phrase);
  const ipaUs = p.transcriptionUs ?? p.transcription;
  const ipaUk =
    p.transcriptionUk && p.transcriptionUk !== p.transcriptionUs
      ? p.transcriptionUk
      : null;

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-accent/40">
      <EditBadge onEdit={onEdit} />
      <DeleteBadge phrase={p.phrase} onDelete={onDelete} />
      <RepairIconBadge onRepair={onRepairIcon} busy={repairBusy} />
      <div className="flex gap-3.5 p-4 sm:gap-4 sm:p-5">
        {/* Картинка-образ */}
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.phrase}
            style={{ width: imageSide, height: imageSide }}
            className="max-w-[40vw] shrink-0 self-start rounded-2xl object-cover"
          />
        ) : (
          <span
            className={cn(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm sm:h-20 sm:w-20 sm:text-4xl",
              grad,
            )}
          >
            {p.icon ?? "💬"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* Фраза + транскрипция + произношение */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {wordVisible ? (
              <h3 className="text-base font-bold text-content sm:text-lg">{p.phrase}</h3>
            ) : (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-faint transition hover:bg-accent-soft hover:text-accent"
              >
                {t.phrases.tapToRevealWord}
              </button>
            )}

            {/* Транскрипция: не серая строчка мимоходом, а отдельная
                плашка — на неё смотрят прицельно, когда сомневаются в
                произношении. */}
            {showIpa && (ipaUs || ipaUk) && (
              <span className="flex flex-wrap items-center gap-1.5">
                {ipaUs && (
                  <span className="flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-accent/70">
                      us
                    </span>
                    <span className="font-mono text-[13px] font-semibold text-accent">
                      {ipaUs}
                    </span>
                  </span>
                )}
                {ipaUk && (
                  <span className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-faint">
                      uk
                    </span>
                    <span className="font-mono text-[13px] font-semibold text-muted">
                      {ipaUk}
                    </span>
                  </span>
                )}
              </span>
            )}
            {speech.supported && wordVisible && (
              <div className="flex items-center gap-1.5">
                <SpeakButton
                  label="US"
                  title={t.phrases.listenUS}
                  active={speech.speaking === `${p.id}-us`}
                  onClick={() => speech.speak(`${p.id}-us`, p.phrase, "en-US")}
                />
                {speech.ukAvailable && (
                  <SpeakButton
                    label="UK"
                    title={t.phrases.listenUK}
                    active={speech.speaking === `${p.id}-uk`}
                    onClick={() => speech.speak(`${p.id}-uk`, p.phrase, "en-GB")}
                  />
                )}
              </div>
            )}
          </div>

          {/* Перевод */}
          {p.translation && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className={cn(
                "mt-1.5 block w-full rounded-lg text-left text-sm font-semibold transition sm:text-[15px]",
                translationVisible
                  ? "text-[color:var(--lesson-green)]"
                  : "select-none bg-surface-2 px-3 py-1.5 text-faint hover:bg-accent-soft",
              )}
            >
              {translationVisible ? p.translation : t.phrases.tapToReveal}
            </button>
          )}

          {/* Примеры */}
          {p.examples.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-accent transition hover:opacity-80"
            >
              <IconChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")}
              />
              {open
                ? t.phrases.hideExamples
                : fmt(t.phrases.examples, { n: p.examples.length })}
            </button>
          )}

          {/* Данные для игр: описание и подобранная картинка. Ученику не
              показываются — по ним его и спрашивают. */}
          {gameData && (p.description || p.gameImageUrl) && (
            <div className="mt-2.5 flex items-start gap-2.5 rounded-xl bg-surface-2 p-2.5">
              {p.gameImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.gameImageUrl}
                  alt=""
                  className="h-14 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-surface text-[10px] text-faint">
                  {t.phrases.noPicture}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">
                  {t.phrases.gameData}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-[13px] leading-snug",
                    p.description ? "text-content" : "text-faint",
                  )}
                >
                  {p.description || t.phrases.noDescription}
                </span>
              </span>
            </div>
          )}

          {hints && p.note && (
            <div className="group/note relative mt-2.5">
              <p className="whitespace-pre-line rounded-xl tint-amber px-3 py-2 pr-9 text-[13px] leading-snug">
                {p.note}
              </p>
              {onClearNote && (
                <button
                  type="button"
                  onClick={onClearNote}
                  title="Убрать подсказку"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg text-[13px] opacity-0 transition hover:bg-black/10 group-hover/note:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {open && p.examples.length > 0 && (
        <div className="border-t border-line bg-surface-2 px-4 py-3.5 sm:px-5">
          <ul className="flex flex-col gap-3">
            {p.examples.map((ex, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-content">
                    {ex.en}
                    {speech.supported && (
                      <button
                        type="button"
                        onClick={() => speech.speak(`${p.id}-ex${i}`, ex.en, "en-US")}
                        title={t.phrases.listenUS}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition",
                          speech.speaking === `${p.id}-ex${i}`
                            ? "bg-accent text-white"
                            : "text-faint hover:bg-accent-soft hover:text-accent",
                        )}
                      >
                        <IconVolume className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </p>
                  {/* Перевод примера прячется вместе с переводом слова. */}
                  {translationVisible && (
                    <p className="mt-0.5 text-[13px] italic text-muted">{ex.tr}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/** Пояснительная заметка 💡 между группами фраз. */
function NoteCard({ p, onEdit }: { p: MaterialPhrase; onEdit?: () => void }) {
  return (
    <div className="tint-amber group relative rounded-2xl px-4 py-3.5 text-sm">
      <EditBadge onEdit={onEdit} />
      <p className="font-semibold">💡 {p.phrase}</p>
      {p.translation && (
        <p className="mt-1 leading-snug opacity-90">{p.translation}</p>
      )}
    </div>
  );
}

export function PhraseReader({
  imageScale = 100,
  title,
  icon,
  description,
  coverImageUrl,
  phrases,
  onEditPhrase,
  onImageScale,
  onEditImage,
  nodeId,
}: {
  title: string;
  icon: string | null;
  description: string | null;
  coverImageUrl?: string | null;
  phrases: MaterialPhrase[];
  /** Передаётся только учителю — у ученика правки нет. */
  onEditPhrase?: (p: MaterialPhrase) => void;
  /** Страница, которой принадлежат записи: нужна для правки категорий. */
  nodeId?: string;
  /** Размер картинок слов в процентах; 100 — обычный. */
  imageScale?: number;
  /** Передаётся только учителю: размер картинок хранится у страницы. */
  onImageScale?: (scale: number) => void;
  /** Щелчок по картинке открывает её правку. Только у учителя. */
  onEditImage?: () => void;
}) {
  const { t } = useT();
  /*
   * Что спрятано на карточках. Либо-либо: прятать разом обе стороны
   * бессмысленно — на карточке не осталось бы ничего.
   */
  const [hidden, setHidden] = useState<"none" | "translation" | "word">("none");
  /*
   * Описания и картинки для игр. По умолчанию выключены даже у учителя:
   * в обычной работе они только мешают, а ученику не показываются
   * никогда — редактор словника открыт только учителю.
   */
  const [gameData, setGameData] = useState(false);
  // Заметки под словами — то, что стоит знать, но не обязательно читать
  // сразу. Учитель гасит их, когда хочет чистый список.
  const [hints, setHints] = useState(true);

  /**
   * Пределы размера зависят от того, что на странице. Картинку слова
   * есть смысл увеличивать, обложку — только уменьшать: она и так во
   * всю ширину.
   */
  const hasWordImages = phrases.some((p) => p.imageUrl);
  const scaleMin = 30;
  const scaleMax = hasWordImages ? 260 : 100;
  const speech = useSpeech();

  const editable = !!onEditPhrase && !!nodeId;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ id: string; where: "before" | "after" } | null>(null);
  const [dropSection, setDropSection] = useState<string | null | undefined>(undefined);
  const [busy, startMove] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  if (phrases.length === 0) {
    return <p className="py-16 text-center text-sm text-faint">{t.phrases.empty}</p>;
  }

  // Группируем по секциям, сохраняя исходный порядок.
  const groups: { section: string | null; items: MaterialPhrase[] }[] = [];
  for (const p of phrases) {
    const last = groups[groups.length - 1];
    if (last && last.section === (p.section ?? null)) last.items.push(p);
    else groups.push({ section: p.section ?? null, items: [p] });
  }

  const phraseCount = phrases.filter((p) => p.kind !== "NOTE").length;

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    startMove(async () => {
      const res = await fn();
      setNotice(res.error ?? res.message ?? null);
    });

  function finishDrag() {
    setDragId(null);
    setDropAt(null);
    setDropSection(undefined);
  }

  /** Край карточки — встать рядом, середина — тоже рядом: слова плоские. */
  const cardDrag = (p: MaterialPhrase) => {
    if (!editable) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", p.id);
        setDragId(p.id);
      },
      onDragEnd: finishDrag,
      onDragOver: (e: React.DragEvent) => {
        if (!dragId || dragId === p.id) return;
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const where = e.clientY - r.top < r.height / 2 ? "before" : "after";
        if (dropAt?.id !== p.id || dropAt.where !== where) setDropAt({ id: p.id, where });
      },
      onDragLeave: () => {
        if (dropAt?.id === p.id) setDropAt(null);
      },
      onDrop: (e: React.DragEvent) => {
        if (!dragId || dragId === p.id) return;
        e.preventDefault();
        e.stopPropagation();
        const id = dragId;
        const where = dropAt?.where ?? "before";
        finishDrag();
        run(() => movePhraseAction(id, { phraseId: p.id, where }));
      },
    };
  };

  /** Заголовок принимает слово — оно уходит в конец этой категории. */
  const headerDrop = (section: string | null) => {
    if (!editable) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        setDropSection(section);
      },
      onDragLeave: () => setDropSection(undefined),
      onDrop: (e: React.DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        const id = dragId;
        finishDrag();
        run(() => movePhraseAction(id, { section }));
      },
    };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка страницы */}
      <header
        className={cn(
          "relative overflow-hidden rounded-2xl shadow-md",
          coverImageUrl
            ? "bg-surface ring-1 ring-line"
            : "grad-accent p-5 text-white sm:min-h-56 sm:p-6",
        )}
      >
        {coverImageUrl && (
          <div className="flex justify-center bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt={`Обложка: ${title}`}
              onClick={onEditImage}
              title={onEditImage ? "Нажми, чтобы изменить картинку" : undefined}
              style={{ width: `${Math.min(100, imageScale)}%` }}
              className={cn(
                "block h-auto object-contain",
                onEditImage && "cursor-pointer transition hover:opacity-90",
              )}
            />
          </div>
        )}
        <div
          className={cn(
            "relative z-10",
            coverImageUrl && "border-t border-line bg-surface p-5 sm:p-6",
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
                coverImageUrl
                  ? "bg-accent-soft ring-1 ring-accent/20"
                  : "bg-white/20 backdrop-blur",
              )}
            >
              {icon ?? "📖"}
            </span>
            <div className="min-w-0">
              <h2
                className={cn(
                  "text-xl font-bold leading-tight sm:text-2xl",
                  coverImageUrl && "text-content",
                )}
              >
                {title}
              </h2>
              {description && (
                <p
                  className={cn(
                    "mt-0.5 text-sm",
                    coverImageUrl ? "text-muted" : "text-white/80",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          <p
            className={cn(
              "mt-3 text-xs",
              coverImageUrl ? "text-faint" : "text-white/70",
            )}
          >
            {fmt(t.phrases.count, { n: phraseCount })}
          </p>
        </div>
        {!coverImageUrl && (
          <>
            <div className="pointer-events-none absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute right-16 -top-10 h-24 w-24 rounded-full bg-white/10" />
          </>
        )}
      </header>

      {/* Управление */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Прятать можно любую сторону, но только одну: скрыв обе, на
            карточке не осталось бы ничего. */}
        <div className="flex h-9 items-center gap-1 rounded-xl bg-surface px-1.5 ring-1 ring-line">
          <span className="px-1 text-[11px] font-semibold text-faint">
            {t.phrases.hideMode}
          </span>
          {(
            [
              ["translation", t.phrases.hideTranslations],
              ["word", t.phrases.hideWords],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setHidden((v) => (v === key ? "none" : key))}
              aria-pressed={hidden === key}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition",
                hidden === key
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-content",
              )}
            >
              {hidden === key ? (
                <IconEyeOff className="h-3.5 w-3.5" />
              ) : (
                <IconEye className="h-3.5 w-3.5" />
              )}
              {label}
            </button>
          ))}
        </div>

        {editable && (
          <button
            type="button"
            onClick={() => setGameData((v) => !v)}
            aria-pressed={gameData}
            title={t.phrases.gameDataHint}
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold ring-1 transition",
              gameData
                ? "bg-accent text-white ring-accent"
                : "bg-surface text-muted ring-line hover:text-content",
            )}
          >
            {gameData ? (
              <IconEye className="h-4 w-4" />
            ) : (
              <IconEyeOff className="h-4 w-4" />
            )}
            {t.phrases.gameData}
          </button>
        )}

        {/* Картинки бывают разные: мелкая иконка и кадр, который стоит
            рассмотреть. Размер хранится у страницы, чтобы ученик увидел
            словарь таким же. */}
        {onImageScale && (coverImageUrl || phrases.some((p) => p.imageUrl)) && (
          <div className="flex h-9 items-center gap-1 rounded-xl bg-surface px-1.5 ring-1 ring-line">
            <span className="px-1 text-[11px] font-semibold text-faint">Картинки</span>
            <button
              type="button"
              onClick={() => onImageScale(Math.max(scaleMin, imageScale - 10))}
              disabled={imageScale <= scaleMin}
              title="Меньше"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-content disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => onImageScale(100)}
              title="Обычный размер"
              className={cn(
                "h-7 rounded-lg px-2 text-[11px] font-bold tabular-nums transition",
                imageScale === 100
                  ? "text-faint"
                  : "bg-accent-soft text-accent hover:opacity-80",
              )}
            >
              {imageScale}%
            </button>
            <button
              type="button"
              onClick={() => onImageScale(Math.min(scaleMax, imageScale + 10))}
              disabled={imageScale >= scaleMax}
              title="Больше"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-content disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}

        {phrases.some((p) => p.note) && (
          <button
            type="button"
            onClick={() => setHints((v) => !v)}
            title="Заметки «что стоит знать» под словами"
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition",
              hints
                ? "tint-amber"
                : "bg-surface text-faint ring-1 ring-line hover:text-content",
            )}
          >
            💡 подсказки
          </button>
        )}
      </div>

      {/* Секции с фразами */}
      <div className="flex flex-col gap-5">
        {groups.map((g, gi) => (
          <section key={gi} className="flex flex-col gap-3">
            <div
              {...headerDrop(g.section)}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-1 py-1 transition",
                dropSection === g.section && "bg-accent-soft ring-1 ring-accent",
              )}
            >
              <span className="h-4 w-1 shrink-0 rounded-full bg-accent" />
              <h3 className="flex-1 text-sm font-bold text-content">
                {g.section ?? (editable ? "Без категории" : "")}
              </h3>

              {editable && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = prompt("Название категории", g.section ?? "");
                      if (next && next.trim() && next !== g.section) {
                        run(() => renameSectionAction(nodeId!, g.section, next));
                      }
                    }}
                    title="Переименовать категорию"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-faint opacity-0 transition hover:text-accent group-hover:opacity-100"
                  >
                    <IconPencil className="h-3.5 w-3.5" />
                  </button>
                  {g.section && (
                    <button
                      type="button"
                      onClick={() => {
                        const purge = confirm(
                          `Категория «${g.section}» — ${g.items.length} записей.\n\n` +
                            "OK — удалить вместе со словами.\n" +
                            "Отмена — убрать только заголовок, слова останутся.",
                        );
                        run(() => deleteSectionAction(nodeId!, g.section, purge));
                      }}
                      title="Убрать категорию"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-faint opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>

            {g.items.map((p, i) => (
              <div
                key={p.id}
                {...cardDrag(p)}
                className={cn(
                  "relative transition",
                  dragId === p.id && "opacity-40",
                  editable && "cursor-grab active:cursor-grabbing",
                )}
              >
                {dropAt?.id === p.id && (
                  <span
                    className={cn(
                      "pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full bg-accent",
                      dropAt.where === "before" ? "-top-1.5" : "-bottom-1.5",
                    )}
                  />
                )}
                {p.kind === "NOTE" ? (
                  <NoteCard p={p} onEdit={onEditPhrase && (() => onEditPhrase(p))} />
                ) : (
                  <PhraseCard
                    p={p}
                    index={gi + i}
                    hidden={hidden}
                    gameData={gameData}
                    hints={hints}
                    imageScale={imageScale}
                    speech={speech}
                    onEdit={onEditPhrase && (() => onEditPhrase(p))}
                    onDelete={
                      editable ? () => run(() => deletePhraseAction(p.id)) : undefined
                    }
                    onClearNote={
                      editable && p.note
                        ? () => run(() => clearPhraseNoteAction(p.id))
                        : undefined
                    }
                    onRepairIcon={
                      editable ? () => run(() => repairPhraseIconAction(p.id)) : undefined
                    }
                    repairBusy={busy}
                  />
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      {editable && (
        <button
          type="button"
          onClick={() => {
            const name = prompt("Название новой категории");
            if (!name || !name.trim()) return;
            // Пустая категория нигде не хранится: заводим её на первом слове,
            // которое пока ни к какой не относится.
            const orphan = phrases.find((p) => !p.section);
            if (!orphan) {
              setNotice("Сначала перетащи сюда слово — пустая категория не хранится.");
              return;
            }
            run(() => movePhraseAction(orphan.id, { section: name.trim() }));
          }}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        >
          + Категория
        </button>
      )}

      {(busy || notice) && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-surface px-4 py-2.5 text-sm font-semibold text-content shadow-xl ring-1 ring-line">
          {notice ?? "Переношу…"}
        </div>
      )}
    </div>
  );
}
