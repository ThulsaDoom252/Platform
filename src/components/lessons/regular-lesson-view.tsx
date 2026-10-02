"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { IconEyeOff, IconPlus } from "@/components/icons";
import { LessonVocab } from "@/components/lessons/lesson-vocab";
import {
  InteractiveHomework,
  type InteractiveHomeworkSession,
} from "@/components/lessons/interactive-homework";
import { saveStudentHomeworkPlanAction } from "@/lib/actions/lesson-homework";
import {
  regularResponseKey,
  regularSectionKey,
  type RegularLessonSection,
} from "@/lib/regular-lesson";
import type { HomeworkExercise, InteractiveHomeworkPlan } from "@/lib/lesson-homework";
import type { LessonVocabularyReveal, LessonWord } from "@/lib/lesson-unit";
import { cn } from "@/lib/utils";

type HomeworkCandidate = { label: string; exercise: HomeworkExercise };

const cleanText = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

const safeId = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52);

function headingBefore(list: Element) {
  let node: Element | null = list.previousElementSibling;
  while (node) {
    if (node.tagName === "H3") return cleanText(node.textContent);
    node = node.previousElementSibling;
  }
  return "";
}

/** Extract a real exercise from the imported HTML, never a grammar explanation. */
function homeworkCandidates(section: RegularLessonSection): HomeworkCandidate[] {
  if (typeof DOMParser === "undefined") return [];
  const parser = new DOMParser();
  const studentDoc = parser.parseFromString(`<main>${section.studentHtml}</main>`, "text/html");
  const teacherDoc = parser.parseFromString(`<main>${section.teacherHtml}</main>`, "text/html");
  const studentLists = [...studentDoc.querySelectorAll("ol")];
  const teacherLists = [...teacherDoc.querySelectorAll("ol")].filter(
    (list) => !list.closest(".key, .key-wrap, .teacher-note"),
  );
  const candidates: HomeworkCandidate[] = [];

  studentLists.forEach((list, listIndex) => {
    const hasBlank = !!list.querySelector(".blank");
    const hasTrueFalse = !!list.querySelector(".tfbox");
    const heading = headingBefore(list);
    const isOpenQuestions = /questions|small talk|personal questions/i.test(
      `${heading} ${section.title}`,
    );
    if (!hasBlank && !hasTrueFalse && !isOpenQuestions) return;

    const studentItems = [...list.querySelectorAll(":scope > li")];
    const teacherItems = [
      ...(teacherLists[listIndex]?.querySelectorAll(":scope > li") ?? []),
    ];
    if (studentItems.length === 0) return;

    const parsed = studentItems.map((item, itemIndex) => {
      const clone = item.cloneNode(true) as HTMLElement;
      const controls = [...clone.querySelectorAll(".blank, .tfbox")];
      controls.forEach((control) => { control.textContent = "___"; });
      const prompt = cleanText(clone.textContent).replace(/→\s*___$/, "→ ___");
      const answerNodes = [
        ...(teacherItems[itemIndex]?.querySelectorAll(".ans") ?? []),
      ];
      const answers = answerNodes.map((node) => cleanText(node.textContent)).filter(Boolean);
      return {
        id: `regular-${safeId(section.id)}-${listIndex + 1}-${itemIndex + 1}`,
        prompt,
        answer: answers.length === 1 ? answers[0] : undefined,
        answerCount: answers.length,
        blankCount: controls.length,
      };
    });
    const auto = (hasBlank || hasTrueFalse) && parsed.every(
      (item) => item.answer && item.answerCount === 1 && item.blankCount === 1,
    );
    const title = heading || section.title;
    const id = `regular-${safeId(section.id)}-${listIndex + 1}`;
    const exercise: HomeworkExercise = auto
      ? {
          id,
          title,
          instruction: hasTrueFalse
            ? "Choose True or False for every sentence."
            : "Complete each sentence with the correct answer.",
          kind: "fill",
          wordBank: parsed.map((item) => item.answer!).filter(
            (answer, index, answers) => answers.indexOf(answer) === index,
          ),
          items: parsed.map(({ id: itemId, prompt, answer }) => ({
            id: itemId,
            prompt,
            answer,
          })),
        }
      : {
          id,
          title,
          instruction: "Write a clear answer for every item.",
          kind: "question-text",
          items: parsed.map(({ id: itemId, prompt }) => ({ id: itemId, prompt })),
        };
    candidates.push({ label: title, exercise });
  });

  return candidates;
}

