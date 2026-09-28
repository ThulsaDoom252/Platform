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
import { carryKey } from "@/lib/phrase-carry";
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
  /** Английское описание для игр. Ученику не показывается. */
  description: string | null;
  images: PhraseImage[];
};

export type ImagesState = { ok?: boolean; error?: string; found?: number };

export type DescriptionsState = {
  ok?: boolean;
  error?: string;
  /** Сколько слов получило описание и какие строки не нашли своего слова. */
  filled?: number;
  missed?: string[];
};

/**
 * Дописать описания к словам, не трогая всё остальное.
 *
 * Обычное наполнение стирает страницу и собирает её заново — вместе со
 * словами исчезают и картинки, подобранные руками. Здесь не удаляется
 * ничего: из присланного текста берутся только строки DEF и кладутся
 * тем словам, которые на странице уже есть.
 *
 * Читаем построчно, а не полным разбором: присылают обычно обрывок —
 * пары WORD и DEF без заголовка, категорий и примеров.
 */
export async function fillDescriptionsAction(
  nodeId: string,
  raw: string,
): Promise<DescriptionsState> {
  await requireTeacher();

  const id = String(nodeId ?? "");
  const text = String(raw ?? "");
  if (!id) return { error: "Не выбрана страница" };
  if (!text.trim()) return { error: "Пустой текст" };

  const wanted = new Map<string, string>();
  let word: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(WORD|DEF)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;

    const key = match[1].toUpperCase();
    const value = match[2].trim();

    if (key === "WORD") {
      word = value;
      continue;
    }
    if (word && value) wanted.set(carryKey(word), value.slice(0, 200));
  }

  if (wanted.size === 0) return { error: "В тексте нет ни одной пары WORD и DEF" };

  const phrases = await db
    .select({ id: materialPhrases.id, phrase: materialPhrases.phrase })
    .from(materialPhrases)
    .where(eq(materialPhrases.nodeId, id));

  if (phrases.length === 0) return { error: "На странице нет слов" };

  const byWord = new Map<string, string>();
  for (const p of phrases) {
    const key = carryKey(p.phrase);
    if (key && !byWord.has(key)) byWord.set(key, p.id);
  }

  let filled = 0;
  const missed: string[] = [];

  for (const [key, description] of wanted) {
    const phraseId = byWord.get(key);
    if (!phraseId) {
      missed.push(key);
      continue;
    }
    await db
      .update(materialPhrases)
      .set({ description })
      .where(eq(materialPhrases.id, phraseId));
    filled += 1;
  }

  revalidatePath("/teacher/materials");
  return { ok: true, filled, missed: missed.slice(0, 12) };
}

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
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
      description: materialPhrases.description,
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
    description: w.description,
    images: byPhrase.get(w.id) ?? [],
  }));
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

/** Картинка, выбранная для игры. Нужна окну правки слова. */
export async function pickedImageAction(phraseId: string): Promise<string | null> {
  await requireTeacher();
  const id = String(phraseId ?? "");
  if (!id) return null;

  const [row] = await db
    .select({ url: phraseImages.url })
    .from(phraseImages)
    .where(and(eq(phraseImages.phraseId, id), eq(phraseImages.picked, true)))
    .limit(1);

  return row?.url ?? null;
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
