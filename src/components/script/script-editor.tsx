"use client";

/**
 * Поле для скрипта урока.
 *
 * Форматирование делает сам браузер: поле редактируемое, кнопки просто
 * дают ему команды. Так не нужен сторонний редактор, а вставка из
 * документа приходит уже размеченной — её потом чистит сервер.
 *
 * Сохранение само: учитель пишет, а не жмёт кнопки. Явная кнопка всё
 * равно есть — чтобы было видно, что всё цело.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteScriptPresetAction,
  listScriptPresetsAction,
  saveScriptAction,
  saveScriptPresetAction,
  type ScriptDoc,
  type ScriptPreset,
} from "@/lib/actions/script";
import type { ScriptStyle } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const FONTS = [
  { label: "Обычный", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Comic", value: "'Comic Sans MS', 'Segoe UI', cursive" },
];

const SIZES = [12, 14, 16, 18, 20, 24, 28];

const COLORS = [
  "#1b2733", "#e11d48", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#4f46e5", "#9333ea",
];

/** Фоны подобраны так, чтобы тёмный текст читался на любом. */
const BACKGROUNDS = [
  { label: "Без фона", value: "" },
  { label: "Бумага", value: "#fffdf5" },
  { label: "Мята", value: "#f0fdf6" },
  { label: "Небо", value: "#f0f7ff" },
  { label: "Роза", value: "#fff5f7" },
  { label: "Песок", value: "#fbf6ef" },
];

const AUTOSAVE_MS = 1500;

