export type SeedExample = { en: string; tr: string };

export type SeedPhrase = {
  icon?: string;
  /** Заголовок секции внутри страницы */
  section?: string;
  /** NOTE — пояснительная заметка вместо обычной записи */
  kind?: "NOTE";
  phrase: string;
  transcription?: string;
  translation: string;
  examples?: SeedExample[];
};

export type SeedPage = {
  name: string;
  icon: string;
  description: string;
  phrases: SeedPhrase[];
};
