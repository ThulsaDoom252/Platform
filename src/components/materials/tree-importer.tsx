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
import Script from "next/script";
import {
  parseTree,
  countNodes,
  mergeImportTrees,
  type ImportNode,
} from "@/lib/tree-import";
import { googleDocumentId, readGoogleDocumentTabs } from "@/lib/google-docs-tabs";
import { importTreeAction } from "@/lib/actions/materials";
import { readTreeImageAction } from "@/lib/actions/tree-image";
import { readTreeLinkAction } from "@/lib/actions/tree-link";
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

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (config?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

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
  const [links, setLinks] = useState<string[]>([""]);
  const [over, setOver] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [busy, startBusy] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!target) return null;

  function show(
    found: ImportNode[],
    flat: boolean,
    from: string,
    truncated = false,
    detail = "",
  ) {
    if (found.length === 0) {
      setNodes(null);
      setError(`${from}: структура не распозналась.`);
      return;
    }
    setError(null);
    setNodes(found);

    const head = `${from}: ${countNodes(found)} уникальных узлов.`;
    // Про обрезку молчать нельзя: дерево выглядит целым, а конца у него нет.
    if (truncated) {
      setNote(
        `${head} Один из документов упёрся в потолок вкладок — его остаток не доехал.${detail ? ` ${detail}` : ""}`,
      );
      return;
    }
    setNote(
      flat
        ? `${head} Все на одном уровне — вложенность не считалась. Вставь с форматированием или поправь вручную.${detail ? ` ${detail}` : ""}`
        : `${head}${detail ? ` ${detail}` : ""}`,
    );
  }

  /** Пустые и повторно добавленные ссылки не запрашиваем второй раз. */
  function documentLinks(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of links) {
      const url = value.trim();
      if (!url) continue;
      const key = googleDocumentId(url) ?? url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(url);
    }
    return out;
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

  function fromLink() {
    const urls = documentLinks();
    if (urls.length === 0) return;

    setError(null);
    setNote(`Скачиваю документы: 0 из ${urls.length}…`);

    startBusy(async () => {
      let merged: ImportNode[] = [];
      let succeeded = 0;
      let flatDocuments = 0;
      const failures: string[] = [];

      for (let i = 0; i < urls.length; i++) {
        setNote(`Скачиваю документ ${i + 1} из ${urls.length}…`);
        const res = await readTreeLinkAction(urls[i]);
        if (res.error || !res.html) {
          failures.push(res.error ?? "Не получилось прочитать документ.");
          continue;
        }
        const parsed = parseTree({ html: res.html });
        if (parsed.nodes.length === 0) {
          failures.push("В документе не распозналась структура.");
          continue;
        }
        merged = mergeImportTrees(merged, parsed.nodes);
        succeeded++;
        if (parsed.flat) flatDocuments++;
      }

      if (merged.length === 0) {
        setNodes(null);
        setNote(null);
        setError(failures[0] ?? "Не получилось прочитать документы.");
        return;
      }

      const details = [
        failures.length ? `Не прочитано документов: ${failures.length}.` : "",
        flatDocuments ? `Без вложенности распознано: ${flatDocuments}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      show(
        merged,
        succeeded === 1 && flatDocuments === 1,
        `Объединено документов: ${succeeded}`,
        false,
        details,
      );
    });
  }

  /** Точный путь: Google отдаёт дерево childTabs и iconEmoji через Docs API. */
  function fromGoogleTabs() {
    const urls = documentLinks();
    if (urls.length === 0) return;
    if (!googleClientId) {
      setError("Импорт вкладок ещё не подключён: добавь NEXT_PUBLIC_GOOGLE_CLIENT_ID в .env.");
      return;
    }

    const oauth = window.google?.accounts.oauth2;
    if (!oauth || !googleReady) {
      setError("Подключение Google ещё загружается. Попробуй через пару секунд.");
      return;
    }

    setError(null);
    setNote("Подключаю Google…");
    setGoogleBusy(true);

    const client = oauth.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/documents.readonly",
      callback: async (response) => {
        if (response.error || !response.access_token) {
          setNodes(null);
          setNote(null);
          setError(response.error_description ?? "Google не дал доступ к документу.");
          setGoogleBusy(false);
          return;
        }

        let merged: ImportNode[] = [];
        let succeeded = 0;
        let truncated = false;
        const failures: string[] = [];

        for (let i = 0; i < urls.length; i++) {
          setNote(`Читаю документ ${i + 1} из ${urls.length}…`);
          const result = await readGoogleDocumentTabs(urls[i], response.access_token);
          if (result.error || !result.nodes) {
            failures.push(result.error ?? "Не получилось прочитать вкладки.");
            continue;
          }
          merged = mergeImportTrees(merged, result.nodes);
          succeeded++;
          truncated ||= !!result.truncated;
        }

        if (merged.length === 0) {
          setNodes(null);
          setNote(null);
          setError(failures[0] ?? "Не получилось прочитать документы.");
        } else {
          show(
            merged,
            false,
            `Объединено документов Google: ${succeeded}`,
            truncated,
            failures.length ? `Не прочитано документов: ${failures.length}.` : "",
          );
        }
        setGoogleBusy(false);
      },
      error_callback: (oauthError) => {
        setNote(null);
        setError(
          oauthError.type === "popup_closed"
            ? "Окно Google закрыто — импорт не начался."
            : "Не получилось открыть вход Google.",
        );
        setGoogleBusy(false);
      },
    });

    client.requestAccessToken();
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
      // Часть дерева не влезла — окно не закрываем, иначе учитель решит,
      // что перенеслось всё.
      if (res.truncated) {
        setNodes(null);
        setNote(null);
        setError(
          `Создано ${res.created}, уже было ${res.reused} — но дерево упёрлось в потолок, остальное не завелось. Перенеси остаток отдельно.`,
        );
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
  const anyBusy = busy || googleBusy;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      {googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setGoogleReady(true)}
          onError={() => {
            setGoogleReady(false);
            setError("Не загрузилась авторизация Google.");
          }}
        />
      )}
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

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-muted">
              Документы Google Docs
            </p>
            <button
              type="button"
              onClick={() => setLinks((current) => [...current, ""])}
              disabled={anyBusy}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[11px] font-semibold text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
            >
              <IconPlus className="h-3.5 w-3.5" /> Добавить ссылку
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {links.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-faint">
                  {index + 1}
                </span>
                <input
                  value={value}
                  onChange={(e) =>
                    setLinks((current) =>
                      current.map((item, i) => (i === index ? e.target.value : item)),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fromGoogleTabs();
                    }
                  }}
                  placeholder="https://docs.google.com/document/d/…"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
                />
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLinks((current) => current.filter((_, i) => i !== index))
                    }
                    disabled={anyBusy}
                    title="Убрать эту ссылку"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
            <button
              type="button"
              onClick={fromGoogleTabs}
              disabled={documentLinks().length === 0 || anyBusy || (!!googleClientId && !googleReady)}
              className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {googleBusy ? "Объединяю документы…" : "Импортировать вкладки"}
            </button>
            <button
              type="button"
              onClick={fromLink}
              disabled={documentLinks().length === 0 || anyBusy}
              className="h-10 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-content transition hover:border-accent hover:text-accent disabled:opacity-40"
            >
              Только заголовки
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            <b>Вкладки:</b> деревья всех документов объединятся по одинаковым
            названиям папок. Google запросит доступ только на чтение и ничего не
            изменит.
          </p>
          <p className="mt-1 text-[11px] text-faint">
            <b>Только заголовки:</b> запасной вариант без входа в Google; документ
            должен быть открыт по ссылке, а разделы размечены стилями заголовков.
          </p>
          {!googleClientId && (
            <p className="mt-1 text-[11px] text-amber-500/90">
              Точный импорт станет доступен после настройки Google Client ID в .env.
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold text-muted">
              Или вставь сюда из Google Docs
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
            <p className="text-[12px] font-semibold text-muted">
              Или брось скриншот — в том числе списка вкладок
            </p>
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
                disabled={anyBusy}
                className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {anyBusy ? "Создаю…" : `Создать (${total})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNodes(null);
                  setNote(null);
                  setText("");
                  setLinks([""]);
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
