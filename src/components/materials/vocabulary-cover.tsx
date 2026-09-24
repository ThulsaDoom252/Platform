"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateVocabularyCoverAction,
  type CoverState,
} from "@/lib/actions/materials";
import { IconCamera, IconTrash } from "@/components/icons";
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

/** Компактные действия над обложкой в общей панели учителя. */
export function VocabularyCoverActions({
  nodeId,
  currentUrl,
}: {
  nodeId: string;
  currentUrl?: string | null;
}) {
  const action = updateVocabularyCoverAction.bind(null, nodeId);
  const [state, formAction, pending] = useActionState<CoverState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const effectiveUrl = state.ok ? state.imageUrl : currentUrl;

  function upload(file: File | null) {
    setClientError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientError("Нужна картинка PNG, JPEG или WebP");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setClientError("Картинка больше 5 МБ");
      return;
    }

    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    formRef.current?.requestSubmit();
  }

  const actionButton =
    "flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        ref={inputRef}
        type="file"
        name="coverImage"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => upload(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (inputRef.current) inputRef.current.value = "";
          inputRef.current?.click();
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
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          upload(event.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          actionButton,
          dragging && "border-accent bg-accent-soft text-accent ring-2 ring-accent/15",
        )}
        title="Выбрать файл или перетащить картинку прямо на кнопку"
      >
        <IconCamera className="h-4 w-4" />
        {pending ? "Загружаю…" : effectiveUrl ? "Заменить картинку" : "Добавить картинку"}
      </button>

      {effectiveUrl && (
        <button
          type="submit"
          name="removeCover"
          value="on"
          disabled={pending}
          className={cn(actionButton, "hover:border-rose-400 hover:text-rose-500")}
        >
          <IconTrash className="h-4 w-4" />
          Удалить картинку
        </button>
      )}

      {(clientError || state.error) && (
        <span className="text-xs font-medium text-rose-500" role="alert">
          {clientError ?? state.error}
        </span>
      )}
    </form>
  );
}
