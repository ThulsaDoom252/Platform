"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateVocabularyCoverAction,
  type CoverState,
} from "@/lib/actions/materials";
import { IconCamera, IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} МБ`;
}

/**
 * Общее поле обложки: настоящий file-input остаётся внутри формы, а файл
 * можно положить на всю карточку или выбрать обычным системным окном.
 */
export function VocabularyCoverField({
  currentUrl,
  name = "coverImage",
  compact = false,
  onFileChange,
}: {
  currentUrl?: string | null;
  name?: string;
  compact?: boolean;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = localPreview ?? currentUrl ?? null;

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function choose(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      onFileChange?.(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(next.type)) {
      setError("Нужна картинка PNG, JPEG или WebP");
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError("Картинка больше 5 МБ");
      return;
    }

    setFile(next);
    onFileChange?.(next);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(next);
    setLocalPreview(objectUrlRef.current);

    // Файл, брошенный мышью, должен попасть в FormData так же, как выбранный.
    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(next);
      inputRef.current.files = transfer.files;
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "group relative isolate cursor-pointer overflow-hidden rounded-2xl border border-dashed text-left transition",
          compact ? "min-h-32" : "min-h-44",
          dragging
            ? "border-accent bg-accent-soft ring-4 ring-accent/10"
            : "border-line bg-surface-2 hover:border-accent",
        )}
        aria-label="Выбрать обложку словаря"
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Предпросмотр обложки"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        )}
        <div
          className={cn(
            "absolute inset-0",
            preview
              ? "bg-gradient-to-r from-black/80 via-black/50 to-black/20"
              : "bg-[radial-gradient(circle_at_84%_18%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_42%)]",
          )}
        />
        <div className="relative z-10 flex min-h-[inherit] items-center gap-4 p-4 sm:p-5">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-lg backdrop-blur",
              preview
                ? "border-white/20 bg-black/35 text-white"
                : "border-accent/20 bg-accent-soft text-accent",
            )}
          >
            <IconCamera className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-bold",
                preview ? "text-white" : "text-content",
              )}
            >
              {file
                ? "Новая обложка готова"
                : currentUrl
                  ? "Заменить обложку"
                  : "Обложка словаря"}
            </p>
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed",
                preview ? "text-white/75" : "text-muted",
              )}
            >
              Перетащи изображение сюда или нажми, чтобы выбрать файл
            </p>
            <span
              className={cn(
                "mt-3 inline-flex rounded-lg px-3 py-1.5 text-[11px] font-bold",
                preview
                  ? "bg-white/15 text-white backdrop-blur"
                  : "bg-surface text-accent ring-1 ring-line",
              )}
            >
              Выбрать файл
            </span>
            <p
              className={cn(
                "mt-2 truncate text-[10px]",
                preview ? "text-white/60" : "text-faint",
              )}
            >
              {file
                ? `${file.name} · ${formatSize(file.size)}`
                : "PNG, JPEG или WebP · до 5 МБ"}
            </p>
          </div>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
}

/** Редактор уже сохранённой обложки на странице словаря. */
export function VocabularyCoverEditor({
  nodeId,
  currentUrl,
}: {
  nodeId: string;
  currentUrl?: string | null;
}) {
  const action = updateVocabularyCoverAction.bind(null, nodeId);
  const [state, formAction, pending] = useActionState<CoverState, FormData>(action, {});
  const [hasFile, setHasFile] = useState(false);

  return (
    <form
      action={formAction}
      onSubmit={() => setHasFile(false)}
      className="rounded-2xl border border-line bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-content">Обложка словаря</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Она появится в оглавлении и в шапке этого словаря.
          </p>
        </div>
        <button
          type="submit"
          disabled={pending || !hasFile}
          className="h-9 rounded-xl bg-accent px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Загружаю…" : currentUrl ? "Заменить" : "Сохранить"}
        </button>
      </div>
      <VocabularyCoverField
        key={state.imageUrl ?? currentUrl ?? "empty-cover"}
        currentUrl={state.imageUrl ?? currentUrl}
        compact
        onFileChange={(file) => setHasFile(!!file)}
      />
      {state.error && (
        <p className="mt-2 text-xs font-medium text-rose-500">{state.error}</p>
      )}
      {state.ok && (
        <p className="tint-green mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold">
          <IconCheck className="h-4 w-4" />
          {state.message}
        </p>
      )}
    </form>
  );
}
