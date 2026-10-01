import type { RuleBlock, RuleBlockVariant } from "@/lib/rule-blocks";
import type { TwisterStroke } from "@/lib/twister-drawing";
import type { ClassVideoState } from "@/lib/class-video";
import type {
  WordDeckLiveState,
  WordDeckSettings,
  WordDeckSourceCard,
} from "@/lib/word-deck";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------
export const roleEnum = pgEnum("role", ["TEACHER", "STUDENT"]);
export const themeEnum = pgEnum("theme", ["LIGHT", "DARK"]);
export const localeEnum = pgEnum("locale", ["en", "ru", "uk"]);
export const lessonStatusEnum = pgEnum("lesson_status", [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED_BY_STUDENT",
  "BURNED",
  "CANCELLED_BY_TEACHER",
]);
export const materialTypeEnum = pgEnum("material_type", ["FOLDER", "FILE"]);
export const homeworkStatusEnum = pgEnum("homework_status", [
  "NOT_DONE",
  "SUBMITTED",
  "IN_REVIEW",
  "REVIEWED",
  "NEEDS_REVISION",
]);
export const vocabLangEnum = pgEnum("vocab_lang", ["RU", "UK"]);
export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// ---------- Users ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /**
   * Обратимая копия ученического пароля для учителя, зашифрованная
   * AES-GCM. У учителя это поле всегда null.
   */
  passwordVault: text("password_vault"),
  /** Учитель может закрыть вход, не меняя и не раскрывая пароль. */
  accessBlocked: boolean("access_blocked").notNull().default(false),
  role: roleEnum("role").notNull(),
  avatarUrl: text("avatar_url"),
  theme: themeEnum("theme").notNull().default("LIGHT"),
  // Язык интерфейса — у каждого пользователя свой, по умолчанию английский
  locale: localeEnum("locale").notNull().default("en"),
  phone: text("phone"),
  contactNote: text("contact_note"),
  email: text("email"),
  telegram: text("telegram"),
  // Student-only. Если ученик состоит в пакете, это зеркало package.remainingLessons.
  lessonBalance: integer("lesson_balance").notNull().default(0),
  // Общий пакет уроков (может быть один на нескольких учеников)
  packageId: uuid("package_id"),
  // Student-only: CEFR level (e.g. "B1 · Upper Intermediate") and overall progress 0..100
  level: text("level"),
  progressPercent: integer("progress_percent").notNull().default(0),
  /**
   * Уроки, проведённые до платформы. Прибавляются к посчитанным,
   * чтобы «всего за весь период» отражало реальную историю занятий.
   */
  lessonsBefore: integer("lessons_before").notNull().default(0),
  /** Начало занятий. Пусто — берём дату первого урока на платформе. */
  startedAt: timestamp("started_at"),
  /** Последний признак жизни в браузере — по нему считается «онлайн». */
  lastSeenAt: timestamp("last_seen_at"),
  /**
   * С кем учитель сейчас в классе. У ученика поле пустое: его класс —
   * это тот учитель, который выбрал именно его.
   */
  classWithId: uuid("class_with_id"),
  /**
   * Что человек открыл в классе прямо сейчас.
   *
   * Нужно собеседнику, а не владельцу: учитель должен видеть, где
   * ученик, прежде чем тащить его на доску, — звать туда, где он уже
   * стоит, незачем.
   */
  classWhere: text("class_where"),
  /**
   * Куда учитель перевёл ученика: панель и время команды.
   *
   * Время здесь не для истории, а чтобы повторная команда на ту же
   * панель сработала: без него второй вызов на доску ничем не
   * отличался бы от первого и был бы проглочен.
   */
  classFocus: jsonb("class_focus").$type<{
    panel?: string;
    at: string;
    /** Явная команда показа: обычные панели остаются индивидуальными. */
    view?: "BOARD" | "LESSON" | "GAME" | "TWISTER";
    /** Объект, который надо показать в центре доски ученика. */
    boardObjectId?: number | null;
    /** Что сделать на доске: открыть, сфокусировать или мигнуть объектом. */
    boardCommand?: "SHOW" | "FOCUS" | "FLASH";
    /** Урок, который учитель сейчас открыл этому ученику в классе. */
    lessonAssignmentId?: string;
    /** Секция урока, которую учитель приказал показать, даже если она закрыта. */
    lessonSection?: "vocab" | "lexis" | "video" | "transcript" | "questions" | "homework";
    /** Назначенная ученику колода, которую учитель открыл поверх урока. */
    gameId?: string;
    /** Временный полноэкранный просмотр скороговорки и совместный рисунок. */
    twisterId?: string;
    twisterSessionId?: string;
    twisterStrokes?: TwisterStroke[];
    twisterStudentDrawingAllowed?: boolean;
    /** Синхронный плеер текущего выданного урока. */
    videoState?: ClassVideoState;
  }>(),
  /** Цифры за весь период показывать как приблизительные. */
  statsApproximate: boolean("stats_approximate").notNull().default(false),
  /** Что из баланса и статистики видит сам ученик. */
  showBalance: boolean("show_balance").notNull().default(true),
  showPackageSize: boolean("show_package_size").notNull().default(true),
  showTotalLessons: boolean("show_total_lessons").notNull().default(true),
  showExpiry: boolean("show_expiry").notNull().default(true),
  /** Может ли ученик выгружать материалы в текст и docx. */
  allowExport: boolean("allow_export").notNull().default(true),
  /**
   * Показывать ли ученику прошедшие уроки. По умолчанию нет: расписание
   * нужно ему, чтобы знать, когда следующее занятие, а не разбирать архив.
   * Учитель включает это отдельно каждому.
   */
  showPastLessons: boolean("show_past_lessons").notNull().default(false),

  // ---------- Анкета ученика ----------
  viber: text("viber"),
  /** Чем занимается помимо языка: тем для разговора всегда не хватает. */
  hobby: text("hobby"),
  /** Зачем учит английский — своими словами. */
  goal: text("goal"),
  /** Откуда родом. */
  homeland: text("homeland"),
  /** Где живёт сейчас: страна и город. */
  country: text("country"),
  city: text("city"),

  // ---------- Заметки учителя: ученику не показываются ----------
  /** Цвет темы платформы, выбранный пользователем. */
  accent: text("accent"),
  /** Уровень на момент начала занятий — с чем пришёл. */
  levelAtStart: text("level_at_start"),
  /** Частые ошибки: то, к чему возвращаются из урока в урок. */
  frequentMistakes: text("frequent_mistakes"),
  /** Всё остальное, что учителю стоит помнить. */
  teacherNote: text("teacher_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------- Пакеты уроков ----------
// Пакет может быть общим: несколько учеников списывают уроки из одного пула.
export const lessonPackages = pgTable("lesson_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  totalLessons: integer("total_lessons").notNull().default(0),
  remainingLessons: integer("remaining_lessons").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lessonPackagesRelations = relations(lessonPackages, ({ many }) => ({
  members: many(users),
}));

export const usersRelations = relations(users, ({ many }) => ({
  lessonsAsStudent: many(lessons),
  homework: many(homework),
  vocabulary: many(vocabularyWords),
  wishlistNotes: many(wishlistNotes),
  contactRequests: many(contactChangeRequests),
  assignedMaterials: many(studentMaterials),
}));

// ---------- Lessons / Schedule ----------
export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  topic: text("topic"),
  status: lessonStatusEnum("status").notNull().default("SCHEDULED"),
  /** Был ли именно этот урок уже списан с баланса. */
  balanceCharged: boolean("balance_charged").notNull().default(false),
  /** Для отмены: учитель уже решил, списывать урок или нет. */
  chargeResolved: boolean("charge_resolved").notNull().default(false),
  teacherComment: text("teacher_comment"),
  teacherCommentVisible: boolean("teacher_comment_visible")
    .notNull()
    .default(false),
  cancelReason: text("cancel_reason"),
  cancelledAt: timestamp("cancelled_at"),
  materialNodeId: uuid("material_node_id").references(
    () => materialNodes.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  student: one(users, {
    fields: [lessons.studentId],
    references: [users.id],
  }),
  homework: many(homework),
}));

