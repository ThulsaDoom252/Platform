import "server-only";

/**
 * Транскрипция английского слова из словаря CMU.
 *
 * Словарь локальный: 135 тысяч слов, никаких запросов наружу. Лежит он
 * только на сервере — в браузер эти три мегабайта не уезжают, страница
 * обращается за транскрипцией серверным действием.
 *
 * CMU хранит произношение в ARPAbet, поэтому переводим его в IPA.
 */

/** ARPAbet → IPA. Гласные помечены, чтобы знать, куда ставить ударение. */
const VOWELS: Record<string, string> = {
  AA: "ɑ",
  AE: "æ",
  AH: "ʌ",
  AO: "ɔ",
  AW: "aʊ",
  AY: "aɪ",
  EH: "ɛ",
  ER: "ɜr",
  EY: "eɪ",
  IH: "ɪ",
  IY: "iː",
  OW: "oʊ",
  OY: "ɔɪ",
  UH: "ʊ",
  UW: "uː",
};

const CONSONANTS: Record<string, string> = {
  B: "b",
  CH: "tʃ",
  D: "d",
  DH: "ð",
  F: "f",
  G: "ɡ",
  HH: "h",
  JH: "dʒ",
  K: "k",
  L: "l",
  M: "m",
  N: "n",
  NG: "ŋ",
  P: "p",
  R: "r",
  S: "s",
  SH: "ʃ",
  T: "t",
  TH: "θ",
  V: "v",
  W: "w",
  Y: "j",
  Z: "z",
  ZH: "ʒ",
};

type Sound = { ipa: string; vowel: boolean; stress: number };

function toSounds(arpabet: string): Sound[] {
  const out: Sound[] = [];

  for (const raw of arpabet.split(/\s+/)) {
    const stress = Number(raw.match(/\d$/)?.[0] ?? -1);
    const key = raw.replace(/\d$/, "");

    if (key in VOWELS) {
      // Без ударения гласные ослабевают: AH и ER дают шву,
      // а долгие IY и UW теряют долготу («accidentally» — …liː → …li).
      const weak: Record<string, string> = { AH: "ə", ER: "ər", IY: "i", UW: "u" };
      const ipa = stress === 0 && key in weak ? weak[key] : VOWELS[key];
      out.push({ ipa, vowel: true, stress: Math.max(0, stress) });
    } else if (key in CONSONANTS) {
      out.push({ ipa: CONSONANTS[key], vowel: false, stress: 0 });
    }
  }
  return out;
}

const LIQUIDS = new Set(["l", "r", "w", "j"]);
const STOPS = new Set(["p", "t", "k"]);

/**
 * Сколько согласных перед ударной гласной относятся к её слогу.
 * В «umbrella» это «br», а не «mbr»: «m» закрывает предыдущий слог.
 */
function onsetSize(cluster: string[]): number {
  if (cluster.length >= 3) {
    const [a, b, c] = cluster.slice(-3);
    if (a === "s" && STOPS.has(b) && LIQUIDS.has(c)) return 3;
  }
  if (cluster.length >= 2) {
    const [a, b] = cluster.slice(-2);
    if (LIQUIDS.has(b) || a === "s") return 2;
  }
  return Math.min(1, cluster.length);
}

/** Ударение ставится перед слогом, а не перед гласной. */
function render(sounds: Sound[]): string {
  const marks = new Map<number, string>();
  const multi = sounds.filter((s) => s.vowel).length > 1;

  sounds.forEach((s, i) => {
    if (!s.vowel || s.stress === 0) return;
    if (!multi) return; // в односложном слове ударение не отмечают

    const cluster: string[] = [];
    let at = i;
    while (at > 0 && !sounds[at - 1].vowel) {
      cluster.unshift(sounds[at - 1].ipa);
      at--;
    }

    marks.set(i - onsetSize(cluster), s.stress === 1 ? "ˈ" : "ˌ");
  });

  return sounds.map((s, i) => (marks.get(i) ?? "") + s.ipa).join("");
}

/** «cook (noun)», «to fit» → то, что можно найти в словаре. */
function normalize(phrase: string): string {
  return phrase
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*to\s+/i, "")
    .replace(/[^A-Za-z'\- ]/g, " ")
    .trim()
    .toLowerCase();
}

/** Транскрипция слова или короткой фразы. null — если слова нет в словаре. */
export async function transcribe(phrase: string): Promise<string | null> {
  const clean = normalize(phrase);
  if (!clean) return null;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return null;

  const { dictionary } = await import("cmu-pronouncing-dictionary");

  const parts: string[] = [];
  for (const w of words) {
    const arpabet = (dictionary as Record<string, string>)[w];
    if (!arpabet) return null;
    parts.push(render(toSounds(arpabet)));
  }

  return `/${parts.join(" ")}/`;
}
