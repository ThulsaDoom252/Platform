"use client";

/**
 * Перенос готовой структуры: вставил текст из Google Docs (или бросил
 * скриншот) — увидел дерево — поправил — создал.
 *
 * Между разбором и базой всегда стоит предпросмотр: ни вставка, ни
 * картинка ничего не заводят сами. Повторный импорт той же структуры
 * её дополняет — совпавшие по названию папки переиспользуются.
 */
import { useRef, useState, useTransition } from "react";
import { parseTree, countNodes, type ImportNode } from "@/lib/tree-import";
import { importTreeAction } from "@/lib/actions/materials";
import { readTreeImageAction } from "@/lib/actions/tree-image";
import { suggestIcon } from "@/lib/icon-suggest";
import { IconPlus, IconX, IconFolder, IconFile } from "@/components/icons";
import type { TreeScope } from "./node-editor";
import { cn } from "@/lib/utils";

export type ImportTarget = {
  parentId: string | null;
  parentName: string;
  scope: TreeScope;
  ownerId: string | null;
};

type Path = number[];

/** Меняет узел по его пути, не трогая остальное дерево. */
function editAt(
  nodes: ImportNode[],
  path: Path,
  fn: (n: ImportNode) => ImportNode | null,
): ImportNode[] {
  const [i, ...rest] = path;
  const node = nodes[i];
  if (!node) return nodes;

  const next =
    rest.length === 0
      ? fn(node)
      : { ...node, children: editAt(node.children, rest, fn) };

  const out = [...nodes];
  if (next === null) out.splice(i, 1);
  else out[i] = next;
  return out;
}

const inputCls =
  "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent";

export function TreeImporter({
  target,
  onClose,
}: {
  target: ImportTarget | null;
  onClose: () => void;
}) {
  const [nodes, setNodes] = useState<ImportNode[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [busy, startBusy] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!target) return null;

  function show(found: ImportNode[], flat: boolean, from: string) {
    if (found.length === 0) {
      setNodes(null);
      setError(`${from}: структура не распозналась.`);
      return;
    }
    setError(null);
    setNodes(found);
    setNote(
      flat
        ? `${from}: ${countNodes(found)} шт., но все на одном уровне — вложенность не считалась. Вставь с форматированием или поправь вручную.`
        : `${from}: ${countNodes(found)} шт.`,
    );
  }

  function fromClipboard(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    if (!html && !plain) return;

    e.preventDefault();
    setText(plain);
    const res = parseTree({ html, text: plain });
    show(res.nodes, res.flat, "Из вставки");
  }

  function fromText() {
    const res = parseTree({ text });
    show(res.nodes, res.flat, "Из текста");
  }

  function fromImage(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Это не картинка.");
      return;
    }

    setError(null);
    setNote("Читаю картинку…");

    const reader = new FileReader();
    reader.onerror = () => setError("Файл не прочитался.");
    reader.onload = () => {
      const url = String(reader.result ?? "");
      startBusy(async () => {
        const res = await readTreeImageAction(url);
        if (res.error || !res.nodes) {
          setNodes(null);
          setNote(null);
          setError(res.error ?? "Не получилось прочитать картинку.");
          return;
        }
        show(res.nodes, false, "С картинки");
      });
    };
    reader.readAsDataURL(file);
  }

  function create() {
    if (!nodes || nodes.length === 0) return;
    startBusy(async () => {
      const res = await importTreeAction(nodes, {
        parentId: target!.parentId,
        scope: target!.scope,
        ownerId: target!.ownerId,
      });

      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

  /** Одна строка предпросмотра — правится прямо здесь. */
  const row = (node: ImportNode, path: Path) => {
    const patch = (p: Partial<ImportNode>) =>
      setNodes((prev) => (prev ? editAt(prev, path, (n) => ({ ...n, ...p })) : prev));

    return (
      <div key={path.join("-")}>
        <div
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: `${(path.length - 1) * 20}px` }}
        >
          <button
            type="button"
            onClick={() => patch({ kind: node.kind === "FOLDER" ? "FILE" : "FOLDER" })}
            title={node.kind === "FOLDER" ? "Папка — нажми, чтобы стало файлом" : "Файл — нажми, чтобы стало папкой"}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition",
              node.kind === "FOLDER"
                ? "bg-accent-soft text-accent ring-accent/30"
                : "bg-surface-2 text-muted ring-line",
            )}
          >
            {node.kind === "FOLDER" ? (
              <IconFolder className="h-4 w-4" />
            ) : (
              <IconFile className="h-4 w-4" />
            )}
          </button>

          <input
            value={node.icon ?? ""}
            onChange={(e) => patch({ icon: Array.from(e.target.value)[0] ?? null })}
            placeholder="—"
            title="Значок"
            className={cn(inputCls, "w-11 shrink-0 text-center")}
          />

          <input
            value={node.name}
            onChange={(e) => patch({ name: e.target.value })}
            className={inputCls}
          />

          <button
            type="button"
            onClick={() => patch({ icon: suggestIcon(node.name) ?? node.icon })}
            title="Подобрать значок по названию"
            className="h-9 shrink-0 rounded-lg px-2 text-[11px] text-faint transition hover:text-accent"
          >
            подобрать
          </button>

          <button
            type="button"
            onClick={() => setNodes((prev) => (prev ? editAt(prev, path, () => null) : prev))}
            title="Убрать из импорта — вместе с вложенным"
            className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-rose-500"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {node.children.map((c, i) => row(c, [...path, i]))}
      </div>
    );
  };

  const total = nodes ? countNodes(nodes) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">Перенести структуру</h2>
            <p className="mt-1 text-sm text-muted">
              Создастся внутри «{target.parentName}». Что уже есть с таким же
              названием — не задвоится.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold text-muted">
              Вставь сюда из Google Docs
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={fromClipboard}
              rows={5}
              placeholder="Ctrl+V — заголовки и отступы читаются сами. Можно и просто набрать список с отступами."
              className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface-2 p-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={fromText}
              disabled={!text.trim()}
              className="mt-1.5 text-[12px] text-faint transition hover:text-accent disabled:opacity-40"
            >
              разобрать набранное
            </button>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-muted">Или брось скриншот</p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                fromImage(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "mt-1.5 flex h-[122px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 text-center transition",
                over ? "border-accent bg-accent-soft" : "border-line bg-surface-2",
              )}
            >
              <IconPlus className="h-5 w-5 text-faint" />
              <p className="text-[12px] text-muted">Перетащи картинку или нажми</p>
              <p className="text-[11px] text-faint">
                Читает vision-модель — нужен ключ в .env
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                fromImage(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}
        {!error && note && <p className="mt-3 text-[12px] text-faint">{note}</p>}

        {nodes && nodes.length > 0 && (
          <>
            <div className="mt-4 max-h-[46vh] overflow-y-auto rounded-xl bg-surface-2 p-3">
              {nodes.map((n, i) => row(n, [i]))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Создаю…" : `Создать (${total})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNodes(null);
                  setNote(null);
                  setText("");
                }}
                className="text-sm text-faint transition hover:text-content"
              >
                Сбросить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
