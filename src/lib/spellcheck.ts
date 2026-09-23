import "server-only";

/**
 * Проверка орфографии в названиях папок и страниц.
 *
 * Словари английского, русского и украинского весят вместе около 12 МБ,
 * поэтому лежат только на сервере и подгружаются при первой проверке.
 * Язык слова определяем по алфавиту: латиница — английский, кириллица —
 * русский или украинский, а между ними выбираем по характерным буквам
 * и по тому, какой словарь слово признал.
 */
import type nspellType from "nspell";

export type Misspelling = {
  /** Слово как оно написано. */
  word: string;
  /** Позиция в исходной строке — по ней подчёркиваем. */
  start: number;
  end: number;
  /** Варианты замены, не больше пяти. */
  suggestions: string[];
};

type Lang = "en" | "ru" | "uk";
type Speller = ReturnType<typeof nspellType>;

const spellers = new Map<Lang, Promise<Speller | null>>();

/**
 * Файлы словаря читаем сами.
 *
 * Пакеты dictionary-* открывают свои .aff и .dic по пути, вычисленному
 * из import.meta.url, а сборщик Next его подменяет — импорт падает.
 * Читать два файла напрямую надёжнее и не зависит от сборки.
 */
async function loadDictionary(lang: Lang) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const dir = join(process.cwd(), "node_modules", `dictionary-${lang}`);
  const [aff, dic] = await Promise.all([
    readFile(join(dir, "index.aff")),
    readFile(join(dir, "index.dic")),
  ]);
  return { aff, dic };
}

async function load(lang: Lang): Promise<Speller | null> {
  if (!spellers.has(lang)) {
    spellers.set(
      lang,
      (async () => {
        try {
          // Сборщик заворачивает CommonJS по-разному: берём то, что оказалось функцией.
          const mod = (await import("nspell")) as unknown as Record<string, unknown>;
          const make = (typeof mod.default === "function" ? mod.default : mod) as (
            d: unknown,
          ) => Speller;

          return make(await loadDictionary(lang));
        } catch (e) {
          console.error(`Словарь ${lang} не загрузился:`, e);
          return null;
        }
      })(),
    );
  }
  return spellers.get(lang)!;
}

/** Украинские буквы, которых нет в русском, и наоборот. */
const UK_ONLY = /[їієґ]/i;
const RU_ONLY = /[ёъыэ]/i;

function guessLang(word: string): Lang | null {
  if (/^[A-Za-z'’-]+$/.test(word)) return "en";
  if (!/[Ѐ-ӿ]/.test(word)) return null;
  if (UK_ONLY.test(word)) return "uk";
  if (RU_ONLY.test(word)) return "ru";
  return null; // кириллица без явных примет — решаем по словарям
}

/**
 * Разбирает строку на слова с их позициями.
 * Цифры, знаки и слова короче трёх букв не проверяем: в названиях
 * полно сокращений вроде «B1» и «IT», ругаться на них незачем.
 */
function words(text: string): { word: string; start: number }[] {
  const out: { word: string; start: number }[] = [];
  const re = /[\p{L}][\p{L}'’-]*/gu;

  for (const m of text.matchAll(re)) {
    const word = m[0];
    if (word.length < 3) continue;
    if (/\d/.test(word)) continue;
    out.push({ word, start: m.index });
  }
  return out;
}

async function known(lang: Lang, word: string): Promise<boolean> {
  const s = await load(lang);
  if (!s) return true; // словарь не загрузился — молчим, а не ругаемся
  return s.correct(word) || s.correct(word.toLowerCase());
}

/** Проверить название. Пустой список — ошибок нет. */
export async function checkSpelling(text: string): Promise<Misspelling[]> {
  const found: Misspelling[] = [];

  for (const { word, start } of words(text.slice(0, 300))) {
    const lang = guessLang(word);
    const tryLangs: Lang[] =
      lang === null
        ? /[Ѐ-ӿ]/.test(word)
          ? ["ru", "uk"] // кириллица без примет: подходит любой из двух
          : []
        : [lang];

    if (tryLangs.length === 0) continue;

    let ok = false;
    for (const l of tryLangs) {
      if (await known(l, word)) {
        ok = true;
        break;
      }
    }
    if (ok) continue;

    const speller = await load(tryLangs[0]);
    found.push({
      word,
      start,
      end: start + word.length,
      suggestions: (speller?.suggest(word) ?? []).slice(0, 5),
    });
  }

  return found;
}
