import { normalizeInteractiveHomework, type InteractiveHomeworkPlan } from "../lesson-homework";

// Neutral exercise IDs/titles deliberately preserve this teacher-requested
// repetition of impeccable across all three lexical tasks. The generic
// vocabulary organizer otherwise redistributes each headword only once.
const WALT_MEETS_GUS_HOMEWORK: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Walt meets Gus · Homework",
  intro: "Review the expressions from the scene, then use them in your own answers and questions. Use the word impeccable in every exercise and take care with its spelling. Written answers can be short; voice answers should be about 20–40 seconds each. Base scene answers only on this clip, not on later episodes.",
  exercises: [
    {
      id: "wmg-complete-lines",
      title: "1 · Complete the lines",
      instruction: "Fill each gap with one expression from the list. Use each expression once. Write only the missing words, not the whole sentence.",
      kind: "fill",
      wordBank: ["I'm not following", "impeccable", "a complaint", "Have a seat", "Coke", "You're confusing me with someone else", "Can I help you"],
      items: [
        { id: "wmg-fill-01", prompt: "A visitor looks lost. The receptionist asks, ‘___?’", answer: "Can I help you" },
        { id: "wmg-fill-02", prompt: "At the café, I ordered a Diet ___ rather than a coffee.", answer: "Coke" },
        { id: "wmg-fill-03", prompt: "‘___. I'll be with you in a minute,’ the manager said, pointing to a chair.", answer: "Have a seat" },
        { id: "wmg-fill-04", prompt: "‘Sorry, ___. Could you explain your idea again?’", answer: "I'm not following", accepted: ["I am not following", "I don't follow", "I do not follow"] },
        { id: "wmg-fill-05", prompt: "‘I don't work here, and we've never met. ___.’", answer: "You're confusing me with someone else", accepted: ["You are confusing me with someone else", "You're mistaking me for someone else", "You are mistaking me for someone else"] },
        { id: "wmg-fill-06", prompt: "The restaurant received ___ about the noise from a dissatisfied customer.", answer: "a complaint" },
        { id: "wmg-fill-07", prompt: "The rooms were spotless and the staff never made a mistake: the service was ___.", answer: "impeccable" },
      ],
    },
    {
      id: "wmg-guess-expression",
      title: "2 · Guess the expression",
      instruction: "Read each description and recall the matching expression from the lesson without a word list. For verbs, an infinitive with or without to is accepted. For the email item, write the complete expression.",
      kind: "definition",
      items: [
        { id: "wmg-guess-01", prompt: "One verb: to formally send a document, application or complaint for consideration.", answer: "to submit", accepted: ["submit"] },
        { id: "wmg-guess-02", prompt: "A complete expression: to send a document or complaint for consideration using an electronic mail system. Include both the action and the method.", answer: "to submit something through an email system", accepted: ["submit something through an email system", "to submit it through an email system", "submit it through an email system", "to submit something through our email system", "submit something through our email system", "to submit it through our email system", "submit it through our email system", "to submit a complaint through an email system", "submit a complaint through an email system", "to submit a complaint through our email system", "submit a complaint through our email system"] },
        { id: "wmg-guess-03", prompt: "An infinitive expression meaning to be similar to each other, as two people may be in their habits or character.", answer: "to be alike", accepted: ["be alike", "alike"] },
        { id: "wmg-guess-04", prompt: "An adjective describing someone who is careful to avoid danger, problems or mistakes.", answer: "cautious" },
        { id: "wmg-guess-05", prompt: "A short informal expression used in the scene for being affected by a drug that changes how someone feels or behaves. It describes a state, not a person's height.", answer: "to be high", accepted: ["be high", "high"] },
        { id: "wmg-guess-06", prompt: "An expression with have meaning to make unwise decisions because you do not assess a situation well.", answer: "to have poor judgment", accepted: ["have poor judgment", "to have poor judgement", "have poor judgement"] },
        { id: "wmg-guess-07", prompt: "An adjective meaning faultless: so good that there are no mistakes or defects to criticise.", answer: "impeccable" },
      ],
    },
    {
      id: "wmg-explain-meaning",
      title: "3 · Explain the meaning",
      instruction: "Explain each expression in your own English in one or two sentences, then add one original example. Do not just translate it or copy the dictionary definition. For impeccable, make clear that it means faultless, not merely quite good.",
      kind: "describe",
      items: [
        { id: "wmg-explain-01", word: "That is not the only factor.", prompt: "Explain what a speaker means when they say this during a decision. Add an everyday example." },
        { id: "wmg-explain-02", word: "hands down", prompt: "Explain the expression as a way to show certainty or an easy victory. Add an example that is not a quotation from the clip." },
        { id: "wmg-explain-03", word: "on somebody's end", prompt: "Explain whose part of an arrangement this refers to. In your example, replace somebody with my, your or their." },
        { id: "wmg-explain-04", word: "to interact with somebody", prompt: "Explain the action in your own words and give an example involving a teacher, customer or colleague." },
        { id: "wmg-explain-05", word: "at a moment's notice", prompt: "Explain how much warning someone has. Give an example involving a last-minute change of plan." },
        { id: "wmg-explain-06", word: "a drug addict", prompt: "Explain this label from the scene, then give a neutral, person-first alternative. Add a supportive example; do not generalise about all people with an addiction." },
        { id: "wmg-explain-07", word: "impeccable", prompt: "Explain the degree of quality this adjective describes. Add an example about service, manners or someone's work." },
      ],
    },
    {
      id: "wmg-translate-lines",
      title: "4 · Translate the lines",
      instruction: "Translate all six lines into English using expressions from the lesson. In line 1, use both hands down and impeccable. Keep the meaning natural; your teacher can accept another accurate translation.",
      kind: "translate",
      translationDirection: "to-english",
      translationLanguage: "UK",
      items: [
        {
          id: "wmg-translate-01", prompt: "Це, без сумніву, найкращий готель у місті: обслуговування бездоганне.",
          answer: "This is hands down the best hotel in town: the service is impeccable.",
          accepted: ["This is hands down the best hotel in the city: the service is impeccable.", "This is, hands down, the best hotel in town, and the service is impeccable.", "This is, hands down, the best hotel in the city, and the service is impeccable.", "Hands down, this is the best hotel in town: the service is impeccable.", "Hands down, this is the best hotel in the city: the service is impeccable."],
        },
        {
          id: "wmg-translate-02", prompt: "Будь ласка, подайте скаргу через нашу систему електронної пошти.",
          answer: "Please submit the complaint through our email system.",
          accepted: ["Please submit a complaint through our email system.", "Please submit your complaint through our email system.", "Submit the complaint through our email system, please.", "Please submit the complaint via our email system.", "Please submit your complaint via our email system."],
        },
        {
          id: "wmg-translate-03", prompt: "З мого боку все готово; ми можемо вирушити будь-якої миті.",
          answer: "Everything is ready on my end; we can leave at a moment's notice.",
          accepted: ["On my end, everything is ready; we can leave at a moment's notice.", "Everything on my end is ready; we can leave at a moment's notice.", "Everything is ready on my end, and we can leave at a moment's notice."],
        },
        {
          id: "wmg-translate-04", prompt: "Я не розумію, про що ви. Ви плутаєте мене з кимось іншим.",
          answer: "I'm not following. You're confusing me with someone else.",
          accepted: ["I am not following. You are confusing me with someone else.", "I'm not following. You are confusing me with someone else.", "I am not following. You're confusing me with someone else.", "I don't follow. You're confusing me with someone else.", "I do not follow. You are confusing me with someone else.", "I'm not following. You're mistaking me for someone else.", "I don't follow. You're mistaking me for someone else."],
        },
        {
          id: "wmg-translate-05", prompt: "Вона обережна, але ми багато в чому схожі.",
          answer: "She is cautious, but we are alike in many ways.",
          accepted: ["She's cautious, but we're alike in many ways.", "She is cautious, but we're alike in many ways.", "She's cautious, but we are alike in many ways.", "She is cautious, but in many ways we are alike."],
        },
        {
          id: "wmg-translate-06", prompt: "Бездоганна якість — не єдиний чинник; мені потрібно буде взаємодіяти з вашою командою.",
          answer: "Impeccable quality is not the only factor; I will need to interact with your team.",
          accepted: ["Impeccable quality isn't the only factor; I'll need to interact with your team.", "Impeccable quality is not the only factor; I'll need to interact with your team.", "Impeccable quality isn't the only factor; I will need to interact with your team.", "Impeccable quality is not the only factor; I will have to interact with your team.", "Impeccable quality isn't the only factor; I'll have to interact with your team."],
        },
      ],
    },
    {
      id: "wmg-answer-in-writing",
      title: "5 · Answer in writing",
      instruction: "Answer each question in two or three complete sentences. Use impeccable in every answer, together with the other expression requested. Attribute claims to the character who makes them.",
      kind: "question-text",
      items: [
        { id: "wmg-written-01", prompt: "Why does Walt ask for five minutes of Gus's time? What does he claim about the quality of his work, and how does he try to connect with Gus? Use impeccable and cautious." },
        { id: "wmg-written-02", prompt: "Why does Gus object to Walt's choice of partner? Explain why Walt's claim of impeccable quality does not remove Gus's concern. Use impeccable and poor judgment." },
        { id: "wmg-written-03", prompt: "Does this clip confirm that they have reached a deal? Explain what Gus actually says at the end and what remains uncertain. Use impeccable and not the only factor." },
      ],
    },
    {
      id: "wmg-answer-by-voice",
      title: "6 · Answer by voice",
      instruction: "Record three separate answers, about 20–40 seconds each. Use impeccable and the other requested expressions in every recording. Speak naturally; you do not need a memorised script.",
      kind: "question-audio",
      items: [
        { id: "wmg-voice-01", prompt: "What does Walt mean when he says customers would pay more, hands down? Explain how this connects to his claim that the quality is impeccable. Use hands down and impeccable." },
        { id: "wmg-voice-02", prompt: "Walt says Gus will not need to interact with his partner. Why might this promise fail to settle Gus's concerns? Use interact with, impeccable and trust." },
        { id: "wmg-voice-03", prompt: "Imagine you are choosing a hotel for a last-minute trip. Besides impeccable service, what would you check before booking, and why? Use impeccable, cautious and at a moment's notice." },
      ],
    },
    {
      id: "wmg-ask-in-writing",
      title: "7 · Ask your teacher in writing",
      instruction: "Write one original question for your teacher in each field: three questions altogether. Use every expression in that item's set, including impeccable. Ask for your teacher's experience or opinion; do not write an answer.",
      kind: "question-text",
      items: [
        { id: "wmg-ask-written-01", prompt: "Ask your teacher about a hotel, café or restaurant they would recommend. Required expressions: impeccable; hands down." },
        { id: "wmg-ask-written-02", prompt: "Ask your teacher about the preparation they do before a lesson and what helps them keep the quality high. Required expressions: impeccable; on your end." },
        { id: "wmg-ask-written-03", prompt: "Ask your teacher whether claims of perfect service are enough to make them trust a new company. Required expressions: impeccable; cautious." },
      ],
    },
    {
      id: "wmg-ask-by-voice",
      title: "8 · Ask your teacher by voice",
      instruction: "Record one original question for your teacher in each field: three separate voice questions altogether. Use the complete word set supplied for each item, including impeccable. Ask a question, rather than reading the instructions aloud.",
      kind: "question-audio",
      items: [
        { id: "wmg-ask-voice-01", prompt: "Ask your teacher to compare two places they have visited and explain their preference. Required expressions: impeccable; hands down." },
        { id: "wmg-ask-voice-02", prompt: "Ask your teacher about keeping work or service quality high when plans change suddenly. Required expressions: impeccable; at a moment's notice." },
        { id: "wmg-ask-voice-03", prompt: "Ask your teacher about communicating with people who expect perfect service. Required expressions: impeccable; interact with." },
      ],
    },
  ],
};

/** Native homework data only: no assignments, student answers or lesson edits. */
export function buildWaltMeetsGusHomework(): InteractiveHomeworkPlan {
  const plan = normalizeInteractiveHomework(WALT_MEETS_GUS_HOMEWORK);
  if (!plan || plan.exercises.length !== 8 || plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0) !== 39) {
    throw new Error("Walt meets Gus homework must retain all eight exercises and 39 items");
  }
  // JSONB drops undefined optional keys emitted by native normalization.
  return JSON.parse(JSON.stringify(plan)) as InteractiveHomeworkPlan;
}