export function ScriptEditor({
  doc,
  compact = false,
  onSaved,
}: {
  doc: ScriptDoc;
  /** В классе места меньше: панель стилей прячется под кнопку. */
  compact?: boolean;
  onSaved?: (savedAt: string) => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<ScriptStyle>(doc.style ?? {});
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(doc.updatedAt);
  const [showStyle, setShowStyle] = useState(!compact);

  /**
   * Заготовки: план, который повторяется от урока к уроку. Хранятся в
   * базе, поэтому переживают и чистку браузера, и другой компьютер.
   */
  const [presets, setPresets] = useState<ScriptPreset[] | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    if (!showPresets || presets) return;
    let alive = true;
    listScriptPresetsAction()
      .then((rows) => alive && setPresets(rows))
      .catch(() => alive && setPresets([]));
    return () => {
      alive = false;
    };
  }, [showPresets, presets]);

  /** Заготовка кладётся в поле как есть — дальше её правят под урок. */
  function loadPreset(preset: ScriptPreset) {
    if (area.current) area.current.innerHTML = preset.html;
    setStyle(preset.style ?? {});
    setDirty(true);
    setShowPresets(false);
  }

  function storePreset() {
    const name = presetName.trim();
    if (!name) return;
    const html = area.current?.innerHTML ?? "";
    startSave(async () => {
      const res = await saveScriptPresetAction(name, html, style);
      if (res.error) return;
      setPresetName("");
      setPresets(await listScriptPresetsAction());
    });
  }

  function dropPreset(id: string) {
    startSave(async () => {
      await deleteScriptPresetAction(id);
      setPresets(await listScriptPresetsAction());
    });
  }
  const [busy, startSave] = useTransition();

  // Текст кладём в поле один раз: дальше им владеет браузер, и перезапись
  // на каждый рендер сбивала бы курсор. Смену урока ловит key у родителя —
  // поле пересоздаётся вместе с состоянием.
  useEffect(() => {
    if (area.current) area.current.innerHTML = doc.html;
  }, [doc.html]);

  function save() {
    const html = area.current?.innerHTML ?? "";
    startSave(async () => {
      const res = await saveScriptAction(doc.lessonId, html, style);
      if (res.savedAt) {
        setSavedAt(res.savedAt);
        setDirty(false);
        onSaved?.(res.savedAt);
      }
    });
  }

  // Отложенное сохранение зовёт всегда свежую функцию, но сама ссылка
  // меняется вне рендера: иначе таймер перезапускался бы на каждый ввод.
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });

  // Пишем — ждём паузу — сохраняем. Учитель про это не думает.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => latestSave.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, style]);

  /** Команда форматирования уходит браузеру: он знает про выделение. */
  function run(command: string, value?: string) {
    area.current?.focus();
    document.execCommand(command, false, value);
    setDirty(true);
  }

  const btn = (label: React.ReactNode, command: string, value?: string, title?: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(command, value)}
      className="flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-content"
    >
      {label}
    </button>
  );

  const select =
    "h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-content outline-none transition focus:border-accent";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Панель форматирования */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface p-1.5 ring-1 ring-line">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) run("formatBlock", e.target.value);
            e.target.value = "";
          }}
          className={select}
        >
          <option value="">Заголовок</option>
          <option value="h2">Крупный</option>
          <option value="h3">Средний</option>
          <option value="h4">Мелкий</option>
          <option value="p">Обычный текст</option>
        </select>

        {btn(<b>Ж</b>, "bold", undefined, "Жирный")}
        {btn(<i>К</i>, "italic", undefined, "Курсив")}
        {btn(<u>П</u>, "underline", undefined, "Подчёркнутый")}
        {btn(<s>З</s>, "strikeThrough", undefined, "Зачёркнутый")}

        <span className="mx-1 h-5 w-px bg-line" />

        {btn("•", "insertUnorderedList", undefined, "Список")}
        {btn("1.", "insertOrderedList", undefined, "Нумерованный список")}

        <span className="mx-1 h-5 w-px bg-line" />

        {btn("⟵", "justifyLeft", undefined, "По левому краю")}
        {btn("⟷", "justifyCenter", undefined, "По центру")}
        {btn("⟶", "justifyRight", undefined, "По правому краю")}

        <span className="mx-1 h-5 w-px bg-line" />

        {btn("✕", "removeFormat", undefined, "Убрать оформление")}

        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className={cn(
            "ml-auto h-8 rounded-lg px-2.5 text-[12px] font-semibold transition",
            showPresets ? "bg-accent text-white" : "text-muted hover:bg-surface-2",
          )}
        >
          Заготовки
        </button>

        <button
          type="button"
          onClick={() => setShowStyle((v) => !v)}
          className={cn(
            "h-8 rounded-lg px-2.5 text-[12px] font-semibold transition",
            showStyle ? "bg-accent text-white" : "text-muted hover:bg-surface-2",
          )}
        >
          Стиль
        </button>
      </div>

      {showPresets && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-2 ring-1 ring-line">
          {presets === null && <p className="px-1 text-[12px] text-faint">Загружаю…</p>}

          {presets?.length === 0 && (
            <p className="px-1 text-[12px] text-faint">
              Заготовок нет. Разметь скрипт как надо и сохрани — он пригодится
              на следующем уроке.
            </p>
          )}

          {presets?.map((preset) => (
            <div key={preset.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => loadPreset(preset)}
                title="Подставить в этот урок"
                className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[13px] text-content transition hover:bg-surface-2"
              >
                {preset.name}
              </button>
              <button
                type="button"
                onClick={() => dropPreset(preset.id)}
                title="Удалить заготовку"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-rose-500"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex items-center gap-1 border-t border-line pt-1.5">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && storePreset()}
              placeholder="Название заготовки"
              disabled={(presets?.length ?? 0) >= 5}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-content outline-none focus:border-accent disabled:opacity-50"
            />
            <button
              type="button"
              onClick={storePreset}
              disabled={!presetName.trim() || (presets?.length ?? 0) >= 5}
              title={
                (presets?.length ?? 0) >= 5
                  ? "Заготовок уже пять — удали лишнюю"
                  : "Запомнить нынешний скрипт"
              }
              className="h-8 shrink-0 rounded-lg bg-accent px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Сохранить как заготовку
            </button>
          </div>
        </div>
      )}

      {/* Стиль страницы: шрифт, размер, цвет, фон */}
      {showStyle && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-2 ring-1 ring-line">
          <select
            value={style.font ?? ""}
            onChange={(e) => {
              setStyle({ ...style, font: e.target.value });
              setDirty(true);
            }}
            className={select}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            value={String(style.size ?? 16)}
            onChange={(e) => {
              setStyle({ ...style, size: Number(e.target.value) });
              setDirty(true);
            }}
            className={select}
          >
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>

          <span className="flex items-center gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title="Цвет выделенного текста"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run("foreColor", color)}
                style={{ background: color }}
                className="h-5 w-5 rounded-full ring-1 ring-line transition hover:scale-110"
              />
            ))}
          </span>

          <select
            value={style.background ?? ""}
            onChange={(e) => {
              setStyle({ ...style, background: e.target.value });
              setDirty(true);
            }}
            className={select}
          >
            {BACKGROUNDS.map((b) => (
              <option key={b.label} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-[11px] text-faint">
            {busy
              ? "Сохраняю…"
              : dirty
                ? "Есть несохранённое"
                : savedAt
                  ? `Сохранено ${new Date(savedAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`
                  : "Пока пусто"}
          </span>

          <button
            type="button"
            onClick={() => latestSave.current()}
            disabled={busy}
            className="h-8 rounded-lg bg-accent px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      )}

      {/* Само поле */}
      <div
        ref={area}
        contentEditable
        suppressContentEditableWarning
        onInput={() => setDirty(true)}
        onBlur={() => dirty && latestSave.current()}
        role="textbox"
        aria-multiline="true"
        aria-label="Скрипт урока"
        style={{
          fontFamily: style.font || undefined,
          fontSize: style.size ? `${style.size}px` : undefined,
          background: style.background || undefined,
        }}
        className={cn(
          "script-area min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line p-4 text-content outline-none transition focus:border-accent",
          !style.background && "bg-surface",
          compact ? "min-h-[220px]" : "min-h-[50vh]",
        )}
      />
    </div>
  );
}
