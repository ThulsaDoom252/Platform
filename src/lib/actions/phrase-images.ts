"use server";

/**
 * Картинки к словам словника.
 *
 * Поиск идёт в Pixabay: у него есть не только фото, но и рисунки, а для
 * словаря это важнее качества снимка — «вилку» или «чихать» рисунок
 * показывает понятнее, чем художественная фотография.
 *
 * Подборка видна только учителю. Ученик увидит картинку лишь в игре, и
 * лишь ту, которую учитель выбрал.
 */
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { materialNodes, materialPhrases, phraseImages } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  imageQuery,
  looksLikeText,
  pickCandidates,
  type ImageCandidate,
} from "@/lib/image-query";
import {
  removeStoredImage,
  storeRemoteImage,
  storeUploadedImage,
  type StoreFailure,
} from "@/lib/image-store";

export type PhraseImage = {
  id: string;
  url: string;
  thumbUrl: string | null;
  origin: string;
  picked: boolean;
};

export type PhraseWithImages = {
  phraseId: string;
  phrase: string;
  translation: string | null;
  /** Запрос, которым её будут искать — учителю видно, что уйдёт в поиск. */
  query: string;
  images: PhraseImage[];
};

export type ImagesState = { ok?: boolean; error?: string; found?: number };

/** Сколько вариантов держим на слово. */
const PER_PHRASE = 3;

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

type PixabayHit = {
  webformatURL?: string;
  largeImageURL?: string;
  previewURL?: string;
  tags?: string;
  downloads?: number;
  likes?: number;
};

/**
 * Один запрос в Pixabay.
 *
 * Ошибку сети наверх не бросаем: подборка для двадцати слов не должна
 * разваливаться целиком из-за одного неудачного запроса.
 */
async function searchPixabay(query: string, perPage = 20): Promise<ImageCandidate[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key || !query) return [];

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "all");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", String(Math.min(200, Math.max(3, perPage))));
  url.searchParams.set("lang", "en");

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { hits?: PixabayHit[] };

    return (data.hits ?? []).flatMap((hit) => {
      const full = hit.webformatURL ?? hit.largeImageURL;
      if (!full) return [];
      return [
        {
          url: full,
          thumbUrl: hit.previewURL ?? full,
          tags: hit.tags ?? "",
          popularity: (hit.downloads ?? 0) + (hit.likes ?? 0) * 10,
        },
      ];
    });
  } catch {
    return [];
  }
}

export type FoundImage = { url: string; thumbUrl: string; tags: string };

/**
 * Поиск по любому запросу, который набрал учитель.
 *
 * Ничего не сохраняет: это витрина, из которой он выбирает. Автоподбор
 * угадывает не всегда — «to have» или идиому проще найти своими словами,
 * и тогда нужен не один вариант из трёх, а целая полка.
 */
export async function searchImagesAction(query: string): Promise<FoundImage[]> {
  await requireTeacher();

  const text = String(query ?? "").trim().slice(0, 100);
  if (!text) return [];
  if (!process.env.PIXABAY_API_KEY) return [];

  const found = await searchPixabay(text, 30);
  // Надписи и здесь ни к чему, но порядок оставляем поисковый: учитель
  // смотрит глазами, и перетасовывать выдачу под него не надо.
  return found
    .filter((item) => !looksLikeText(item.tags))
    .map((item) => ({ url: item.url, thumbUrl: item.thumbUrl, tags: item.tags }));
}

/** Есть ли ключ — страница по этому решает, показывать ли кнопку поиска. */
export async function imageSearchReadyAction(): Promise<boolean> {
  await requireTeacher();
  return Boolean(process.env.PIXABAY_API_KEY);
}

/** Слова словника вместе с их подборками. */
export async function listNodeImagesAction(
  nodeId: string,
): Promise<PhraseWithImages[]> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return [];

  const phrases = await db
    .select({
      id: materialPhrases.id,
      phrase: materialPhrases.phrase,
      translation: materialPhrases.translation,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, id))
    .orderBy(asc(materialPhrases.sortOrder));

  // Заметки 💡 — не слова, играть по ним нечего.
  const words = phrases.filter((p) => p.kind !== "NOTE");
  if (words.length === 0) return [];

  const images = await db
    .select()
    .from(phraseImages)
    .where(inArray(phraseImages.phraseId, words.map((w) => w.id)))
    .orderBy(asc(phraseImages.sortOrder));

  const byPhrase = new Map<string, PhraseImage[]>();
  for (const row of images) {
    const list = byPhrase.get(row.phraseId) ?? [];
    list.push({
      id: row.id,
      url: row.url,
      thumbUrl: row.thumbUrl,
      origin: row.origin,
      picked: row.picked,
    });
    byPhrase.set(row.phraseId, list);
  }

  return words.map((w) => ({
    phraseId: w.id,
    phrase: w.phrase,
    translation: w.translation,
    query: imageQuery(w.phrase),
    images: byPhrase.get(w.id) ?? [],
  }));
}

