export const SEARCH_CATEGORIES = [
  "STUDENTS",
  "MATERIALS",
  "LESSONS",
  "GAMES",
  "TWISTERS",
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export type GlobalSearchItem = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string | null;
  href: string;
  icon: string | null;
};

export type GlobalSearchResponse = {
  items: GlobalSearchItem[];
  error?: string;
};
