/** Fixed library taxonomy: no database writes are needed just to browse folders. */
export const TEST_LEVELS = [
  { id: "a1", label: "A1" },
  { id: "a2", label: "A2" },
  { id: "b1", label: "B1" },
  { id: "b1-plus", label: "B1+" },
  { id: "b2", label: "B2" },
  { id: "c1", label: "C1" },
] as const;

export const TEST_CATEGORIES = [
  "grammar", "vocabulary", "listening", "reading", "use-of-english", "writing", "exams",
] as const;

export type TestLevelId = (typeof TEST_LEVELS)[number]["id"];
export type TestCategoryId = (typeof TEST_CATEGORIES)[number];
export type TestLibraryLocation = { level: TestLevelId | null; category: TestCategoryId | null };

export function parseTestLibraryLocation(params: Pick<URLSearchParams, "get">): TestLibraryLocation {
  const level = TEST_LEVELS.find((item) => item.id === params.get("level"))?.id ?? null;
  const rawCategory = params.get("category");
  const category = level && TEST_CATEGORIES.find((item) => item === rawCategory) || null;
  return { level, category };
}

export function testLibraryHref(level: TestLevelId | null = null, category: TestCategoryId | null = null) {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (level && category) params.set("category", category);
  const query = params.toString();
  return `/teacher/tests${query ? `?${query}` : ""}`;
}