function isOpenQuestionList(list: HTMLOListElement, section: RegularLessonSection) {
  return /questions|small talk|personal questions/i.test(
    `${headingBefore(list)} ${section.title}`,
  );
}

export function RegularLessonView({
  sections,
  teacher,
  open,
  lockClosed = false,
  sectionFocus,
  onFocusElement,
  assignmentId,
  responses = {},
  onSaveResponse,
  words = [],
  unitId,
  lessonTitle,
  defaultStudentId,
  vocabularyHighlights = {},
  vocabularyFocus,
  onPickVocabulary,
  canRevealVocabulary = true,
  vocabularyReveal,
  onVocabularyRevealChange,
  homeworkPlan,
  homeworkSession,
  onFocusHomework,
}: {
  sections: RegularLessonSection[];
  teacher: boolean;
  open: string[];
  lockClosed?: boolean;
  sectionFocus?: { section: string; elementId?: string | null; at: string } | null;
  onFocusElement?: (section: string, elementId: string) => void;
  assignmentId?: string;
  responses?: Record<string, string>;
  onSaveResponse?: (key: string, value: string) => Promise<{ error?: string }>;
  words?: LessonWord[];
  unitId?: string;
  lessonTitle?: string;
  defaultStudentId?: string | null;
  vocabularyHighlights?: Record<string, string>;
  vocabularyFocus?: string | null;
  onPickVocabulary?: (key: string) => void;
  canRevealVocabulary?: boolean;
  vocabularyReveal?: LessonVocabularyReveal;
  onVocabularyRevealChange?: (next: LessonVocabularyReveal) => void;
  homeworkPlan?: InteractiveHomeworkPlan | null;
  homeworkSession?: InteractiveHomeworkSession;
  onFocusHomework?: (elementId: string) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const available = useMemo(
    () => sections.filter((section) => teacher || !section.teacherOnly),
    [sections, teacher],
  );
  const first =
    available.find((section) => teacher || open.includes(regularSectionKey(section.id))) ??
    available[0];
  const [activeId, setActiveId] = useState(first?.id ?? "");
  const [answersFor, setAnswersFor] = useState<string | null>(null);
  const [focused, setFocused] = useState<{ section: string; elementId: string } | null>(null);
  const [responseState, setResponseState] = useState(responses);
  const responseRef = useRef(responses);
  const [candidates, setCandidates] = useState<HomeworkCandidate[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [homeworkMessage, setHomeworkMessage] = useState<string | null>(null);
  const [localHomeworkPlan, setLocalHomeworkPlan] = useState(homeworkPlan ?? null);
  const contentRef = useRef<HTMLElement | null>(null);
  const homeworkAvailable = !!localHomeworkPlan && !!homeworkSession;
  const homeworkOpen = teacher || open.includes("homework");
  const focusedSectionId = sectionFocus?.section === "homework"
    ? "__homework"
    : sectionFocus?.section
      ? available.find((section) => regularSectionKey(section.id) === sectionFocus.section)?.id
      : null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      responseRef.current = responses;
      setResponseState(responses);
    });
    return () => cancelAnimationFrame(frame);
  }, [responses]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLocalHomeworkPlan(homeworkPlan ?? null));
    return () => cancelAnimationFrame(frame);
  }, [homeworkPlan]);

  useEffect(() => {
    if (!sectionFocus?.section || !focusedSectionId) return;
    const frame = requestAnimationFrame(() => {
      setActiveId(focusedSectionId);
      setFocused(
        sectionFocus.elementId && focusedSectionId !== "__homework"
          ? { section: sectionFocus.section, elementId: sectionFocus.elementId }
          : null,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedSectionId, sectionFocus?.at, sectionFocus?.elementId, sectionFocus?.section]);

  const active = available.find((section) => section.id === activeId) ?? first;
  const activeKey = active ? regularSectionKey(active.id) : "";
  const showingAnswers = !!active && teacher && answersFor === active.id;
  const nativeVocabulary = !!active && active.tone === "vocab" && words.length > 0;

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll(".regular-lesson-focused").forEach((node) => {
      node.classList.remove("regular-lesson-focused");
    });
    if (!focused || focused.section !== activeKey) return;
    const node = root.querySelector<HTMLElement>(`[data-focus-id="${focused.elementId}"]`);
    if (!node) return;
    node.classList.add("regular-lesson-focused");
    if (!teacher) node.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => node.classList.remove("regular-lesson-focused");
  }, [activeKey, focused, teacher]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const next = !active || activeId === "__homework" || nativeVocabulary
        ? []
        : homeworkCandidates(active);
      setCandidates(next);
      setCandidateId(next[0]?.exercise.id ?? "");
    });
    return () => cancelAnimationFrame(frame);
  }, [active, activeId, nativeVocabulary]);

  /* Add saved controls to the old lesson body without duplicating its design. */
  useEffect(() => {
    const root = contentRef.current;
    if (
      !root ||
      !active ||
      !onSaveResponse ||
      showingAnswers ||
      nativeVocabulary ||
      activeId === "__homework"
    ) return;
    const cleanups: (() => void)[] = [];
    const save = (responseId: string, value: string) => {
      const key = regularResponseKey(active.id, responseId);
      responseRef.current = { ...responseRef.current, [key]: value };
      setResponseState(responseRef.current);
      void onSaveResponse?.(key, value);
    };
    const read = (responseId: string) =>
      responseRef.current[regularResponseKey(active.id, responseId)] ?? "";

    [...root.querySelectorAll<HTMLOListElement>("ol")].forEach((list, listIndex) => {
      const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
      items.forEach((item, itemIndex) => {
        [...item.querySelectorAll<HTMLElement>(".blank")].forEach((control, controlIndex) => {
          const id = `list-${listIndex + 1}-item-${itemIndex + 1}-blank-${controlIndex + 1}`;
          control.textContent = read(id);
          control.contentEditable = "true";
          control.setAttribute("role", "textbox");
          control.setAttribute("aria-label", `Answer ${itemIndex + 1}`);
          control.classList.add("regular-answer-control");
          const blur = () => save(id, cleanText(control.textContent));
          const keydown = (event: KeyboardEvent) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            control.blur();
          };
          control.addEventListener("blur", blur);
          control.addEventListener("keydown", keydown);
          cleanups.push(() => {
            control.removeEventListener("blur", blur);
            control.removeEventListener("keydown", keydown);
          });
        });

        [...item.querySelectorAll<HTMLElement>(".tfbox")].forEach((control, controlIndex) => {
          const id = `list-${listIndex + 1}-item-${itemIndex + 1}-tf-${controlIndex + 1}`;
          const render = () => { control.textContent = read(id) || "T / F"; };
          render();
          control.setAttribute("role", "button");
          control.setAttribute("tabindex", "0");
          control.classList.add("regular-answer-control", "regular-tf-control");
          const choose = () => {
            const current = read(id);
            save(id, current === "T" ? "F" : "T");
            render();
          };
          const keydown = (event: KeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            choose();
          };
          control.addEventListener("click", choose);
          control.addEventListener("keydown", keydown);
          cleanups.push(() => {
            control.removeEventListener("click", choose);
            control.removeEventListener("keydown", keydown);
          });
        });
      });

      if (!list.querySelector(".blank, .tfbox") && isOpenQuestionList(list, active)) {
        items.forEach((item, itemIndex) => {
          const id = `list-${listIndex + 1}-item-${itemIndex + 1}-open`;
          const field = document.createElement("textarea");
          field.value = read(id);
          field.rows = 2;
          field.placeholder = "Write your answer…";
          field.className = "regular-open-answer";
          const blur = () => save(id, field.value.trim());
          field.addEventListener("blur", blur);
          item.append(field);
          cleanups.push(() => {
            field.removeEventListener("blur", blur);
            field.remove();
          });
        });
      }
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [active, activeId, nativeVocabulary, onSaveResponse, responseState, showingAnswers]);

  if (!active && activeId !== "__homework") return null;

  const chooseElement = (elementId: string) => {
    if (!onFocusElement || !active) return;
    setFocused({ section: activeKey, elementId });
    onFocusElement(activeKey, elementId);
  };

  const chooseFromBody = (event: MouseEvent<HTMLDivElement>) => {
    if (!onFocusElement || !(event.target instanceof Element)) return;
    if (event.target.closest("input, textarea, select, button, [contenteditable='true']")) return;
    const node = event.target.closest<HTMLElement>("[data-focus-id]");
    if (!node || !event.currentTarget.contains(node)) return;
    const elementId = node.dataset.focusId;
    if (elementId) chooseElement(elementId);
  };

  const addToHomework = () => {
    if (!assignmentId || !localHomeworkPlan) return;
    const candidate = candidates.find((item) => item.exercise.id === candidateId);
    if (!candidate) return;
    if (localHomeworkPlan.exercises.some((exercise) => exercise.id === candidate.exercise.id)) {
      setHomeworkMessage("Это упражнение уже добавлено в домашку.");
      return;
    }
    setHomeworkMessage(null);
    startBusy(async () => {
      const result = await saveStudentHomeworkPlanAction(assignmentId, {
        ...localHomeworkPlan,
        exercises: [...localHomeworkPlan.exercises, candidate.exercise],
      });
      if (result.error || !result.plan) {
        setHomeworkMessage(result.error ?? "Не удалось добавить упражнение");
        return;
      }
      setLocalHomeworkPlan(result.plan);
      setHomeworkMessage("Упражнение добавлено в домашку этого ученика.");
      router.refresh();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t.lessonUnits.lessonSections}>
        {available.map((section) => {
          const key = regularSectionKey(section.id);
          const opened = teacher || open.includes(key);
          const forced = sectionFocus?.section === key;
          const disabled = lockClosed && !opened && !forced;
          return (
            <button
              key={section.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setActiveId(section.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold transition",
                activeId === section.id
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-2 text-muted hover:text-content",
                disabled && "cursor-not-allowed opacity-55",
              )}
            >
              {disabled && <IconEyeOff className="h-3.5 w-3.5" />}
              {section.title}
            </button>
          );
        })}
        {homeworkAvailable && (homeworkOpen || sectionFocus?.section === "homework") && (
          <button
            type="button"
            disabled={lockClosed && !homeworkOpen && sectionFocus?.section !== "homework"}
            onClick={() => setActiveId("__homework")}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold transition",
              activeId === "__homework"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface-2 text-muted hover:text-content",
            )}
          >
            {t.lessonUnits.secHomework}
          </button>
        )}
      </nav>

      {activeId === "__homework" && localHomeworkPlan && homeworkSession ? (
        <InteractiveHomework
          plan={localHomeworkPlan}
          session={homeworkSession}
          focusId={sectionFocus?.section === "homework" ? sectionFocus.elementId : null}
          onFocus={onFocusHomework}
        />
      ) : active ? (
        <article
          ref={contentRef}
          className={cn(
            "regular-lesson-content",
            `regular-tone-${active.tone}`,
            onFocusElement && "regular-lesson-can-focus",
          )}
        >
          <div className="regular-lesson-heading">
            <h2
              data-focus-id="heading"
              onClick={() => chooseElement("heading")}
              title={onFocusElement ? t.lessonUnits.focusElement : undefined}
            >
              {active.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {teacher && candidates.length > 0 && localHomeworkPlan && assignmentId && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {candidates.length > 1 && (
                    <select
                      value={candidateId}
                      onChange={(event) => setCandidateId(event.target.value)}
                      className="h-9 max-w-56 rounded-xl border border-line bg-surface px-2 text-[11px] font-bold text-content outline-none"
                    >
                      {candidates.map((candidate) => (
                        <option key={candidate.exercise.id} value={candidate.exercise.id}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addToHomework}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-[11px] font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    Add to homework
                  </button>
                </div>
              )}
              {teacher && active.teacherHtml !== active.studentHtml && !active.teacherOnly && !nativeVocabulary && (
                <button
                  type="button"
                  onClick={() => setAnswersFor(showingAnswers ? null : active.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-xl px-3 text-[12px] font-bold transition",
                    showingAnswers
                      ? "bg-emerald-500 text-white"
                      : "bg-surface text-accent ring-1 ring-line hover:ring-accent",
                  )}
                >
                  {showingAnswers ? t.lessonUnits.hideAnswers : t.lessonUnits.showAnswers}
                </button>
              )}
            </div>
          </div>
          {homeworkMessage && (
            <p className="mx-4 mt-3 rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent sm:mx-6">
              {homeworkMessage}
            </p>
          )}
          {nativeVocabulary ? (
            <div className="p-4 sm:p-6">
              <LessonVocab
                words={words}
                highlights={vocabularyHighlights}
                focus={vocabularyFocus}
                onPick={onPickVocabulary}
                canReveal={canRevealVocabulary}
                revealState={vocabularyReveal}
                onRevealStateChange={onVocabularyRevealChange}
                teacher={teacher}
                unitId={unitId}
                lessonTitle={lessonTitle}
                defaultStudentId={defaultStudentId}
              />
            </div>
          ) : (
            <div
              className="regular-lesson-body"
              onClick={chooseFromBody}
              dangerouslySetInnerHTML={{
                __html: showingAnswers || active.teacherOnly
                  ? active.teacherHtml
                  : active.studentHtml,
              }}
            />
          )}
        </article>
      ) : null}
    </div>
  );
}
