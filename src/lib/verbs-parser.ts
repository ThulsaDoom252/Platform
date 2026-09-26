/**
 * Разбор таблиц неправильных глаголов.
 *
 * Из Google Docs они приезжают десятком разных способов: то строка на
 * глагол с табуляциями, то по ячейке на строку, то с транскрипцией
 * отдельной строкой под каждой формой, то вовсе без неё. Ширина таблицы
 * тоже гуляет — от трёх колонок до пяти.
 *
 * Поэтому геометрию таблицы не угадываем. Поток разбивается на ячейки, у
 * каждой определяется роль — форма глагола, транскрипция, перевод или
 * служебная строка, — и запись собирается по смыслу: три английские формы
 * подряд, за ними перевод.
 */

export type IrregularVerb = {
  /** Значок-подсказка из исходника, если он там был. */
  icon: string | null;
  base: string;
  baseIpa: string | null;
  past: string;
  pastIpa: string | null;
  participle: string;
  participleIpa: string | null;
  translation: string | null;
};

export type VerbsParseResult = {
  verbs: IrregularVerb[];
  /** Заголовок таблицы — им удобно назвать категорию. */
  title: string | null;
  warnings: string[];
};

/** Транскрипция: /baɪ/ или несколько через слэш. */
const IPA = /^\/[^/]+\/(?:\s*\/[^/]+\/)*$/u;

/** Шапка таблицы и прочие служебные подписи. */
const SERVICE =
  /^(v[123]\b|base\b|form\b|past\b|simple\b|participle\b|ua\b|ru\b|переклад|перевод|значення)/i;

/** Строки-подсказки, которые к глаголам не относятся. */
const HINT =
  /(натисни|нажми|произношение|вимов|oxford|посилання|dictionaries|irregular verbs|неправильн)/i;

const SPEAKER = /[🔊🔈🔉🕪]/gu;

/** Один значок целиком — с селекторами начертания и склейками. */
const EMOJI =
  /^(?:\p{Extended_Pictographic}(?:️|︎|\p{Emoji_Modifier})*(?:‍\p{Extended_Pictographic}️?)*|\p{Regional_Indicator}{2})/u;

const hasLatin = (s: string) => /[A-Za-z]/.test(s);
const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

const tidy = (s: string) => s.replace(/\s+/gu, " ").trim();

/** Снимает ведущие значки, отдавая первый смысловой отдельно. */
function takeIcon(raw: string): { icon: string | null; rest: string } {
  let rest = raw.replace(SPEAKER, " ").trim();
  let icon: string | null = null;

  for (;;) {
    const m = rest.match(EMOJI);
    if (!m) break;
    if (!icon) icon = m[0];
    rest = rest.slice(m[0].length).trim();
  }

  return { icon, rest: tidy(rest) };
}

type Cell =
  | { kind: "form"; text: string; ipa: string | null; icon: string | null }
  | { kind: "ipa"; text: string }
  | { kind: "translation"; text: string }
  | { kind: "skip" };

/**
 * Перечисление вроде «smell · burn · bend · spoil» — это оглавление
 * подборки, а не форма глагола.
 */
function looksLikeIndex(s: string): boolean {
  return (s.match(/·/g) ?? []).length >= 2;
}

function classify(raw: string): Cell {
  const { icon, rest } = takeIcon(raw);
  const s = tidy(rest);
  if (!s) return { kind: "skip" };

  if (IPA.test(s)) return { kind: "ipa", text: s };
  if (SERVICE.test(s) || HINT.test(s) || looksLikeIndex(s)) return { kind: "skip" };
  // «GROUP 2 — frozen / spoken / broken (vowel change…)» — это название
  // подборки. Сама форма глагола короткая, даже с вариантами через слэш.
  if (/^group\b/i.test(s) || s.length > 40) return { kind: "skip" };

  if (hasLatin(s)) {
    // Форма и транскрипция в одной ячейке: «buy /baɪ/».
    const at = s.indexOf("/");
    if (at > 0 && IPA.test(s.slice(at))) {
      return { kind: "form", text: tidy(s.slice(0, at)), ipa: tidy(s.slice(at)), icon };
    }
    return { kind: "form", text: s, ipa: null, icon };
  }

  if (hasCyrillic(s)) return { kind: "translation", text: s };
  return { kind: "skip" };
}

/** Заголовок подборки: первая непустая строка, если она не про глаголы. */
function findTitle(lines: string[]): string | null {
  for (const line of lines) {
    const s = tidy(line.replace(SPEAKER, " "));
    if (!s) continue;
    if (HINT.test(s) && !/group/i.test(s)) continue;
    if (looksLikeIndex(s)) continue;
    // «GROUP 2 — frozen / spoken / broken (vowel change…)»
    if (/^group\b/i.test(s)) return s;
    return null;
  }
  return null;
}

/** Разбирает вставленный текст в список глаголов. */
export function parseIrregularVerbs(raw: string): VerbsParseResult {
  const warnings: string[] = [];
  const lines = String(raw ?? "").split(/\r?\n/);

  const cells: Cell[] = [];
  for (const line of lines) {
    const parts = line.includes("\t") ? line.split("\t") : [line];
    for (const part of parts) cells.push(classify(part));
  }

  const verbs: IrregularVerb[] = [];
  let forms: { text: string; ipa: string | null; icon: string | null }[] = [];

  for (const cell of cells) {
    if (cell.kind === "skip") continue;

    if (cell.kind === "ipa") {
      // Транскрипция отдельной строкой относится к последней форме.
      const last = forms[forms.length - 1];
      if (last && !last.ipa) last.ipa = cell.text;
      continue;
    }

    if (cell.kind === "form") {
      // Четвёртая форма подряд — значит, перевода у прошлой записи не было.
      if (forms.length === 3) {
        verbs.push(assemble(forms, null));
        forms = [];
      }
      forms.push({ text: cell.text, ipa: cell.ipa, icon: cell.icon });
      continue;
    }

    // Перевод закрывает запись — но только если формы уже набраны.
    if (forms.length === 3) {
      verbs.push(assemble(forms, cell.text));
      forms = [];
    } else if (forms.length > 0) {
      warnings.push(`«${forms[0].text}»: нашлось ${forms.length} формы из трёх`);
      forms = [];
    }
  }

  if (forms.length === 3) verbs.push(assemble(forms, null));
  else if (forms.length > 0) {
    warnings.push(`«${forms[0].text}»: нашлось ${forms.length} формы из трёх`);
  }

  if (verbs.length === 0) warnings.push("Не нашлось ни одного глагола.");

  return { verbs, title: findTitle(lines), warnings };
}

function assemble(
  forms: { text: string; ipa: string | null; icon: string | null }[],
  translation: string | null,
): IrregularVerb {
  const [v1, v2, v3] = forms;
  return {
    icon: v1.icon ?? v2.icon ?? v3.icon ?? null,
    base: v1.text,
    baseIpa: v1.ipa,
    past: v2.text,
    pastIpa: v2.ipa,
    participle: v3.text,
    participleIpa: v3.ipa,
    translation,
  };
}
