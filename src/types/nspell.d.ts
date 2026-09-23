/**
 * У nspell и пакетов словарей нет своих типов.
 * Описываем ровно то, чем пользуемся в src/lib/spellcheck.ts.
 */
declare module "nspell" {
  type Dictionary = { aff: Buffer | string; dic: Buffer | string };

  type Speller = {
    correct(word: string): boolean;
    suggest(word: string): string[];
  };

  export default function nspell(dictionary: Dictionary): Speller;
}

declare module "dictionary-en" {
  const dictionary: { aff: Buffer; dic: Buffer };
  export default dictionary;
}

declare module "dictionary-ru" {
  const dictionary: { aff: Buffer; dic: Buffer };
  export default dictionary;
}

declare module "dictionary-uk" {
  const dictionary: { aff: Buffer; dic: Buffer };
  export default dictionary;
}
