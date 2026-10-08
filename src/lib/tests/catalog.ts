import type { TestDefinition } from "./types";

export const FIRST_CONDITIONAL: TestDefinition = {
  id: "first-conditional", version: 1, level: "b1", category: "grammar",
  title: "First conditional", subtitle: "First conditional & future time clauses",
  exercises: [
    { id: "exercise-1", number: 1, instruction: "Choose the correct form to complete the sentences below.", questions: [
      { id: "q1", before: "I ", after: " you an answer when I have one.", options: ["will give", "would give", "give"] },
      { id: "q2", before: "I'll call you as soon as I ", after: ".", options: ["will arrive", "I'm arriving", "arrive"] },
      { id: "q3", before: "When you read this email, I ", after: " on a plane to Germany.", options: ["am", "will be", "would be"] },
      { id: "q4", before: "I won't stay unless you ", after: ".", options: ["should stay", "will stay", "stay"] },
      { id: "q5", before: "If you don't find him, you ", after: ".", options: ["should call", "would call", "call"] },
      { id: "q6", before: "He won't stop until he ", after: " what he wants.", options: ["gets", "does get", "will get"] },
      { id: "q7", before: "", after: " if I give you the address?", options: ["do you go", "you will go", "will you go"] },
      { id: "q8", before: "If he knows that you are here, he ", after: " to contact you.", options: ["tries", "does try", "might try"] },
      { id: "q9", before: "When I ", after: " old enough, I'll travel around the world.", options: ["am", "will be", "would be"] },
      { id: "q10", before: "I'll sort this problem once I ", after: " back.", options: ["would be", "will be", "am"] },
    ] },
    { id: "exercise-2", number: 2, instruction: "", questions: [] },
    { id: "exercise-3", number: 3, instruction: "", questions: [] },
  ],
};

export const TEST_CATALOG: TestDefinition[] = [FIRST_CONDITIONAL];
export function findLibraryTest(id: string) { return TEST_CATALOG.find((test) => test.id === id) ?? null; }