/** Подобрать картинки одному слову, заменив прежний поиск. */
export async function searchPhraseImagesAction(
  phraseId: string,
): Promise<ImagesState> {
  await requireTeacher();
  const id = String(phraseId ?? "");
  if (!id) return { error: "Не выбрано слово" };

  if (!process.env.PIXABAY_API_KEY) {
    return { error: "PIXABAY_API_KEY не задан в .env" };
  }

  const [phrase] = await db
    .select({ phrase: materialPhrases.phrase, nodeId: materialPhrases.nodeId })
    .from(materialPhrases)
    .where(eq(materialPhrases.id, id))
    .limit(1);
  if (!phrase) return { error: "Слово не найдено" };

  const found = await searchAndStore(id, phrase.phrase);
  revalidatePath(`/teacher/materials`);
  return { ok: true, found };
}

/**
 * Подобрать картинки всему словнику.
 *
 * Уже найденное не трогаем: искать заново то, что учитель уже отобрал
 * руками, — значит стереть его работу. Поэтому идём только по словам
 * без картинок.
 */
export async function searchNodeImagesAction(nodeId: string): Promise<ImagesState> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return { error: "Не выбран словник" };

  if (!process.env.PIXABAY_API_KEY) {
    return { error: "PIXABAY_API_KEY не задан в .env" };
  }

  const phrases = await db
    .select({
      id: materialPhrases.id,
      phrase: materialPhrases.phrase,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, id))
    .orderBy(asc(materialPhrases.sortOrder));

  const words = phrases.filter((p) => p.kind !== "NOTE");
  if (words.length === 0) return { ok: true, found: 0 };

  const existing = await db
    .select({ phraseId: phraseImages.phraseId })
    .from(phraseImages)
    .where(inArray(phraseImages.phraseId, words.map((w) => w.id)));
  const done = new Set(existing.map((row) => row.phraseId));

  let found = 0;
  for (const word of words) {
    if (done.has(word.id)) continue;
    found += await searchAndStore(word.id, word.phrase);
  }

  revalidatePath(`/teacher/materials`);
  return { ok: true, found };
}

/** Поиск и запись трёх вариантов. Первый сразу помечается выбранным. */
async function searchAndStore(phraseId: string, phrase: string): Promise<number> {
  const query = imageQuery(phrase);
  if (!query) return 0;

  const picked = pickCandidates(await searchPixabay(query), PER_PHRASE, query);
  if (picked.length === 0) return 0;

  // Ручные картинки — работа учителя, их поиск перезаписывать не должен.
  await db
    .delete(phraseImages)
    .where(
      and(eq(phraseImages.phraseId, phraseId), eq(phraseImages.origin, "pixabay")),
    );

  const [manual] = await db
    .select({ id: phraseImages.id })
    .from(phraseImages)
    .where(and(eq(phraseImages.phraseId, phraseId), eq(phraseImages.picked, true)))
    .limit(1);

  await db.insert(phraseImages).values(
    picked.map((candidate, i) => ({
      phraseId,
      url: candidate.url,
      thumbUrl: candidate.thumbUrl,
      origin: "pixabay",
      sortOrder: i,
      // Если выбор уже сделан руками, его не перебиваем.
      picked: !manual && i === 0,
    })),
  );

  return picked.length;
}

/** Выбрать картинку, которая пойдёт в игру. */
export async function pickPhraseImageAction(imageId: string): Promise<ImagesState> {
  await requireTeacher();
  const id = String(imageId ?? "");
  if (!id) return { error: "Не выбрана картинка" };

  const [image] = await db
    .select({ phraseId: phraseImages.phraseId, url: phraseImages.url })
    .from(phraseImages)
    .where(eq(phraseImages.id, id))
    .limit(1);
  if (!image) return { error: "Картинка не найдена" };

  await db
    .update(phraseImages)
    .set({ picked: false })
    .where(eq(phraseImages.phraseId, image.phraseId));

  /*
   * Выбранная картинка переезжает к нам. Остальные остаются ссылками:
   * они только витрина, а эта пойдёт в игру, и пропасть посреди урока
   * из-за чужого сайта не должна.
   */
  const stored = await storeRemoteImage(image.url);

  await db
    .update(phraseImages)
    .set(stored ? { picked: true, url: stored, thumbUrl: stored } : { picked: true })
    .where(eq(phraseImages.id, id));

  return { ok: true };
}

