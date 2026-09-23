import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
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
  /** Цифры за весь период показывать как приблизительные. */
  statsApproximate: boolean("stats_approximate").notNull().default(false),
  /** Что из баланса и статистики видит сам ученик. */
  showBalance: boolean("show_balance").notNull().default(true),
  showPackageSize: boolean("show_package_size").notNull().default(true),
  showTotalLessons: boolean("show_total_lessons").notNull().default(true),
  showExpiry: boolean("show_expiry").notNull().default(true),
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
  /**
   * Исходный текст правила, как его вставили. Нужен, чтобы «Редактировать»
   * показывало не только разобранные блоки, но и то, что вводили.
   */
  sourceText: text("source_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
export type RuleBlock =
  | { type: "heading"; text: string }
  | { type: "callout"; label?: string; text: string; tone?: "key" | "warn" | "tip" | "info" }
  | { type: "formula"; text: string }
  | { type: "text"; text: string }
  | { type: "example"; en: string; tr?: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

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
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
