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
import { IconDots, IconEye, IconEyeOff, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { LessonVocab } from "@/components/lessons/lesson-vocab";
import { RegularVoiceRecorder } from "@/components/lessons/regular-voice-recorder";
import {
  InteractiveHomework,
  type InteractiveHomeworkSession,
} from "@/components/lessons/interactive-homework";
import { saveStudentHomeworkPlanAction } from "@/lib/actions/lesson-homework";
import {
  deleteRegularLessonExerciseAction,
  resetRegularLessonExerciseAction,
  saveRegularLessonExerciseAction,
  translateRegularLessonExerciseLanguageAction,
} from "@/lib/actions/lessons";
import {
  regularAttempts,
  effectiveRegularExerciseOverride,
  regularExerciseDeleted,
  regularHomeworkExerciseId,
  regularNoteKey,
  regularNoteVisibleKey,
  regularResponseKey,
  regularSectionKey,
  regularStatus,
  regularStatusKey,
  regularAttemptsKey,
  type RegularExerciseOverride,
  type RegularLessonSection,
} from "@/lib/regular-lesson";
import {
  regularHomeworkShowsWordBank,
  homeworkTranslationLanguage,
  type HomeworkExercise,
  type InteractiveHomeworkPlan,
} from "@/lib/lesson-homework";
import { detectTranslationLang } from "@/lib/translation-lang";
import type { LessonVocabularyReveal, LessonWord } from "@/lib/lesson-unit";
import { cn } from "@/lib/utils";

type HomeworkCandidate = {
  label: string;
  listIndex: number;
  exercise: HomeworkExercise;
  editor: RegularExerciseOverride;
  translation: boolean;
};

const cleanText = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

const sameResponseState = (
  left: Record<string, string>,
  right: Record<string, string>,
) => {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every(
    (key) => left[key] === right[key],
  );
};

const regularSectionSignature = (section: RegularLessonSection | undefined) =>
  section
    ? JSON.stringify([
        section.id,
        section.title,
        section.tone,
        section.studentHtml,
        section.teacherHtml,
        section.defaultOpen,
        section.teacherOnly ?? false,
        section.voiceExercise ?? null,
        section.exerciseOverrides ?? null,
      ])
    : "";

/** Keep polling from replacing an unchanged section object and rewiring its live inputs. */
function useStableRegularSection(section: RegularLessonSection | undefined) {
  const signature = regularSectionSignature(section);
  // The class polls the same JSON payload. Depend on its content signature so
  // an equal refetch does not replace the object that owns the live controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => section, [signature]);
}

function headingBefore(list: Element) {
  let node: Element | null = list.previousElementSibling;
  while (node) {
    if (node.tagName === "H3") return cleanText(node.textContent);
    node = node.previousElementSibling;
  }
  return "";
}

function instructionBefore(list: Element) {
  let node: Element | null = list.previousElementSibling;
  while (node) {
    if (node.matches(".instr")) return cleanText(node.textContent);
    if (node.tagName === "H3") break;
    node = node.previousElementSibling;
  }
  return "";
}

function homeworkInstruction(value: string) {
  return value.replace(/\s*Then press Check\.?\s*$/i, "").trim();
}

/** Extract a real exercise from the imported HTML, never a grammar explanation. */
function homeworkCandidates(
  section: RegularLessonSection,
  state: Record<string, string>,
): HomeworkCandidate[] {
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
    if (regularExerciseDeleted(state, section.id, listIndex + 1)) return;
    const hasBlank = !!list.querySelector(".blank");
    const hasTrueFalse = !!list.querySelector(".tfbox");
    const translation = list.classList.contains("translation-check");
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

    const kind: RegularExerciseOverride["kind"] = hasTrueFalse
      ? "true-false"
      : hasBlank
        ? "fill"
        : "open";
    const parsed = studentItems.map((item, itemIndex) => {
      const clone = item.cloneNode(true) as HTMLElement;
      const controls = [...clone.querySelectorAll(".blank, .tfbox")];
      controls.forEach((control) => {
        if (control.classList.contains("tfbox")) control.remove();
        else control.textContent = "___";
      });
      const prompt = cleanText(clone.textContent)
        .replace(/→\s*___$/, "→ ___")
        .replace(/\s*T\s*\/\s*F\s*$/i, "")
        .trim();
      const answerNodes = [
        ...(teacherItems[itemIndex]?.querySelectorAll(".ans") ?? []),
      ];
      const answers = answerNodes.map((node) => cleanText(node.textContent)).filter(Boolean);
      return {
        id: `${regularHomeworkExerciseId(section.id, listIndex + 1)}-${itemIndex + 1}`,
        prompt,
        answer: answers.length === 1 ? answers[0] : undefined,
        answers,
        answerCount: answers.length,
        blankCount: controls.length,
      };
    });
    const auto = (hasBlank || hasTrueFalse) && parsed.every(
      (item) => item.answer && item.answerCount === 1 && item.blankCount === 1,
    );
    const storedOverride = effectiveRegularExerciseOverride(section, state, listIndex + 1);
    const title = storedOverride?.title || heading || section.title;
    const instruction = homeworkInstruction(storedOverride?.instruction || instructionBefore(list) || (
      kind === "true-false"
        ? "Choose True or False for every sentence."
        : kind === "fill"
          ? "Complete each sentence with the correct answer."
          : "Write a clear answer for every item."
    ));
    const baseEditor: RegularExerciseOverride = storedOverride ?? {
      title,
      instruction,
      kind,
      items: parsed.map((item) => ({ prompt: item.prompt, answers: item.answers })),
    };
    const editor: RegularExerciseOverride = translation
      ? {
          ...baseEditor,
          translationLanguage:
            baseEditor.translationLanguage ??
            detectTranslationLang(baseEditor.items.map((item) => item.prompt)) ??
            "UK",
        }
      : baseEditor;
    const id = regularHomeworkExerciseId(section.id, listIndex + 1);
    const exerciseParsed = editor.items.map((item, itemIndex) => ({
      id: parsed[itemIndex]?.id ?? `${id}-${itemIndex + 1}`,
      prompt: item.prompt,
      answer: item.answers.length === 1 ? item.answers[0] : undefined,
      answers: item.answers,
    }));
    const exercise: HomeworkExercise = translation
      ? {
          id,
          title,
          instruction,
          kind: "translate",
          translationDirection: "to-english",
          translationLanguage: editor.translationLanguage,
          items: exerciseParsed.map(({ id: itemId, prompt, answer }) => ({
            id: itemId,
            prompt: prompt.replace(/\s*(?:→|->)\s*___\s*$/i, "").trim(),
            answer,
          })),
        }
      : auto && editor.kind !== "open"
        ? {
          id,
          title,
          instruction,
          kind: "fill",
          wordBank: regularHomeworkShowsWordBank(
            title,
            instruction,
            exerciseParsed.map((item) => item.prompt),
          )
            ? exerciseParsed.map((item) => item.answer!).filter(
                (answer, index, answers) => answers.indexOf(answer) === index,
              )
            : undefined,
          items: exerciseParsed.map(({ id: itemId, prompt, answer }) => ({
            id: itemId,
            prompt,
            answer,
          })),
          }
        : {
          id,
          title,
          instruction,
          kind: "question-text",
          items: exerciseParsed.map(({ id: itemId, prompt }) => ({ id: itemId, prompt })),
          };
    candidates.push({
      label: title,
      listIndex: listIndex + 1,
      exercise,
      editor,
      translation,
    });
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
  sectionVisibilityBusy = false,
  onSectionVisibilityChange,
  onFocusElement,
  assignmentId,
  responses = {},
  onSaveResponse,
  onSubmitAnswer,
  words = [],
  unitId,
  lessonTitle,
  defaultStudentId,
  vocabularyHighlights = {},
  vocabularyFocus,
  onPickVocabulary,
  showBritish = false,
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
  sectionVisibilityBusy?: boolean;
  onSectionVisibilityChange?: (section: string, open: boolean) => void;
  onFocusElement?: (section: string, elementId: string) => void;
  assignmentId?: string;
  responses?: Record<string, string>;
  onSaveResponse?: (key: string, value: string) => Promise<{ error?: string }>;
  onSubmitAnswer?: (
    sectionId: string,
    responseId: string,
    value: string,
  ) => Promise<{
    error?: string;
    value?: string;
    status?: "correct" | "locked" | null;
    attempts?: string[];
  }>;
  words?: LessonWord[];
  unitId?: string;
  lessonTitle?: string;
  defaultStudentId?: string | null;
  vocabularyHighlights?: Record<string, string>;
  vocabularyFocus?: string | null;
  onPickVocabulary?: (key: string) => void;
  showBritish?: boolean;
  canRevealVocabulary?: boolean;
  vocabularyReveal?: LessonVocabularyReveal;
  onVocabularyRevealChange?: (next: LessonVocabularyReveal) => void;
  homeworkPlan?: InteractiveHomeworkPlan | null;
  homeworkSession?: InteractiveHomeworkSession;
  onFocusHomework?: (elementId: string) => void;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const available = useMemo(
    () => sections.filter((section) => teacher || !section.teacherOnly),
    [sections, teacher],
  );
  const first = available.find((section) => open.includes(regularSectionKey(section.id))) ??
    (teacher || !lockClosed ? available[0] : undefined);
  const [activeId, setActiveId] = useState(first?.id ?? "");
  const [answersFor, setAnswersFor] = useState<string | null>(null);
  const [focused, setFocused] = useState<{ section: string; elementId: string } | null>(null);
  const [responseState, setResponseState] = useState(responses);
  const responseRef = useRef(responses);
  const receivedResponsesRef = useRef(responses);
  const saveResponseRef = useRef(onSaveResponse);
  const submitAnswerRef = useRef(onSubmitAnswer);
  const [candidates, setCandidates] = useState<HomeworkCandidate[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [exerciseMenu, setExerciseMenu] = useState(false);
  const [exerciseDeleteArmed, setExerciseDeleteArmed] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{
    listIndex: number;
    value: RegularExerciseOverride;
  } | null>(null);
  const [exerciseEditScope, setExerciseEditScope] = useState<"STUDENT" | "GLOBAL">("STUDENT");
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [homeworkMessage, setHomeworkMessage] = useState<string | null>(null);
  const [localHomeworkPlan, setLocalHomeworkPlan] = useState(homeworkPlan ?? null);
  const contentRef = useRef<HTMLElement | null>(null);
  const homeworkAvailable = !!localHomeworkPlan && !!homeworkSession;
  const homeworkOpen = open.includes("homework");
  const focusedSectionId = sectionFocus?.section === "homework"
    ? "__homework"
    : sectionFocus?.section
      ? available.find((section) => regularSectionKey(section.id) === sectionFocus.section)?.id
      : null;
  const visibleSections = teacher
    ? available
    : available.filter((section) => {
        const key = regularSectionKey(section.id);
        return open.includes(key) || sectionFocus?.section === key;
      });

  useEffect(() => {
    if (teacher || !lockClosed) return;
    const forced = focusedSectionId;
    const allowed = new Set(visibleSections.map((section) => section.id));
    if (forced === "__homework") allowed.add("__homework");
    if (allowed.has(activeId)) return;
    const next = forced || visibleSections[0]?.id || "";
    const frame = requestAnimationFrame(() => setActiveId(next));
    return () => cancelAnimationFrame(frame);
  }, [activeId, focusedSectionId, lockClosed, teacher, visibleSections]);

  useEffect(() => {
    saveResponseRef.current = onSaveResponse;
    submitAnswerRef.current = onSubmitAnswer;
  }, [onSaveResponse, onSubmitAnswer]);

  useEffect(() => {
    if (sameResponseState(receivedResponsesRef.current, responses)) return;
    receivedResponsesRef.current = responses;
    const frame = requestAnimationFrame(() => {
      const focusedControl = document.activeElement instanceof HTMLElement &&
        contentRef.current?.contains(document.activeElement)
        ? document.activeElement
        : null;
      const focusedKey = focusedControl?.dataset.responseKey;
      const next = { ...responses };
      // A class poll may bring a real change for another answer while this one
      // is still being typed. Keep the unfinished local draft in that case.
      if (focusedKey && responseRef.current[focusedKey] !== undefined) {
        next[focusedKey] = responseRef.current[focusedKey];
      }
      responseRef.current = next;
      setResponseState(next);
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

  const activeCandidate = available.find((section) =>
    section.id === activeId && (
      teacher ||
      !lockClosed ||
      visibleSections.some((visible) => visible.id === section.id)
    )) ?? first;
  const active = useStableRegularSection(activeCandidate);
  const activeKey = active ? regularSectionKey(active.id) : "";
  const showingAnswers = !!active && teacher && answersFor === active.id;
  const nativeVocabulary = !!active && active.tone === "vocab" && words.length > 0;
  const nativeVoice = active?.voiceExercise ?? null;

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

  /* A deleted exercise disappears only from this assignment; the unit HTML stays intact. */
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !active || activeId === "__homework" || nativeVocabulary || nativeVoice) return;
    const lists = [...root.querySelectorAll<HTMLOListElement>("ol")].filter(
      (list) => !list.closest(".key, .key-wrap, .teacher-note"),
    );
    const entries = lists.map((list, index) => ({
      list,
      deleted: regularExerciseDeleted(responseRef.current, active.id, index + 1),
    }));
    const restored: Array<{ node: HTMLElement; display: string; ariaHidden: string | null }> = [];
    const hide = (node: HTMLElement | null) => {
      if (!node || restored.some((entry) => entry.node === node)) return;
      restored.push({ node, display: node.style.display, ariaHidden: node.getAttribute("aria-hidden") });
      node.style.display = "none";
      node.setAttribute("aria-hidden", "true");
    };
    const headingFor = (list: HTMLElement) => {
      let node: Element | null = list.previousElementSibling;
      while (node) {
        if (node.tagName === "H3") return node as HTMLElement;
        node = node.previousElementSibling;
      }
      return null;
    };
    const instructionFor = (list: HTMLElement) => {
      let node: Element | null = list.previousElementSibling;
      while (node) {
        if (node.matches(".instr")) return node as HTMLElement;
        if (node.tagName === "H3" || node.tagName === "OL") return null;
        node = node.previousElementSibling;
      }
      return null;
    };

    entries.filter((entry) => entry.deleted).forEach((entry) => hide(entry.list));
    const headingGroups = new Map<HTMLElement, typeof entries>();
    const instructionGroups = new Map<HTMLElement, typeof entries>();
    entries.forEach((entry) => {
      const heading = headingFor(entry.list);
      if (heading) headingGroups.set(heading, [...(headingGroups.get(heading) ?? []), entry]);
      const instruction = instructionFor(entry.list);
      if (instruction) {
        instructionGroups.set(instruction, [...(instructionGroups.get(instruction) ?? []), entry]);
      }
    });
    headingGroups.forEach((group, heading) => group.every((entry) => entry.deleted) && hide(heading));
    instructionGroups.forEach((group, instruction) =>
      group.every((entry) => entry.deleted) && hide(instruction));

    return () => restored.forEach(({ node, display, ariaHidden }) => {
      node.style.display = display;
      if (ariaHidden === null) node.removeAttribute("aria-hidden");
      else node.setAttribute("aria-hidden", ariaHidden);
    });
  }, [active, activeId, nativeVocabulary, nativeVoice, responseState, showingAnswers]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const next = !active || activeId === "__homework" || nativeVocabulary || nativeVoice
        ? []
        : homeworkCandidates(active, responseRef.current);
      setCandidates(next);
      setCandidateId(next[0]?.exercise.id ?? "");
      setExerciseDeleteArmed(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, activeId, nativeVocabulary, nativeVoice, responseState]);

  /* Add checked controls, attempts and teacher notes to the imported lesson body. */
  useEffect(() => {
    const root = contentRef.current;
    if (
      !root ||
      !active ||
      !saveResponseRef.current ||
      showingAnswers ||
      nativeVocabulary ||
      nativeVoice ||
      activeId === "__homework"
    ) return;
    const cleanups: (() => void)[] = [];
    const save = async (key: string, value: string) => {
      responseRef.current = { ...responseRef.current, [key]: value };
      setResponseState(responseRef.current);
      return saveResponseRef.current?.(key, value);
    };
    const read = (responseId: string) => {
      const key = regularResponseKey(active.id, responseId);
      return responseRef.current[key] ?? "";
    };
    const applyResult = (
      responseKey: string,
      result: {
        value?: string;
        status?: "correct" | "locked" | null;
        attempts?: string[];
      },
    ) => {
      const next = { ...responseRef.current };
      if (result.value !== undefined) next[responseKey] = result.value;
      if (result.attempts) next[regularAttemptsKey(responseKey)] = JSON.stringify(result.attempts);
      if (result.status) next[regularStatusKey(responseKey)] = result.status;
      else delete next[regularStatusKey(responseKey)];
      responseRef.current = next;
      setResponseState(next);
    };
    const addAttempts = (control: HTMLElement, responseKey: string) => {
      const attempts = regularAttempts(responseRef.current, responseKey);
      const status = regularStatus(responseRef.current, responseKey);
      control.classList.toggle("regular-answer-correct", status === "correct");
      control.classList.toggle("regular-answer-locked", status === "locked");
      control.classList.toggle("regular-answer-wrong", attempts.length > 0 && !status);
      const wrap = document.createElement("span");
      wrap.className = "regular-attempt-wrap";
      const dots = document.createElement("button");
      dots.type = "button";
      dots.className = "regular-attempt-dots";
      dots.setAttribute("aria-label", "Show previous attempts");
      for (let index = 0; index < 3; index += 1) {
        const dot = document.createElement("span");
        dot.className = cn(
          "regular-attempt-dot",
          index < attempts.length && "regular-attempt-dot-wrong",
          status === "correct" && index === attempts.length && "regular-attempt-dot-correct",
        );
        dots.append(dot);
      }
      const popover = document.createElement("span");
      popover.className = "regular-attempt-popover";
      popover.hidden = true;
      if (attempts.length > 0) {
        popover.textContent = attempts.map((attempt, index) => `${index + 1}. ${attempt}`).join("\n");
      } else if (status === "correct") {
        popover.textContent = "Correct on the first try";
      } else {
        popover.textContent = "No attempts yet";
      }
      const toggle = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        popover.hidden = !popover.hidden;
      };
      dots.addEventListener("click", toggle);
      wrap.append(dots, popover);
      control.insertAdjacentElement("afterend", wrap);
      cleanups.push(() => {
        dots.removeEventListener("click", toggle);
        wrap.remove();
      });
    };
    const addNote = (item: HTMLElement, itemId: string) => {
      const noteKey = regularNoteKey(active.id, itemId);
      const visibleKey = regularNoteVisibleKey(active.id, itemId);
      const note = responseRef.current[noteKey] ?? "";
      const visible = responseRef.current[visibleKey] === "1";
      if (!teacher && (!visible || !note.trim())) return;
      const wrap = document.createElement(teacher ? "div" : "details");
      wrap.className = "regular-note";
      if (teacher) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "regular-note-toggle";
        button.textContent = note ? "✎ Edit note" : "✎ Add note";
        const panel = document.createElement("div");
        panel.className = "regular-note-panel";
        panel.hidden = true;
        const field = document.createElement("textarea");
        field.rows = 3;
        field.placeholder = "Teacher's note…";
        field.value = note;
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = visible;
        label.append(checkbox, document.createTextNode(" Show to student"));
        panel.append(field, label);
        const toggle = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          panel.hidden = !panel.hidden;
        };
        const saveNote = (event: FocusEvent) => {
          if (event.relatedTarget === checkbox) return;
          void save(noteKey, field.value.trim());
        };
        const saveVisibility = async () => {
          await save(noteKey, field.value.trim());
          await save(visibleKey, checkbox.checked ? "1" : "");
        };
        button.addEventListener("click", toggle);
        field.addEventListener("blur", saveNote);
        checkbox.addEventListener("change", saveVisibility);
        wrap.append(button, panel);
        cleanups.push(() => {
          button.removeEventListener("click", toggle);
          field.removeEventListener("blur", saveNote);
          checkbox.removeEventListener("change", saveVisibility);
          wrap.remove();
        });
      } else {
        const summary = document.createElement("summary");
        summary.textContent = "Teacher's note";
        const text = document.createElement("p");
        text.textContent = note;
        wrap.append(summary, text);
        cleanups.push(() => wrap.remove());
      }
      item.append(wrap);
    };

    [...root.querySelectorAll<HTMLOListElement>("ol")].forEach((list, listIndex) => {
      if (regularExerciseDeleted(responseRef.current, active.id, listIndex + 1)) return;
      let items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
      const override = effectiveRegularExerciseOverride(active, responseRef.current, listIndex + 1);
      if (override) {
        const heading = (() => {
          let node: Element | null = list.previousElementSibling;
          while (node) {
            if (node.tagName === "H3") return node as HTMLElement;
            node = node.previousElementSibling;
          }
          return null;
        })();
        const instruction = (() => {
          let node: Element | null = list.previousElementSibling;
          while (node) {
            if (node.matches(".instr")) return node as HTMLElement;
            if (node.tagName === "H3") return null;
            node = node.previousElementSibling;
          }
          return null;
        })();
        if (heading && override.title) {
          const original = heading.textContent;
          heading.textContent = override.title;
          cleanups.push(() => { heading.textContent = original; });
        }
        if (instruction && override.instruction) {
          const original = instruction.textContent;
          instruction.textContent = override.instruction;
          cleanups.push(() => { instruction.textContent = original; });
        }
        items.forEach((item, itemIndex) => {
          const edited = override.items[itemIndex];
          if (!edited) return;
          const original = item.innerHTML;
          item.textContent = "";
          if (override.kind === "fill") {
            edited.prompt.split(/(___)/g).forEach((part) => {
              if (part === "___") {
                const blank = document.createElement("span");
                blank.className = "blank";
                item.append(blank);
              } else item.append(document.createTextNode(part));
            });
          } else {
            item.append(document.createTextNode(edited.prompt));
            if (override.kind === "true-false") {
              const tf = document.createElement("span");
              tf.className = "tfbox";
              item.append(" ", tf);
            }
          }
          cleanups.push(() => { item.innerHTML = original; });
        });
        items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
      }
      items.forEach((item, itemIndex) => {
        const sentenceCheck = list.classList.contains("sentence-check");
        const blankEntries: {
          control: HTMLElement;
          id: string;
          responseKey: string;
          status: "correct" | "locked" | null;
        }[] = [];
        [...item.querySelectorAll<HTMLElement>(".blank")].forEach((control, controlIndex) => {
          const id = `list-${listIndex + 1}-item-${itemIndex + 1}-blank-${controlIndex + 1}`;
          const responseKey = regularResponseKey(active.id, id);
          const status = regularStatus(responseRef.current, responseKey);
          const storedValue = read(id);
          if (control.textContent !== storedValue) control.textContent = storedValue;
          control.contentEditable = status ? "false" : "true";
          control.setAttribute("role", "textbox");
          control.setAttribute("aria-label", `Answer ${itemIndex + 1}`);
          control.dataset.responseKey = responseKey;
          control.classList.add("regular-answer-control");
          addAttempts(control, responseKey);
          blankEntries.push({ control, id, responseKey, status });
          const input = () => {
            responseRef.current = {
              ...responseRef.current,
              [responseKey]: control.textContent ?? "",
            };
            control.classList.remove("regular-answer-wrong", "regular-answer-wrong-flash");
          };
          control.addEventListener("input", input);
          if (sentenceCheck) {
            cleanups.push(() => control.removeEventListener("input", input));
            return;
          }
          const blur = async () => {
            const value = cleanText(control.textContent);
            if (!value || status || control.dataset.busy === "1") return;
            control.dataset.busy = "1";
            const result = submitAnswerRef.current
              ? await submitAnswerRef.current(active.id, id, value)
              : await saveResponseRef.current!(responseKey, value).then((saved) => ({
                  ...saved,
                  value,
                  status: null as "correct" | "locked" | null,
                  attempts: [] as string[],
                }));
            delete control.dataset.busy;
            if (result.value !== undefined && !result.error) {
              applyResult(responseKey, result);
              if (!result.status) control.classList.add("regular-answer-wrong-flash");
            }
          };
          const keydown = (event: KeyboardEvent) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            control.blur();
          };
          control.addEventListener("blur", blur);
          control.addEventListener("keydown", keydown);
          cleanups.push(() => {
            control.removeEventListener("input", input);
            control.removeEventListener("blur", blur);
            control.removeEventListener("keydown", keydown);
          });
        });

        if (sentenceCheck && blankEntries.length > 0) {
          const submit = async () => {
            if (item.dataset.busy === "1") return;
            if (blankEntries.every((entry) => !!entry.status)) return;
            const missing = blankEntries.find((entry) => !cleanText(entry.control.textContent));
            if (missing) return;
            item.dataset.busy = "1";
            for (const entry of blankEntries) {
              if (entry.status) continue;
              const value = cleanText(entry.control.textContent);
              const result = submitAnswerRef.current
                ? await submitAnswerRef.current(active.id, entry.id, value)
                : await saveResponseRef.current!(entry.responseKey, value).then((saved) => ({
                    ...saved,
                    value,
                    status: null as "correct" | "locked" | null,
                    attempts: [] as string[],
                  }));
              if (result.value !== undefined && !result.error) {
                applyResult(entry.responseKey, result);
                if (result.status !== "correct") {
                  entry.control.classList.add("regular-answer-wrong", "regular-answer-wrong-flash");
                }
              }
            }
            delete item.dataset.busy;
          };
          blankEntries.forEach(({ control }) => {
            const blur = (event: FocusEvent) => {
              const next = event.relatedTarget;
              if (next instanceof Node && item.contains(next)) return;
              void submit();
            };
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
        }

        [...item.querySelectorAll<HTMLElement>(".tfbox")].forEach((control, controlIndex) => {
          const id = `list-${listIndex + 1}-item-${itemIndex + 1}-tf-${controlIndex + 1}`;
          const responseKey = regularResponseKey(active.id, id);
          const status = regularStatus(responseRef.current, responseKey);
          const current = read(id);
          control.textContent = "";
          control.classList.add("regular-answer-control", "regular-tf-control");
          const buttons = (["T", "F"] as const).map((value) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = value;
            button.disabled = !!status;
            button.className = cn(
              "regular-tf-choice",
              current === value && "regular-tf-choice-selected",
            );
            control.append(button);
            return button;
          });
          addAttempts(control, responseKey);
          const choose = async (value: string) => {
            if (status || control.dataset.busy === "1") return;
            control.dataset.busy = "1";
            const result = submitAnswerRef.current
              ? await submitAnswerRef.current(active.id, id, value)
              : await saveResponseRef.current!(responseKey, value).then((saved) => ({
                  ...saved,
                  value,
                  status: null as "correct" | "locked" | null,
                  attempts: [] as string[],
                }));
            delete control.dataset.busy;
            if (result.value !== undefined && !result.error) applyResult(responseKey, result);
          };
          const listeners = buttons.map((button) => {
            const listener = (event: Event) => {
              event.preventDefault();
              event.stopPropagation();
              void choose(button.textContent ?? "");
            };
            button.addEventListener("click", listener);
            return { button, listener };
          });
          cleanups.push(() => {
            listeners.forEach(({ button, listener }) => button.removeEventListener("click", listener));
          });
        });

        if (item.querySelector(".blank, .tfbox")) {
          addNote(item, `list-${listIndex + 1}-item-${itemIndex + 1}`);
        }
      });

      if (!list.querySelector(".blank, .tfbox") && isOpenQuestionList(list, active)) {
        items.forEach((item, itemIndex) => {
          const id = `list-${listIndex + 1}-item-${itemIndex + 1}-open`;
          const field = document.createElement("textarea");
          field.value = read(id);
          field.rows = 2;
          field.placeholder = "Write your answer…";
          field.className = "regular-open-answer";
          const blur = () => { void save(regularResponseKey(active.id, id), field.value.trim()); };
          field.addEventListener("blur", blur);
          item.append(field);
          addNote(item, `list-${listIndex + 1}-item-${itemIndex + 1}`);
          cleanups.push(() => {
            field.removeEventListener("blur", blur);
            field.remove();
          });
        });
      }
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [active, activeId, nativeVocabulary, nativeVoice, responseState, showingAnswers, teacher]);

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
    if (!assignmentId) return;
    const candidate = candidates.find((item) => item.exercise.id === candidateId);
    if (!candidate) return;
    const currentPlan: InteractiveHomeworkPlan = localHomeworkPlan ?? {
      kind: "INTERACTIVE_HOMEWORK_V1",
      title: lessonTitle?.trim() ? `${lessonTitle.trim()} · Homework` : "Homework",
      exercises: [],
    };
    if (currentPlan.exercises.some((exercise) => exercise.id === candidate.exercise.id)) {
      setHomeworkMessage("Это упражнение уже добавлено в домашку.");
      return;
    }
    setHomeworkMessage(null);
    startBusy(async () => {
      const result = await saveStudentHomeworkPlanAction(assignmentId, {
        ...currentPlan,
        exercises: [...currentPlan.exercises, candidate.exercise],
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

  const selectedCandidate = candidates.find((item) => item.exercise.id === candidateId)
    ?? candidates[0]
    ?? null;

  const switchRegularTranslationLanguage = (language: "RU" | "UK") => {
    if (!assignmentId || !active || !selectedCandidate?.translation) return;
    if (homeworkTranslationLanguage(selectedCandidate.exercise) === language) return;
    setExerciseError(null);
    startBusy(async () => {
      const result = await translateRegularLessonExerciseLanguageAction(
        assignmentId,
        active.id,
        selectedCandidate.listIndex,
        language,
      );
      if (result.error || !result.state) {
        setExerciseError(result.error ?? t.interactiveHomework.translationFailed);
        return;
      }
      responseRef.current = result.state;
      setResponseState(result.state);
    });
  };

  const resetExercise = () => {
    if (!assignmentId || !active || !selectedCandidate) return;
    setExerciseError(null);
    setExerciseMenu(false);
    startBusy(async () => {
      const result = await resetRegularLessonExerciseAction(
        assignmentId,
        active.id,
        selectedCandidate.listIndex,
      );
      if (result.error || !result.state) {
        setExerciseError(result.error ?? "Не удалось сбросить упражнение");
        return;
      }
      responseRef.current = result.state;
      setResponseState(result.state);
    });
  };

  const deleteExercise = () => {
    if (!assignmentId || !active || !selectedCandidate) return;
    setExerciseError(null);
    startBusy(async () => {
      const result = await deleteRegularLessonExerciseAction(
        assignmentId,
        active.id,
        selectedCandidate.listIndex,
      );
      if (result.error || !result.state) {
        setExerciseError(result.error ?? "Не удалось удалить упражнение");
        return;
      }
      responseRef.current = result.state;
      setResponseState(result.state);
      setLocalHomeworkPlan(result.homeworkPlan ?? null);
      setExerciseDeleteArmed(false);
      setExerciseMenu(false);
      setHomeworkMessage(null);
      router.refresh();
    });
  };

  const openExerciseEditor = () => {
    if (!selectedCandidate) return;
    setExerciseError(null);
    setExerciseMenu(false);
    setExerciseEditScope("STUDENT");
    setEditingExercise({
      listIndex: selectedCandidate.listIndex,
      value: {
        ...selectedCandidate.editor,
        items: selectedCandidate.editor.items.map((item) => ({
          prompt: item.prompt,
          answers: [...item.answers],
        })),
      },
    });
  };

  const saveExercise = () => {
    if (!assignmentId || !active || !editingExercise) return;
    setExerciseError(null);
    startBusy(async () => {
      const result = await saveRegularLessonExerciseAction(
        assignmentId,
        active.id,
        editingExercise.listIndex,
        editingExercise.value,
        exerciseEditScope,
      );
      if (result.error || !result.state) {
        setExerciseError(result.error ?? "Не удалось сохранить упражнение");
        return;
      }
      responseRef.current = result.state;
      setResponseState(result.state);
      setEditingExercise(null);
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t.lessonUnits.lessonSections}>
        {visibleSections.map((section) => {
          const key = regularSectionKey(section.id);
          const opened = open.includes(key);
          const forced = sectionFocus?.section === key;
          const disabled = lockClosed && !opened && !forced;
          return (
            <div
              key={section.id}
              className={cn(
                "flex h-10 shrink-0 overflow-hidden rounded-xl transition",
                activeId === section.id
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-2 text-muted hover:text-content",
                disabled && "cursor-not-allowed opacity-55",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setActiveId(section.id)}
                className="flex min-w-0 items-center px-3 text-[12px] font-bold"
              >
                {section.title}
              </button>
              {teacher && onSectionVisibilityChange && (
                <button
                  type="button"
                  disabled={sectionVisibilityBusy}
                  onClick={() => onSectionVisibilityChange(key, !opened)}
                  title={opened ? t.lessonUnits.hideFromStudent : t.lessonUnits.openForStudent}
                  aria-label={`${opened ? t.lessonUnits.hideFromStudent : t.lessonUnits.openForStudent}: ${section.title}`}
                  aria-pressed={opened}
                  className={cn(
                    "flex w-9 items-center justify-center border-l transition disabled:opacity-40",
                    activeId === section.id
                      ? "border-white/20 text-white/90 hover:bg-white/10"
                      : "border-line text-accent hover:bg-accent-soft",
                  )}
                >
                  {opened
                    ? <IconEye className="h-3.5 w-3.5" />
                    : <IconEyeOff className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          );
        })}
        {homeworkAvailable && (teacher || homeworkOpen || sectionFocus?.section === "homework") && (
          <div
            className={cn(
              "flex h-10 shrink-0 overflow-hidden rounded-xl transition",
              activeId === "__homework"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface-2 text-muted hover:text-content",
            )}
          >
            <button
              type="button"
              disabled={lockClosed && !homeworkOpen && sectionFocus?.section !== "homework"}
              onClick={() => setActiveId("__homework")}
              className="px-3 text-[12px] font-bold"
            >
              {t.lessonUnits.secHomework}
            </button>
            {teacher && onSectionVisibilityChange && (
              <button
                type="button"
                disabled={sectionVisibilityBusy}
                onClick={() => onSectionVisibilityChange("homework", !open.includes("homework"))}
                title={open.includes("homework") ? t.lessonUnits.hideFromStudent : t.lessonUnits.openForStudent}
                aria-label={`${open.includes("homework") ? t.lessonUnits.hideFromStudent : t.lessonUnits.openForStudent}: ${t.lessonUnits.secHomework}`}
                aria-pressed={open.includes("homework")}
                className={cn(
                  "flex w-9 items-center justify-center border-l transition disabled:opacity-40",
                  activeId === "__homework"
                    ? "border-white/20 text-white/90 hover:bg-white/10"
                    : "border-line text-accent hover:bg-accent-soft",
                )}
              >
                {open.includes("homework")
                  ? <IconEye className="h-3.5 w-3.5" />
                  : <IconEyeOff className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </nav>

      {activeId === "__homework" &&
      (teacher || !lockClosed || homeworkOpen || sectionFocus?.section === "homework") &&
      localHomeworkPlan && homeworkSession ? (
        <div data-lesson-highlight-scope="regular-homework">
          <InteractiveHomework
            plan={localHomeworkPlan}
            session={homeworkSession}
            focusId={sectionFocus?.section === "homework" ? sectionFocus.elementId : null}
            onFocus={onFocusHomework}
          />
        </div>
      ) : active ? (
        <article
          ref={contentRef}
          data-lesson-highlight-scope={`regular-${active.id}`}
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
            <div className="flex flex-wrap items-center gap-2" data-no-lesson-highlight>
              {teacher && candidates.length > 0 && assignmentId && (
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
                  {selectedCandidate?.translation && (
                    <div
                      className="flex rounded-xl bg-surface p-1 ring-1 ring-line"
                      title={`DeepL · ${t.interactiveHomework.translationLanguage}`}
                    >
                      {(["UK", "RU"] as const).map((language) => {
                        const current = homeworkTranslationLanguage(selectedCandidate.exercise);
                        return (
                          <button
                            key={language}
                            type="button"
                            disabled={busy || current === language}
                            onClick={() => switchRegularTranslationLanguage(language)}
                            className={cn(
                              "h-7 rounded-lg px-2.5 text-[10px] font-black transition disabled:cursor-default",
                              current === language
                                ? "bg-accent text-white"
                                : "text-muted hover:text-accent disabled:opacity-55",
                            )}
                          >
                            {language === "UK" ? "UA" : "RU"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Exercise options"
                      aria-expanded={exerciseMenu}
                      onClick={() => setExerciseMenu((value) => !value)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition hover:border-accent hover:text-accent"
                    >
                      <IconDots className="h-4 w-4" />
                    </button>
                    {exerciseMenu && (
                      <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={openExerciseEditor}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-content hover:bg-surface-2"
                        >
                          <IconPencil className="h-4 w-4 text-accent" />
                          Edit exercise
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={resetExercise}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <span aria-hidden="true" className="text-base leading-none">↺</span>
                          Reset answers
                        </button>
                        {!exerciseDeleteArmed ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setExerciseDeleteArmed(true)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <IconTrash className="h-4 w-4" />
                            {t.lessonUnits.deleteStudentExercise}
                          </button>
                        ) : (
                          <div className="m-1 rounded-xl bg-rose-50 p-2.5 text-rose-700">
                            <p className="text-[11px] font-semibold leading-relaxed">
                              {t.lessonUnits.deleteStudentExerciseHint}
                            </p>
                            <div className="mt-2 flex gap-1.5">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={deleteExercise}
                                className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
                              >
                                {t.lessonUnits.confirmDeleteStudentExercise}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setExerciseDeleteArmed(false)}
                                className="rounded-lg bg-surface px-2.5 py-1.5 text-[11px] font-bold text-content ring-1 ring-line"
                              >
                                {t.interactiveHomework.cancel}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {teacher && active.teacherHtml !== active.studentHtml && !active.teacherOnly && !nativeVocabulary && !nativeVoice && (
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
          {exerciseError && !editingExercise && (
            <p className="mx-4 mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 sm:mx-6">
              {exerciseError}
            </p>
          )}
          {nativeVocabulary ? (
            <div className="p-4 sm:p-6">
              <LessonVocab
                words={words}
                highlights={vocabularyHighlights}
                focus={vocabularyFocus}
                onPick={onPickVocabulary}
                showBritish={showBritish}
                canReveal={canRevealVocabulary}
                revealState={vocabularyReveal}
                onRevealStateChange={onVocabularyRevealChange}
                teacher={teacher}
                unitId={unitId}
                lessonTitle={lessonTitle}
                defaultStudentId={defaultStudentId}
              />
            </div>
          ) : nativeVoice && assignmentId ? (
            <RegularVoiceRecorder
              assignmentId={assignmentId}
              sectionId={active.id}
              exercise={nativeVoice}
              teacher={teacher}
              state={responseState}
              onStateChange={(next) => {
                responseRef.current = next;
                setResponseState(next);
              }}
              onSaveResponse={onSaveResponse}
            />
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
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-surface-2 px-5 py-10 text-center text-sm font-semibold text-muted">
          {t.lessonUnits.waitingForSection}
        </div>
      )}

      {editingExercise && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => event.target === event.currentTarget && setEditingExercise(null)}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">
                  {locale === "ru" ? "Редактор упражнения" : locale === "uk" ? "Редактор вправи" : "Exercise editor"}
                </p>
                <h3 className="mt-1 text-xl font-black text-content">Edit exercise</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExercise(null)}
                className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted hover:text-content"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <label className="grid gap-1.5 text-xs font-bold text-muted">
                Exercise title
                <input
                  value={editingExercise.value.title}
                  onChange={(event) => setEditingExercise((current) => current && ({
                    ...current,
                    value: { ...current.value, title: event.target.value },
                  }))}
                  className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-content outline-none focus:border-accent"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-muted">
                Exercise type
                <select
                  value={editingExercise.value.kind}
                  onChange={(event) => setEditingExercise((current) => current && ({
                    ...current,
                    value: {
                      ...current.value,
                      kind: event.target.value as RegularExerciseOverride["kind"],
                    },
                  }))}
                  className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-content outline-none focus:border-accent"
                >
                  <option value="fill">Fill in the gaps</option>
                  <option value="true-false">True / False</option>
                  <option value="open">Personal questions</option>
                </select>
              </label>
            </div>

            <label className="mt-4 grid gap-1.5 text-xs font-bold text-muted">
              Instruction
              <textarea
                rows={2}
                value={editingExercise.value.instruction}
                onChange={(event) => setEditingExercise((current) => current && ({
                  ...current,
                  value: { ...current.value, instruction: event.target.value },
                }))}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-content outline-none focus:border-accent"
              />
            </label>

            <div className="mt-5 grid gap-3">
              {editingExercise.value.items.map((item, itemIndex) => (
                <div key={itemIndex} className="rounded-2xl border border-line bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-black text-accent">
                      {itemIndex + 1}
                    </span>
                    <textarea
                      rows={2}
                      value={item.prompt}
                      onChange={(event) => setEditingExercise((current) => {
                        if (!current) return current;
                        const items = current.value.items.map((entry, index) =>
                          index === itemIndex ? { ...entry, prompt: event.target.value } : entry,
                        );
                        return { ...current, value: { ...current.value, items } };
                      })}
                      className="min-h-16 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-content outline-none focus:border-accent"
                    />
                  </div>
                  {editingExercise.value.kind !== "open" && (
                    <label className="mt-2 grid gap-1 pl-9 text-[11px] font-bold text-muted">
                      {editingExercise.value.kind === "fill"
                        ? "Correct answer for every ___ (separate multiple blanks with |)"
                        : "Correct answer: T or F"}
                      <input
                        value={item.answers.join(" | ")}
                        onChange={(event) => setEditingExercise((current) => {
                          if (!current) return current;
                          const answers = event.target.value.split("|").map((value) => value.trim());
                          const items = current.value.items.map((entry, index) =>
                            index === itemIndex ? { ...entry, answers } : entry,
                          );
                          return { ...current, value: { ...current.value, items } };
                        })}
                        className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-content outline-none focus:border-accent"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {exerciseError && (
              <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">
                {exerciseError}
              </p>
            )}
            <fieldset className="mt-5 grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                {locale === "ru" ? "Сохранить изменения" : locale === "uk" ? "Зберегти зміни" : "Save changes"}
              </legend>
              <label className={cn(
                "cursor-pointer rounded-2xl border p-3 transition",
                exerciseEditScope === "STUDENT" ? "border-accent bg-accent-soft" : "border-line bg-surface-2",
              )}>
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="regular-exercise-edit-scope"
                    checked={exerciseEditScope === "STUDENT"}
                    onChange={() => setExerciseEditScope("STUDENT")}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-black text-content">
                      {locale === "ru" ? "Только этому ученику" : locale === "uk" ? "Лише цьому учневі" : "This student only"}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {locale === "ru" ? "Личная копия урока." : locale === "uk" ? "Особиста копія уроку." : "Only this assigned copy."}
                    </span>
                  </span>
                </span>
              </label>
              <label className={cn(
                "cursor-pointer rounded-2xl border p-3 transition",
                exerciseEditScope === "GLOBAL" ? "border-accent bg-accent-soft" : "border-line bg-surface-2",
              )}>
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="regular-exercise-edit-scope"
                    checked={exerciseEditScope === "GLOBAL"}
                    onChange={() => setExerciseEditScope("GLOBAL")}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-black text-content">
                      {locale === "ru" ? "Сохранить везде" : locale === "uk" ? "Зберегти всюди" : "Save everywhere"}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {locale === "ru" ? "Шаблон и все копии учеников." : locale === "uk" ? "Шаблон і всі копії учнів." : "Template and every assigned copy."}
                    </span>
                  </span>
                </span>
              </label>
            </fieldset>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingExercise(null)}
                className="h-11 rounded-xl border border-line px-4 text-sm font-bold text-content"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveExercise}
                className="h-11 rounded-xl bg-accent px-5 text-sm font-black text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