/** Добавить картинку ссылкой — когда поиск не нашёл нужного. */
export async function addPhraseImageAction(
  phraseId: string,
  url: string,
  pick = false,
): Promise<ImagesState> {
  await requireTeacher();
  const id = String(phraseId ?? "");
  const link = String(url ?? "").trim();
  if (!id || !link) return { error: "Нужна ссылка на картинку" };
  if (!/^https?:\/\//i.test(link)) return { error: "Ссылка должна начинаться с http" };

  // Добавленную сразу кладём к себе: её выбрал учитель, и она должна
  // остаться, даже когда источник её потеряет.
  const stored = await storeRemoteImage(link);
  if (!stored) return { error: "По ссылке не картинка или её не скачать" };

  const existing = await db
    .select({ sortOrder: phraseImages.sortOrder })
    .from(phraseImages)
    .where(eq(phraseImages.phraseId, id))
    .orderBy(asc(phraseImages.sortOrder));

  const last = existing.at(-1)?.sortOrder ?? 0;

  if (pick) {
    await db
      .update(phraseImages)
      .set({ picked: false })
      .where(eq(phraseImages.phraseId, id));
  }

  await db.insert(phraseImages).values({
    phraseId: id,
    url: stored,
    thumbUrl: stored,
    origin: "manual",
    sortOrder: last + 10,
    // Первая картинка слова сразу идёт в игру: иначе её пришлось бы
    // выбирать вторым нажатием без всякого выбора.
    picked: pick || existing.length === 0,
  });

  return { ok: true };
}

/**
 * Загрузка картинки с компьютера.
 *
 * Поиск находит не всё: своя фотография или вырезанный кусок из книги
 * иногда объясняют слово лучше любого стока. Файл кладётся в то же
 * хранилище, что и найденное, поэтому дальше они ничем не различаются.
 *
 * Причина отказа возвращается кодом: текст собирает страница — язык
 * знает она.
 */
export async function uploadPhraseImageAction(
  formData: FormData,
): Promise<ImagesState & { reason?: StoreFailure }> {
  await requireTeacher();

  const phraseId = String(formData.get("phraseId") || "");
  const file = formData.get("image");
  if (!phraseId) return { error: "Не выбрано слово" };
  if (!(file instanceof File) || file.size === 0) return { reason: "failed" };

  const stored = await storeUploadedImage(file);
  if ("error" in stored) return { reason: stored.error };

  const existing = await db
    .select({ id: phraseImages.id, sortOrder: phraseImages.sortOrder })
    .from(phraseImages)
    .where(eq(phraseImages.phraseId, phraseId))
    .orderBy(asc(phraseImages.sortOrder));

  await db.insert(phraseImages).values({
    phraseId,
    url: stored.url,
    thumbUrl: stored.url,
    origin: "manual",
    sortOrder: (existing.at(-1)?.sortOrder ?? 0) + 10,
    // Первая картинка слова сразу идёт в игру: выбирать не из чего.
    picked: existing.length === 0,
  });

  return { ok: true };
}

export async function deletePhraseImageAction(imageId: string): Promise<ImagesState> {
  await requireTeacher();
  const id = String(imageId ?? "");
  if (!id) return { error: "Не выбрана картинка" };

  const [image] = await db
    .select({ url: phraseImages.url, phraseId: phraseImages.phraseId, picked: phraseImages.picked })
    .from(phraseImages)
    .where(eq(phraseImages.id, id))
    .limit(1);
  if (!image) return { ok: true };

  await db.delete(phraseImages).where(eq(phraseImages.id, id));
  // Файл уходит вместе со строкой: иначе хранилище растёт тем, что уже
  // никому не нужно. Чужие ссылки удалять нечего.
  await removeStoredImage(image.url);

  // Слово не должно остаться без картинки, если другие ещё есть.
  if (image.picked) {
    const [next] = await db
      .select({ id: phraseImages.id })
      .from(phraseImages)
      .where(eq(phraseImages.phraseId, image.phraseId))
      .orderBy(asc(phraseImages.sortOrder))
      .limit(1);
    if (next) {
      await db.update(phraseImages).set({ picked: true }).where(eq(phraseImages.id, next.id));
    }
  }

  return { ok: true };
}

export type VocabNode = {
  id: string;
  name: string;
  icon: string | null;
  /** Сколько слов и у скольких из них есть выбранная картинка. */
  words: number;
  ready: number;
};

/**
 * Словники, по которым можно играть.
 *
 * Показываем и те, где картинок ещё нет: иначе непонятно, куда идти их
 * подбирать. Готовность видна числом.
 */
export async function listVocabNodesAction(
  ownerId?: string,
): Promise<VocabNode[]> {
  await requireTeacher();

  const nodes = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      icon: materialNodes.icon,
    })
    .from(materialNodes)
    .where(
      ownerId
        ? and(eq(materialNodes.pageKind, "VOCAB"), eq(materialNodes.ownerId, ownerId))
        : eq(materialNodes.pageKind, "VOCAB"),
    )
    .orderBy(asc(materialNodes.name));

  if (nodes.length === 0) return [];

  const phrases = await db
    .select({
      nodeId: materialPhrases.nodeId,
      phraseId: materialPhrases.id,
      kind: materialPhrases.kind,
    })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, nodes.map((n) => n.id)));

  const words = phrases.filter((p) => p.kind !== "NOTE");
  const readyIds = new Set(
    words.length === 0
      ? []
      : (
          await db
            .select({ phraseId: phraseImages.phraseId })
            .from(phraseImages)
            .where(
              and(
                inArray(phraseImages.phraseId, words.map((w) => w.phraseId)),
                eq(phraseImages.picked, true),
              ),
            )
        ).map((row) => row.phraseId),
  );

  return nodes.map((node) => {
    const own = words.filter((w) => w.nodeId === node.id);
    return {
      id: node.id,
      name: node.name,
      icon: node.icon,
      words: own.length,
      ready: own.filter((w) => readyIds.has(w.phraseId)).length,
    };
  });
}