/** Оформление скрипта: шрифт, размер, цвета, фон. */
export type ScriptStyle = {
  font?: string;
  size?: number;
  color?: string;
  background?: string;
  backgroundImage?: string | null;
};

/**
 * Скрипт урока — заметки учителя к конкретному занятию.
 *
 * Привязан к уроку, а значит сразу к ученику и к дню: отдельных полей
 * для них не нужно. Ученик его не видит никогда — это подготовка,
 * а не материал.
 */
export const lessonScripts = pgTable("lesson_scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  /** Размеченный текст: его же показывает читалка. */
  html: text("html").notNull().default(""),
  style: jsonb("style").$type<ScriptStyle>().default({}).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lessonScriptsRelations = relations(lessonScripts, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonScripts.lessonId],
    references: [lessons.id],
  }),
}));

/**
 * Сохранённый скрипт удалённого занятия.
 *
 * Сам урок можно убрать из расписания и расчётов полностью, но подготовка
 * учителя остаётся доступной в истории, пока учитель не удалит её отдельно.
 */
export const archivedLessonScripts = pgTable("archived_lesson_scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalLessonId: uuid("original_lesson_id").notNull().unique(),
  studentId: uuid("student_id").notNull(),
  studentName: text("student_name").notNull(),
  startTime: timestamp("start_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  html: text("html").notNull().default(""),
  style: jsonb("style").$type<ScriptStyle>().default({}).notNull(),
  cancelReason: text("cancel_reason"),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Заготовка скрипта: план, который повторяется от урока к уроку.
 *
 * Хранится в базе, а не в браузере: это наработка учителя, и терять
 * её при чистке истории нельзя.
 */
export const scriptPresets = pgTable("script_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  html: text("html").notNull().default(""),
  style: jsonb("style").$type<ScriptStyle>().default({}).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Materials tree ----------
export const materialNodes = pgTable("material_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  /**
   * MATERIAL — общая библиотека, которую учитель раздаёт ученикам.
   * MISTAKE — личное дерево ошибок конкретного ученика.
   */
  scope: text("scope").notNull().default("MATERIAL"),
  /** Владелец личного дерева. Для общей библиотеки null. */
  ownerId: uuid("owner_id"),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  // Подзаголовок страницы материала
  description: text("description"),
  // Эмодзи-иконка узла и порядок в списке
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  type: materialTypeEnum("type").notNull().default("FOLDER"),
  fileUrl: text("file_url"),
  // File-only metadata for the library UI
  fileKind: text("file_kind"), // PDF | PPT | DOC | ...
  category: text("category"), // Vocabulary | Grammar | Business | ...
  sizeLabel: text("size_label"), // "2.4 MB"
  /**
   * Чем страница заполнена: VOCAB — словник, RULE — правило.
   * Запоминается при сохранении, чтобы после очистки страница помнила,
   * чем она была, и предлагала соответствующие действия.
   */
  pageKind: text("page_kind"),
  /** Язык переводов и пояснений на странице: русский или украинский. */
  translationLang: vocabLangEnum("translation_lang").notNull().default("UK"),
  /** Служебная отметка учителя: материал нужно исправить. Ученику не показывается. */
  needsFix: boolean("needs_fix").notNull().default(false),
  /** Число одноимённых файлов, которые были безопасно объединены при импорте. */
  mergeCount: integer("merge_count").notNull().default(1),
  /** Во сколько процентов показывать картинки слов: 100 — обычный размер. */
  imageScale: integer("image_scale").notNull().default(100),
  /**
   * Исходный текст правила или словаря, как его вставили. Нужен, чтобы
   * «Редактировать» показывало и разобранное содержимое, и оригинал.
   */
  sourceText: text("source_text"),
  /**
   * Снимок содержимого перед перестройкой из исходника.
   *
   * Перепарсинг восстанавливает страницу из sourceText, а правки, сделанные
   * руками после импорта, туда не попадают — без снимка они исчезали молча.
   * Сюда кладётся то, что было до перестройки, чтобы её можно было отменить.
   */
  contentBackup: jsonb("content_backup").$type<ContentBackup>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Что именно сохраняется перед перестройкой страницы. */
export type ContentBackup = {
  /** Когда сняли — показывается в кнопке отмены. */
  savedAt: string;
  /** Чем страница была до перестройки. */
  pageKind: string | null;
  phrases: {
    sortOrder: number;
    icon: string | null;
    imageUrl: string | null;
    phrase: string;
    transcription: string | null;
    translation: string | null;
    section: string | null;
    kind: string;
    examples: PhraseExample[];
  }[];
  blocks: { sortOrder: number; type: string; data: RuleBlock }[];
};

export const materialNodesRelations = relations(
  materialNodes,
  ({ one, many }) => ({
    parent: one(materialNodes, {
      fields: [materialNodes.parentId],
      references: [materialNodes.id],
      relationName: "parentChild",
    }),
    children: many(materialNodes, { relationName: "parentChild" }),
    assignments: many(studentMaterials),
  }),
);

// ---------- Фразы внутри материала (идиомы, сравнения и т.п.) ----------
export type PhraseExample = { en: string; tr: string };

export const materialPhrases = pgTable("material_phrases", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => materialNodes.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  // Картинка-образ: эмодзи или загруженное изображение
  icon: text("icon"),
  imageUrl: text("image_url"),
  phrase: text("phrase").notNull(),
  /** Транскрипция IPA, например /drɒpt/ */
  transcription: text("transcription"),
  /** Американский и британский варианты — их озвучивают по отдельности. */
  transcriptionUs: text("transcription_us"),
  transcriptionUk: text("transcription_uk"),
  /** Заметка «что стоит знать»; прячется тумблером подсказок. */
  note: text("note"),
  /**
   * Короткое английское описание слова.
   *
   * Ученику не показывается: по нему его спрашивают в игре. Картинка
   * лежит отдельно, в phrase_images, — их у слова несколько.
   */
  description: text("description"),
  /** Цвет категории из ключевого формата. */
  sectionColor: text("section_color"),
  translation: text("translation"),
  /** Заголовок секции внутри страницы, например "Single-word Verbs & Participles" */
  section: text("section"),
  /** PHRASE — обычная запись, NOTE — пояснительная заметка 💡 */
  kind: text("kind").notNull().default("PHRASE"),
  /** Примеры употребления: [{ en, tr }] */
  examples: jsonb("examples").$type<PhraseExample[]>().default([]).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const materialPhrasesRelations = relations(materialPhrases, ({ one }) => ({
  node: one(materialNodes, {
    fields: [materialPhrases.nodeId],
    references: [materialNodes.id],
  }),
}));

// ---------- Блоки страницы-правила ----------
// Правило — это документ: заголовки, врезки, формулы, таблицы, примеры.
// Список фраз (materialPhrases) такую структуру не вмещает.
// Описание блоков лежит в lib/rule-blocks — одно на схему, парсер и проверку.
export type { RuleBlock, RuleBlockVariant };

export const materialBlocks = pgTable("material_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => materialNodes.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  /** heading | callout | formula | text | example | list | table */
  type: text("type").notNull(),
  /** Содержимое блока — форма зависит от типа (см. RuleBlock). */
  data: jsonb("data").$type<RuleBlock>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Класс: переписка учителя с учеником ----------

/**
 * Сообщение в чате урока.
 *
 * Переписка привязана к ученику, а не к занятию: она продолжается от
 * урока к уроку, и учитель может вернуться к старому разговору.
 * Удаление и архивация — пометки, строки остаются на месте.
 */
export const classMessages = pgTable("class_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  /** Убрано из ленты, но сохранено: учитель может вернуть. */
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  /** Прочитано другой стороной — по этому считается значок с числом. */
  readAt: timestamp("read_at"),
});

// ---------- Неправильные глаголы ----------

/**
 * Страница неправильных глаголов: три формы, транскрипции и перевод.
 *
 * Категории учитель придумывает сам, чтобы легче запоминалось, поэтому
 * это просто текст, а не справочник. Пустая категория означает «без
 * категории» — такие глаголы показываются первыми.
 */
export const irregularVerbs = pgTable("irregular_verbs", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => materialNodes.id, { onDelete: "cascade" }),
  category: text("category"),
  sortOrder: integer("sort_order").notNull().default(0),
  icon: text("icon"),
  base: text("base").notNull(),
  baseIpa: text("base_ipa"),
  past: text("past").notNull(),
  pastIpa: text("past_ipa"),
  participle: text("participle").notNull(),
  participleIpa: text("participle_ipa"),
  translation: text("translation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const materialBlocksRelations = relations(materialBlocks, ({ one }) => ({
  node: one(materialNodes, {
    fields: [materialBlocks.nodeId],
    references: [materialNodes.id],
  }),
}));

export const studentMaterials = pgTable("student_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  materialNodeId: uuid("material_node_id")
    .notNull()
    .references(() => materialNodes.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const studentMaterialsRelations = relations(
  studentMaterials,
  ({ one }) => ({
    student: one(users, {
      fields: [studentMaterials.studentId],
      references: [users.id],
    }),
    material: one(materialNodes, {
      fields: [studentMaterials.materialNodeId],
      references: [materialNodes.id],
    }),
  }),
);

// ---------- Homework ----------
export const homework = pgTable("homework", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  /** Необязательная сохранённая карточная активность. */
  activityId: uuid("activity_id"),
  status: homeworkStatusEnum("status").notNull().default("NOT_DONE"),
  teacherFeedback: text("teacher_feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const homeworkRelations = relations(homework, ({ one }) => ({
  student: one(users, {
    fields: [homework.studentId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [homework.lessonId],
    references: [lessons.id],
  }),
}));

// ---------- Vocabulary ----------
export const vocabularyWords = pgTable("vocabulary_words", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  normalizedForm: text("normalized_form"),
  translation: text("translation"),
  translationLang: vocabLangEnum("translation_lang").notNull().default("RU"),
  partOfSpeech: text("part_of_speech"),
  addedByRole: roleEnum("added_by_role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vocabularyWordsRelations = relations(
  vocabularyWords,
  ({ one }) => ({
    student: one(users, {
      fields: [vocabularyWords.studentId],
      references: [users.id],
    }),
  }),
);

// ---------- Wishlist / "Пожелания" ----------
export const wishlistNotes = pgTable("wishlist_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wishlistNotesRelations = relations(wishlistNotes, ({ one }) => ({
  student: one(users, {
    fields: [wishlistNotes.studentId],
    references: [users.id],
  }),
}));

// ---------- Contact change requests ----------
export const contactChangeRequests = pgTable("contact_change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  status: contactRequestStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const contactChangeRequestsRelations = relations(
  contactChangeRequests,
  ({ one }) => ({
    student: one(users, {
      fields: [contactChangeRequests.studentId],
      references: [users.id],
    }),
  }),
);

// ---------- Notifications (for teacher: cancellations, wishlist notes, contact requests) ----------
export const notificationTypeEnum = pgEnum("notification_type", [
  "LESSON_CANCELLED",
  "WISHLIST_NOTE",
  "CONTACT_CHANGE_REQUEST",
  "HOMEWORK_SUBMITTED",
  "LESSON_RESCHEDULED",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  message: text("message").notNull(),
  relatedStudentId: uuid("related_student_id").references(() => users.id, {
    onDelete: "set null",
  }),
  relatedLessonId: uuid("related_lesson_id").references(() => lessons.id, {
    onDelete: "set null",
  }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Скороговорки — общий пул картинок учителя.
 *
 * Хранится картинкой, а не текстом: скороговорки приходят снимками из
 * книг и карточек, и перенабирать их вручную незачем. Название
 * необязательно — без него карточка живёт под своим файлом.
 */
export const tongueTwisters = pgTable("tongue_twisters", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  imageUrl: text("image_url").notNull(),
  /** Ручной порядок в пуле: перетаскивание важнее даты загрузки. */
  sortOrder: integer("sort_order").notNull().default(0),
  /**
   * Отпечаток содержимого.
   *
   * По нему видно, что тот же файл уже в пуле. Имя и дата для этого не
   * годятся: один и тот же снимок приходит из разных папок под разными
   * именами, и пул незаметно набивается повторами.
   */
  contentHash: text("content_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Кому и когда выдавалась скороговорка.
 *
 * Это история, а не связь: строки копятся, а не заменяются. Поэтому
 * видно, что одна и та же скороговорка уже была у ученика, сколько раз
 * и когда в последний раз. Закреплённая сейчас — та, у которой стоит
 * `pinned`; она одна на ученика.
 */
export const tongueTwisterAssignments = pgTable("tongue_twister_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  twisterId: uuid("twister_id")
    .notNull()
    .references(() => tongueTwisters.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pinned: boolean("pinned").notNull().default(false),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const tongueTwisterAssignmentsRelations = relations(
  tongueTwisterAssignments,
  ({ one }) => ({
    twister: one(tongueTwisters, {
      fields: [tongueTwisterAssignments.twisterId],
      references: [tongueTwisters.id],
    }),
    student: one(users, {
      fields: [tongueTwisterAssignments.studentId],
      references: [users.id],
    }),
  }),
);

/**
 * Картинки, подобранные к слову словника.
 *
 * Лежат отдельно от самой фразы, потому что их несколько: поиск даёт
 * три варианта, из которых учитель выбирает один. Ученику видна только
 * выбранная, да и та лишь в игре — в словнике подборка не показывается.
 */
export const phraseImages = pgTable("phrase_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  phraseId: uuid("phrase_id")
    .notNull()
    .references(() => materialPhrases.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url"),
  /** pixabay — нашлась поиском, manual — учитель дал ссылку сам. */
  origin: text("origin").notNull().default("pixabay"),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Та, что пойдёт в игру. На слово выбрана одна. */
  picked: boolean("picked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const phraseImagesRelations = relations(phraseImages, ({ one }) => ({
  phrase: one(materialPhrases, {
    fields: [phraseImages.phraseId],
    references: [materialPhrases.id],
  }),
}));

/** Карта в колоде: всё нужное для показа, снятое на момент старта. */
export type GameCard = {
  phraseId: string;
  nodeId: string;
  word: string;
  translation: string | null;
  imageUrl: string;
  /** Что на лицевой стороне именно этой карты. */
  face: "PICTURE" | "TRANSLATION";
  /** Для WORD_DECK: кому досталась карта в альтернативном режиме. */
  owner?: "TEACHER" | "STUDENT" | null;
  instanceId?: string;
};

/** Как ответили на карту. null — до неё ещё не дошли. */
export type GameVerdict = "right" | "wrong" | "timeout";

/** Сохранённый шаблон карточной игры в разделе Activities. */
export const wordDeckActivities = pgTable("word_deck_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  nodeId: uuid("node_id").references(() => materialNodes.id, {
    onDelete: "set null",
  }),
  cards: jsonb("cards").$type<WordDeckSourceCard[]>().default([]).notNull(),
  settings: jsonb("settings").$type<WordDeckSettings>().notNull(),
  backgroundImageUrl: text("background_image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Партия «Угадай по картинке».
 *
 * Колода снимается при старте и дальше не меняется: если учитель правит
 * словник посреди игры, карточки под учеником разъезжаться не должны.
 * Ученик читает эту же строку опросом — отсюда и `deadline`: время
 * хранится меткой, а не остатком, иначе два экрана считают по-разному.
 */
export const activityGames = pgTable("activity_games", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("GUESS_PICTURE"),
  /** Из какого сохранённого шаблона создана партия WORD_DECK. */
  templateId: uuid("template_id").references(() => wordDeckActivities.id, {
    onDelete: "set null",
  }),
  /** Настройки и фон снимаются вместе с колодой на момент запуска. */
  wordDeck: jsonb("word_deck").$type<{
    settings: WordDeckSettings;
    backgroundImageUrl: string | null;
    /** Снимок выбранных слов: назначение не зависит от дальнейших правок шаблона. */
    cards: WordDeckSourceCard[];
    /** Текущий стол живого класса. Управляет только учитель. */
    liveState?: WordDeckLiveState;
  }>(),
  /**
   * Чем спрашиваем.
   *
   * PICTURE — картинкой, TRANSLATION — переводом, MIXED — и тем и
   * другим: у каждого слова две карты, разведённые по колоде. Режим
   * запоминается в партии: колода под него уже собрана, и менять его на
   * ходу значило бы показывать карточки, которых там нет.
   */
  mode: text("mode").notNull().default("PICTURE"),
  /** Короткое имя для очереди активностей: по нему учитель её узнаёт. */
  title: text("title"),
  /** LOBBY — собрана, но не начата; RUNNING — идёт; DONE — закончена. */
  status: text("status").notNull().default("LOBBY"),
  cards: jsonb("cards").$type<GameCard[]>().default([]).notNull(),
  verdicts: jsonb("verdicts").$type<(GameVerdict | null)[]>().default([]).notNull(),
  /**
   * Сколько миллисекунд ушло на каждую карту.
   *
   * По ним считается самый быстрый и самый долгий ответ. Хранится
   * рядом с оценками, потому что смысл имеют только вместе: время без
   * вердикта — это просто таймаут.
   */
  timings: jsonb("timings").$type<(number | null)[]>().default([]).notNull(),
  at: integer("at").notNull().default(0),
  /** Перевёрнута ли текущая карта — ответ уже виден обоим. */
  revealed: boolean("revealed").notNull().default(false),
  seconds: integer("seconds").notNull().default(10),
  /**
   * На паузе ли партия и сколько на карте оставалось, когда её нажали.
   *
   * Партия и начинается с паузы: игру ставят заранее, а начинают, когда
   * оба готовы. Пока пауза, срок не идёт — остаток лежит числом, и
   * только по «play» он снова превращается в метку времени.
   */
  paused: boolean("paused").notNull().default(true),
  pausedLeftMs: integer("paused_left_ms").notNull().default(0),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityGamesRelations = relations(activityGames, ({ one }) => ({
  student: one(users, {
    fields: [activityGames.studentId],
    references: [users.id],
  }),
}));

/**
 * Повторение слов: задание, которое учитель выдаёт из словника ученика.
 *
 * Слова снимаются при выдаче и хранятся списком: правка словника потом
 * не должна менять уже выданное задание. Сами карточки собираются при
 * старте попытки — по этому же списку и выбранным режимам.
 */
export const wordRevisions = pgTable("word_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Откуда выдано — ссылка на словник в материалах ученика. */
  nodeId: uuid("node_id").references(() => materialNodes.id, {
    onDelete: "set null",
  }),
  /** Как назвал задание учитель: по нему ученик его и узнаёт. */
  title: text("title").notNull(),
  /** Какие слова участвуют — объединение по всем режимам. */
  phraseIds: jsonb("phrase_ids").$type<string[]>().default([]).notNull(),
  /** Режимы в том порядке, какой задал учитель. */
  modes: jsonb("modes").$type<string[]>().default([]).notNull(),
  /**
   * Слова по режимам: какой режим какими словами закрывать.
   *
   * Секции не обязаны идти на одном наборе: карточки можно дать на всех
   * двадцати пяти словах, а «собери слово» — на пяти трудных. Пустой
   * режим берёт всё, что ему подходит.
   */
  modeWords: jsonb("mode_words").$type<Record<string, string[]>>(),
  /**
   * Что показывать в подсказках режимов.
   *
   * Карточка по умолчанию показывает одно английское слово, а «собери
   * слово» — только буквы: перевод и картинка рядом с заданием делают
   * его бессмысленным. Включает их учитель, а не движок игры.
   */
  show: jsonb("show").$type<Record<string, boolean>>(),
  /**
   * Сколько секунд на один ответ. Пусто — без ограничения.
   * Отдельно от общего срока: они складываются, а не заменяют друг друга.
   */
  answerSeconds: integer("answer_seconds"),
  /** Сколько секунд на всё задание. Пусто — без ограничения. */
  totalSeconds: integer("total_seconds"),
  /** До какого числа пройти. */
  dueAt: timestamp("due_at"),
  /**
   * Разрешено ли пройти ещё раз.
   *
   * Сданное задание закрывается; учитель может открыть его снова, и
   * тогда попытки копятся — по ним и видно, как меняется результат.
   */
  reopened: boolean("reopened").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wordRevisionsRelations = relations(wordRevisions, ({ one, many }) => ({
  student: one(users, {
    fields: [wordRevisions.studentId],
    references: [users.id],
  }),
  node: one(materialNodes, {
    fields: [wordRevisions.nodeId],
    references: [materialNodes.id],
  }),
  attempts: many(wordRevisionAttempts),
}));

/** Один ответ ученика внутри попытки. */
export type RevisionAnswerRow = {
  mode: string;
  phraseId: string;
  word: string;
  correct: boolean;
  reason?: "wrong" | "timeout";
  ms: number;
};

/**
 * Попытка прохождения.
 *
 * Хранится целиком, включая ответы: разбор учителя строится по ним, а
 * пересчитать его из итогового числа уже нельзя.
 */
export const wordRevisionAttempts = pgTable("word_revision_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  revisionId: uuid("revision_id")
    .notNull()
    .references(() => wordRevisions.id, { onDelete: "cascade" }),
  /** Собранное задание: шаги в том виде, в каком их увидел ученик. */
  plan: jsonb("plan").$type<unknown>(),
  answers: jsonb("answers").$type<RevisionAnswerRow[]>().default([]).notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  /** Учитель посмотрел результат — уведомление гаснет. */
  seenByTeacher: boolean("seen_by_teacher").notNull().default(false),
});

export const wordRevisionAttemptsRelations = relations(
  wordRevisionAttempts,
  ({ one }) => ({
    revision: one(wordRevisions, {
      fields: [wordRevisionAttempts.revisionId],
      references: [wordRevisions.id],
    }),
  }),
);

/* ------------------------------------------------------------------ */
/* Уроки                                                               */
/* ------------------------------------------------------------------ */

export type LessonLexisGroupData = {
  id: string;
  source: string;
  title: string;
  intro: string | null;
  blocks: RuleBlock[];
  warnings: string[];
  sourceNodeId: string | null;
};

/**
 * Урок как заготовка.
 *
 * Это не занятие из расписания (те лежат в lessons) — это материал,
 * который учитель собирает один раз и потом выдаёт скольким угодно
 * ученикам. Поэтому таблица отдельная: у занятия есть время и ученик, у
 * заготовки — только содержимое.
 *
 * Обычный урок — заголовок и домашка. Урок-активность собран из секций:
 * словник, лексика, видео, расшифровка, вопросы, домашка. Секции не в отдельной
 * таблице: их шесть, они заранее известны и у каждой своя форма, так что
 * строки с общим «content» были бы честнее только на вид.
 */
export const lessonUnits = pgTable("lesson_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** REGULAR — обычный урок, ACTIVITY — с секциями. */
  kind: text("kind").notNull().default("ACTIVITY"),
  title: text("title").notNull(),
  description: text("description"),
  /**
   * Словник, на котором держится секция Vocabulary.
   *
   * Ссылкой, а не копией: слова с описаниями, транскрипциями и
   * картинками уже собраны в материалах, и вторая их копия разошлась бы
   * с первой на первой же правке.
   */
  vocabNodeId: uuid("vocab_node_id").references(() => materialNodes.id, {
    onDelete: "set null",
  }),
  /**
   * Разобранные группы Lexis вместе с исходниками. Это снимки: дальнейшая
   * правка материалов не меняет уже собранный урок без решения учителя.
   */
  // Старый одиночный объект остаётся в типе только для безопасного
  // чтения уже сохранённых уроков; любое следующее изменение пишет массив.
  lexis: jsonb("lexis").$type<LessonLexisGroupData | LessonLexisGroupData[]>(),
  videoUrl: text("video_url"),
  videoTitle: text("video_title"),
  /** Реплики расшифровки: [{ speaker, text }] в порядке разговора. */
  transcript: jsonb("transcript").$type<{ speaker: string; text: string }[]>(),
  /** Вопросы: после просмотра и после чтения — это разные разговоры. */
  questions: jsonb("questions").$type<{ afterVideo: string[]; afterReading: string[] }>(),
  /** Задания домашки: [{ title, text }]. */
  homework: jsonb("homework").$type<{ title: string; text: string }[]>(),
  /** Сохранённые игры, прикреплённые к этому уроку. */
  activityIds: jsonb("activity_ids").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Урок, закреплённый за учеником.
 *
 * Копия состояния, а не содержимого: сам урок лежит в lesson_units и
 * никогда не меняется. Здесь только то, что нажил конкретный ученик, —
 * какие секции ему открыли, что подсветил учитель, что он ответил.
 *
 * Поэтому один урок раздаётся скольким угодно ученикам, и у каждого
 * своя история, а исходник остаётся исходником.
 */
export const lessonAssignments = pgTable("lesson_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => lessonUnits.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * Какие секции открыты ученику. Словник открыт всегда — с него урок и
   * начинается, остальное учитель открывает по ходу.
   */
  openSections: jsonb("open_sections").$type<string[]>().default([]).notNull(),
  /**
   * Состояние показа во время урока: один ключ текущего фокуса и любое
   * количество независимых жёлтых выделений в диалоге.
   *
   * Цвет фокуса берётся из темы смотрящего. Состояние живёт здесь, а не
   * в заготовке урока: у каждого ученика оно своё.
   */
  highlights: jsonb("highlights").$type<Record<string, string>>().default({}).notNull(),
  /** Ответы ученика по домашке этого урока — его собственная копия. */
  answers: jsonb("answers").$type<Record<string, string>>().default({}).notNull(),
  /** Урок пройден: остаётся в истории в том виде, в каком закончили. */
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Доска ученика.
 *
 * У каждого своя и поначалу пустая. Всё, что учитель туда загрузил,
 * поправил или стёр, остаётся у этого ученика и не видно остальным.
 */
export const studentBoards = pgTable("student_boards", {
  studentId: uuid("student_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Сцена доски целиком, как её отдаёт сама доска. */
  scene: jsonb("scene"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Быстрый словник класса.
 *
 * Пул принадлежит ученику, а не уроку и не учителю: новый ученик всегда
 * начинает с пустого списка, а смена урока его накопленные слова не стирает.
 */
export const classVocabularyWords = pgTable(
  "class_vocabulary_words",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedById: uuid("added_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    english: text("english").notNull(),
    translation: text("translation").notNull(),
    translationLang: vocabLangEnum("translation_lang").notNull().default("UK"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("class_vocabulary_student_created_idx").on(
      table.studentId,
      table.createdAt,
    ),
  ],
);

/**
 * Слово в словнике урока.
 *
 * Урок держит свой список, а не ссылку на материалы: словник в уроке
 * живёт своей жизнью — его чистят, дополняют и перекладывают по
 * категориям под конкретное занятие, и материалы от этого меняться не
 * должны. Наполнить из материалов можно, но это разовое копирование.
 */
export const lessonWords = pgTable("lesson_words", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => lessonUnits.id, { onDelete: "cascade" }),
  /** Nouns, Verbs, Adjectives, Phrases, Idioms — как назвал учитель. */
  category: text("category").notNull().default(""),
  icon: text("icon"),
  word: text("word").notNull(),
  ipaUs: text("ipa_us"),
  ipaUk: text("ipa_uk"),
  translation: text("translation"),
  description: text("description"),
  imageUrl: text("image_url"),
  /** Порядок внутри категории на случай ручной раскладки. */
  sortOrder: integer("sort_order").notNull().default(0),
});
