import type { TestCatalogEntry } from "./types";
import { SECOND_CONDITIONAL } from "./second-conditional";
export { SECOND_CONDITIONAL } from "./second-conditional";

export const FIRST_CONDITIONAL: TestCatalogEntry = {
  id: "first-conditional", version: 2, level: "b1", category: "grammar",
  title: "First conditional", subtitle: "First conditional & future time clauses",
  cover: { src: "/images/tests/first-conditional-v1.webp", width: 1200, height: 600,
    alt: "B1 first conditional: When I find the third little pig's house, I'll have a big barbecue." },
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
    { id: "exercise-2", number: 2, instruction: "Choose the correct form for each gap below. Where indicated, choose TWO correct options.", questions: [
      { id: "q1", before: "If you aren't careful, you ", after: " hurt.", options: ["might get", "get", "will get"], kind: "multiple", selectionCount: 2 },
      { id: "q2", before: "What will happen if the parachute ", after: "?", options: ["doesn't open", "won't open", "might not open"] },
      { id: "q3", before: "I won't sign up for the dancing competition unless Jack ", after: " my partner.", options: ["is", "must be", "will be"] },
      { id: "q4", before: "When you ", after: " Tom, tell him I want to see him.", options: ["will see", "see", "might see"] },
      { id: "q5", before: "If they make a good offer, I ", after: " the house.", options: ["should buy", "buy", "will buy"], kind: "multiple", selectionCount: 2 },
      { id: "q6", before: "If the people don't come, we ", after: " to cancel the party.", options: ["might have", "have", "'ll have"], kind: "multiple", selectionCount: 2 },
      { id: "q7", before: "Please, can you close the windows before you ", after: ".", options: ["must leave", "leave", "will leave"] },
      { id: "q8", before: "He'll try to get money from you if he ", after: " you've won the lottery.", options: ["knows", "will know", "would know"] },
      { id: "q9", before: "Before you say anything, ", after: ".", options: ["let me explain", "you must listen to me", "you listen to me"], kind: "multiple", selectionCount: 2 },
      { id: "q10", before: "He won't ask for help unless it ", after: " absolutely necessary.", options: ["is", "will be", "might be"] },
    ] },
    { id: "exercise-3", number: 3, instruction: "Fill in the gaps with the verbs in brackets in the correct tense.", questions: [
      { id: "q1", kind: "text", before: "If the train ", after: " (not arrive) on time, …", options: [] },
      { id: "q2", kind: "text", before: "… we ", after: " (miss) our flight, …", options: [] },
      { id: "q3", kind: "text", before: "… and we ", after: " (have to) spend the night here.", options: [] },
      { id: "q4", kind: "text", before: "When we ", after: " (get) to the airport, …", options: [] },
      { id: "q5", kind: "text", before: "… I ", after: " (text) you.", options: [] },
      { id: "q6", kind: "text", before: "As soon as we ", after: " (check in) at the hotel, …", options: [] },
      { id: "q7", kind: "text", before: "… she ", after: " (look for) a surf instructor.", options: [] },
      { id: "q8", kind: "text", before: "She won't take any lessons if I ", after: " (not surf) with her.", options: [] },
      { id: "q9", kind: "text", before: "If it ", after: " (not be), …", options: [] },
      { id: "q10", kind: "text", before: "… we ", after: " (be) very upset.", options: [] },
      { id: "q11", kind: "text", before: "If the hotel restaurant ", after: " (be) nice, …", options: [] },
      { id: "q12", kind: "text", before: "… we ", after: " (have) a meal there …", options: [] },
      { id: "q13", kind: "text", before: "… as soon as we ", after: " (check in).", options: [] },
      { id: "q14", kind: "text", before: "", after: " (you / water) the plants if …?", options: [] },
      { id: "q15", kind: "text", before: "… if I ", after: " (promise) to take you out for dinner when we come back?", options: [] },
    ], passage: [
      [{ text: "Hi brother," }],
      [{ text: "We're at the station, but our train isn't here yet. We're worried because if the train " }, { questionId: "q1" }, { text: " (not arrive) on time, we " }, { questionId: "q2" }, { text: " (miss) our flight, and we " }, { questionId: "q3" }, { text: " (have to) spend the night here. When we " }, { questionId: "q4" }, { text: " (get) to the airport, I " }, { questionId: "q5" }, { text: " (text) you." }],
      [{ text: "We are very excited about the holiday. Sandy is looking forward to taking surfing lessons. She says as soon as we " }, { questionId: "q6" }, { text: " (check in) at the hotel, she " }, { questionId: "q7" }, { text: " (look for) a surf instructor. However, she says she won't take any lessons if I " }, { questionId: "q8" }, { text: " (not surf) with her. We expect the weather will be fine. If it " }, { questionId: "q9" }, { text: " (not be), we " }, { questionId: "q10" }, { text: " (be) very upset. We are also planning to try the local food. If the hotel restaurant " }, { questionId: "q11" }, { text: " (be) nice, we " }, { questionId: "q12" }, { text: " (have) a meal there as soon as we " }, { questionId: "q13" }, { text: " (check in)." }],
      [{ text: "One more thing, " }, { questionId: "q14" }, { text: " (you / water) the plants if I " }, { questionId: "q15" }, { text: " (promise) to take you out for dinner when we come back?" }],
      [{ text: "Take care,\nAndy." }],
    ] },
  ],
};

export const TEST_CATALOG: TestCatalogEntry[] = [FIRST_CONDITIONAL, SECOND_CONDITIONAL];
export function findLibraryTest(id: string) { return TEST_CATALOG.find((test) => test.id === id) ?? null; }
