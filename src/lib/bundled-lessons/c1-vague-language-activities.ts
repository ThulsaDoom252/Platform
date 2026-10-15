import type { InteractiveHomeworkPlan } from "../lesson-homework";

export type VagueLanguagePracticeItem = {
  prompt: string;
  answer: string;
  accepted?: string[];
  choices?: string[];
  explanation: string;
};

export type VagueLanguagePracticeGroup = {
  id: string;
  title: string;
  instruction: string;
  items: VagueLanguagePracticeItem[];
};

/** Original practice, informed by the supplied expressions, not reconstructed missing questions. */
export const VAGUE_LANGUAGE_LEXICAL_PRACTICE: VagueLanguagePracticeGroup[] = [
  {
    id: "vague-position",
    title: "Approximation: put it in the right place",
    instruction: "Choose one of the options for each gap. Consider both the meaning and the position of the expression. The options are not an open word bank.",
    items: [
      {
        prompt: "The trip took us ___ two hours, though it may have been a little less.",
        answer: "roughly",
        choices: ["or thereabouts", "roughly", "at least", "a ballpark figure"],
        explanation: "Roughly precedes an estimate. At least would establish a minimum and conflict with the possibility of less than two hours; or thereabouts normally follows the estimate.",
      },
      {
        prompt: "There were fifty ___ people in the room; nobody had counted them exactly.",
        answer: "or so",
        choices: ["in the region of", "at most", "or so", "roughly"],
        explanation: "Or so follows the number or quantity being approximated: fifty or so people. The other options go before an amount, not after fifty here.",
      },
      {
        prompt: "Emma said she would arrive at nine ___, rather than promising an exact time.",
        answer: "or thereabouts",
        choices: ["on the order of", "in excess of", "or thereabouts", "no less than"],
        explanation: "Or thereabouts follows a time or amount and means approximately that time or amount. It is suitable for an informal arrangement, not a strict deadline.",
      },
      {
        prompt: "Jack estimated forty minutes, ___ five minutes either way.",
        answer: "give or take",
        choices: ["give or take", "no more than", "at least", "something"],
        explanation: "Give or take introduces the possible margin of variation: approximately forty minutes, with five minutes more or less.",
      },
      {
        prompt: "Choose the form whose ending specifically means 'thirty and a few more', not just an unspecified number in the thirties: ___ guests.",
        answer: "thirty-odd",
        choices: ["thirty-odd", "thirty-something", "in the low thirty", "give or take thirty"],
        explanation: "Thirty-odd means thirty and a few more. Thirty-something usually places a number or age somewhere between thirty and thirty-nine, not specifically a little over thirty.",
      },
      {
        prompt: "Nobody knew his exact age. He was ___: somewhere between forty and forty-nine.",
        answer: "forty-something",
        choices: ["forty-odd", "forty-something", "forty or so", "at most forty"],
        explanation: "Forty-something gives an unspecified age in the forties. Forty-odd suggests forty and a few more rather than the entire decade. The hyphen belongs in the complete written word.",
      },
      {
        prompt: "Temperatures will be ___ thirties Celsius: around 31–33 degrees, not near forty.",
        answer: "in the low",
        choices: ["in the low", "at most", "on the order of", "in excess of"],
        explanation: "In the low thirties refers to the lower part of the 30–39 range. It does not mean a strict maximum or a temperature above the whole range.",
      },
      {
        prompt: "I am not asking for an exact quote yet; just give me ___.",
        answer: "a ballpark figure",
        choices: ["roughly", "a ballpark figure", "in the region of", "just over"],
        explanation: "A ballpark figure is a noun phrase meaning a rough numerical estimate. The alternatives cannot stand alone as the object of give me in this sentence.",
      },
    ],
  },
  {
    id: "vague-bounds",
    title: "Estimates are not limits",
    instruction: "Choose one option per gap. An approximate amount, a minimum and a maximum are different claims; follow the numbers and the stated intention.",
    items: [
      {
        prompt: "The doors open at 8.50. Arrive ___ ten minutes before the 9.00 start: ten minutes is the minimum, and earlier is fine.",
        answer: "at least",
        choices: ["at most", "at least", "or so", "just over"],
        explanation: "At least establishes a minimum. It includes exactly ten minutes and any longer period; just over would exclude exactly ten and suggest only a small extra amount.",
      },
      {
        prompt: "The approved travel budget is ___ £500: spending exactly £500 is allowed, but £501 is not.",
        answer: "no more than",
        choices: ["in the region of", "no less than", "no more than", "in excess of"],
        explanation: "No more than sets an inclusive upper limit. An estimate such as in the region of £500 would not communicate the strict cap.",
      },
      {
        prompt: "The venue requires ___ fifty confirmed guests. Exactly fifty qualifies, but forty-nine does not.",
        answer: "no less than",
        choices: ["no less than", "no more than", "somewhere around", "just over"],
        explanation: "No less than gives an inclusive minimum and often adds emphasis. Just over fifty would exclude exactly fifty.",
      },
      {
        prompt: "We have only four chairs, so ___ four people can sit here; fewer would also be possible.",
        answer: "at most",
        choices: ["at least", "at most", "roughly", "in excess of"],
        explanation: "At most gives the largest permitted or possible amount. Roughly four would be an estimate rather than a capacity limit.",
      },
      {
        prompt: "The final figure was 101. To describe it as only slightly above 100, say it was ___ 100.",
        answer: "just over",
        choices: ["just over", "no more than", "or thereabouts", "at most"],
        explanation: "Just over means a small amount above the stated number. It is not an exact figure, but it does specify the direction of the difference.",
      },
      {
        prompt: "The formal report confirms sales ___ £1 million: the total was greater than that, but the report gives no upper limit.",
        answer: "in excess of",
        choices: ["in excess of", "at most", "no more than", "or so"],
        explanation: "In excess of means more than and is common in formal reporting. Unlike at least, it excludes exactly the stated amount.",
      },
      {
        prompt: "The unconfirmed estimate is ___ £3,000; the final cost could be a little higher or lower.",
        answer: "in the region of",
        choices: ["in the region of", "in excess of", "no less than", "no more than"],
        explanation: "In the region of introduces an approximate amount. The other options establish a direction or a bound rather than allowing variation on either side.",
      },
      {
        prompt: "For an approximate scale in a technical presentation, use: the system handles ___ a million requests a day.",
        answer: "on the order of",
        choices: ["on the order of", "or thereabouts", "give or take", "-something"],
        explanation: "On the order of can introduce an approximate numerical scale, especially in technical contexts. It is not a promise of an exact count; do not confuse it with a strict lower or upper bound.",
      },
    ],
  },
  {
    id: "vague-purpose",
    title: "Hedging, register and sensible precision",
    instruction: "Choose the option that communicates the stated intention. In the gap about a feeling, either of the two common conversational hedges is accepted.",
    items: [
      {
        prompt: "___, the launch went well, although two customers reported problems. I am making a general summary, not describing every detail.",
        answer: "Broadly speaking",
        choices: ["Broadly speaking", "In excess of", "No less than", "Or so"],
        explanation: "Broadly speaking signals a generalisation. It leaves room for exceptions rather than claiming that every detail was successful.",
      },
      {
        prompt: "I agree ___: your plan would save time, but I still disagree with the proposed budget.",
        answer: "to some extent",
        accepted: ["to an extent"],
        choices: ["to some extent", "at least", "on the order of", "thereabouts"],
        explanation: "To some extent or to an extent means partly, not completely. Here the speaker accepts one aspect of the plan but not the whole proposal.",
      },
      {
        prompt: "I am ___ overwhelmed. I do not want to make it sound more definite or dramatic than it feels. Use a conversational two-word hedge.",
        answer: "kind of",
        accepted: ["sort of"],
        explanation: "Kind of and sort of can soften a description in conversation. They are not measurements, and using them does not give a precise degree of emotion.",
      },
      {
        prompt: "I would say there were ___ fifty guests; I have not counted, so it could have been a few fewer or a few more.",
        answer: "somewhere around",
        choices: ["somewhere around", "no less than", "in excess of", "no more than"],
        explanation: "Somewhere around allows an approximate amount on either side of fifty. The other expressions imply a minimum, more than fifty or a maximum.",
      },
      {
        prompt: "A contract that says 'no more than £500' sets a ___, not a rough estimate.",
        answer: "maximum",
        choices: ["minimum", "maximum", "midpoint", "personal feeling"],
        explanation: "No more than is an upper bound, even though it appears alongside approximation expressions in this lesson. It does not mean approximately £500.",
      },
      {
        prompt: "In the sentence 'No less than fifty people complained!', no less than can add ___ as well as state a minimum.",
        answer: "emphasis",
        choices: ["emphasis", "an upper limit", "a margin either way", "an exact average"],
        explanation: "No less than may emphasise that a quantity is surprisingly large. Context can make it rhetorical; it should not be treated as interchangeable with roughly.",
      },
      {
        prompt: "For a medication dose, an invoice total or a safety instruction, a ___ is usually more appropriate than a casual ballpark estimate.",
        answer: "precise figure",
        choices: ["precise figure", "vague hedge", "thirty-something", "general impression"],
        explanation: "Appropriate precision depends on purpose. Do not replace a required exact dose, payment or safety limit with vague language.",
      },
      {
        prompt: "'Give or take ten minutes' describes a possible ___ around the main estimate.",
        answer: "margin of variation",
        choices: ["margin of variation", "strict minimum", "legal deadline", "guaranteed total"],
        explanation: "Give or take identifies an allowed amount above or below an estimate. The amount after it is the margin, not the central estimate itself.",
      },
    ],
  },
];

export const VAGUE_LANGUAGE_GRAMMAR_PRACTICE: VagueLanguagePracticeGroup[] = [
  {
    id: "vague-perfect-timeline",
    title: "Two viewpoints: before then and by then",
    instruction: "Open the brackets using the Past Perfect Simple for an earlier past event or the Future Perfect Simple for completion by a future point. These specified forms are the focus of the task; in other contexts a different tense may also be possible.",
    items: [
      {
        prompt: "By the time Oliver arrived at yesterday's meeting, Ben ___ (leave), which made Oliver feel on edge.",
        answer: "had left",
        accepted: ["'d left"],
        explanation: "The departure happened before a stated past arrival. Past Perfect Simple is had + past participle: had left. The contracted form follows the already printed subject.",
      },
      {
        prompt: "By next Friday, Emma ___ (finish) the proposal, give or take a day if the brief changes.",
        answer: "will have finished",
        accepted: ["'ll have finished"],
        explanation: "The reference point is in the future, and the proposal is expected to be complete by then: will have + past participle.",
      },
      {
        prompt: "Jack was mortified yesterday because he ___ (not / check) the attachment before sending the message.",
        answer: "had not checked",
        accepted: ["hadn't checked"],
        explanation: "The missing check belongs to the period before the past mistake. A negative Past Perfect uses had not or hadn't + past participle.",
      },
      {
        prompt: "At this slow pace, the team ___ (not / process) all the applications by next Monday.",
        answer: "will not have processed",
        accepted: ["won't have processed", "'ll not have processed"],
        explanation: "This predicts non-completion by a future deadline. Put not after will: will not have processed, or won't have processed.",
      },
      {
        prompt: "At the interview last week, Margaret realised she ___ (lose) her notes and immediately felt flustered.",
        answer: "had lost",
        accepted: ["'d lost"],
        explanation: "Losing the notes preceded the past realisation. The past participle of lose is lost, not losed.",
      },
      {
        prompt: "By the time the guests arrive tomorrow, Michael and Grace ___ (prepare) roughly fifty seats.",
        answer: "will have prepared",
        accepted: ["'ll have prepared"],
        explanation: "The preparation is viewed as complete by the future arrival. In the future time clause, use arrive, not will arrive.",
      },
      {
        prompt: "When I finally opened the document last night, someone ___ (delete) the last paragraph. I was taken aback.",
        answer: "had deleted",
        accepted: ["'d deleted"],
        explanation: "The deletion is earlier than the past discovery. Had deleted makes that relationship explicit.",
      },
      {
        prompt: "By the end of tonight's rehearsal, Nina ___ (practise) the speech at least six times.",
        answer: "will have practised",
        accepted: ["will have practiced", "'ll have practised", "'ll have practiced"],
        explanation: "The completed repetitions are counted from a future endpoint. Both British practised and American practiced are accepted.",
      },
    ],
  },
  {
    id: "vague-perfect-forms",
    title: "Perfect forms, questions and future time clauses",
    instruction: "Complete each gap with the specified perfect form, or with the Present Simple in the explicitly marked future time clause. Questions require the auxiliary before the subject. Correct the quoted mistake where one is provided.",
    items: [
      {
        prompt: "Correct 'had went': Before the applause began yesterday, Grace ___ (go; Past Perfect) red.",
        answer: "had gone",
        accepted: ["'d gone"],
        explanation: "A perfect form needs the past participle gone, not the Past Simple went: had gone red.",
      },
      {
        prompt: "Correct 'will have finish': By six tomorrow, I ___ (finish; Future Perfect) the report and can stop feeling overwhelmed.",
        answer: "will have finished",
        accepted: ["'ll have finished"],
        explanation: "Future Perfect is will + have + past participle. Finished is the participle; finish alone is not possible after have here.",
      },
      {
        prompt: "___ (you / send; Past Perfect question) the ballpark estimate before the client called yesterday?",
        answer: "Had you sent",
        explanation: "For a Past Perfect question, put had before the subject and keep the past participle: Had you sent ...?",
      },
      {
        prompt: "___ (she / recover; Future Perfect question) from the shock by this time next week?",
        answer: "Will she have recovered",
        explanation: "For a Future Perfect question, only will moves before the subject: Will she have recovered ...?",
      },
      {
        prompt: "By the time the tutor ___ (arrive; Present Simple in a future time clause) tomorrow, we will have compared our rough estimates.",
        answer: "arrives",
        explanation: "After by the time when referring to the future, use a present form here: arrives. The future completion is expressed in will have compared in the main clause.",
      },
      {
        prompt: "By ten yesterday morning, Oliver ___ (write; Past Perfect) in the region of twenty replies.",
        answer: "had written",
        accepted: ["'d written"],
        explanation: "The endpoint is in the past. Write has the irregular past participle written: had written.",
      },
      {
        prompt: "By December next year, we ___ (be; Future Perfect) friends for ten years. I am thrilled to bits about the reunion.",
        answer: "will have been",
        accepted: ["'ll have been"],
        explanation: "Future Perfect can describe a state lasting up to a future point: will have been friends for ten years. Continuous being is unnecessary for this state.",
      },
      {
        prompt: "By ten o'clock yesterday, Emma ___ (already / read; Past Perfect) the feedback, so the announcement did not surprise her.",
        answer: "had already read",
        accepted: ["'d already read"],
        explanation: "Place already between had and the past participle. Read has the same written form in the infinitive and participle but a different pronunciation.",
      },
    ],
  },
  {
    id: "vague-feelings-review",
    title: "Bring back the Feelings grammar",
    instruction: "Follow the form requested in brackets. Recycle temporary behaviour, stative verbs, repeated annoying behaviour and object patterns from Feelings and emotions. Perfect clauses in the final four items provide the wider timeline.",
    items: [
      {
        prompt: "Why ___ (you / be; Present Continuous) so impatient right now? You are usually much calmer.",
        answer: "are you being",
        explanation: "Are you being describes temporary behaviour, not someone's permanent character. It is suitable for unusually impatient behaviour right now.",
      },
      {
        prompt: "I ___ (believe; Present Simple) your explanation, although I am still a little on edge.",
        answer: "believe",
        explanation: "Believe is stative in this meaning, so the neutral form is I believe, not I am believing.",
      },
      {
        prompt: "He ___ (always / interrupt; Present Continuous to show annoyance) when I am explaining the budget. It drives me mad.",
        answer: "is always interrupting",
        accepted: ["'s always interrupting"],
        explanation: "Present Continuous with always can present repeated behaviour as irritating. This is a speaker's attitude, not a claim that the action is literally constant.",
      },
      {
        prompt: "I do not want you ___ (work; use the -ing form for an unwanted ongoing activity) until midnight again.",
        answer: "working",
        explanation: "Do not want + object + -ing can focus on an unwanted ongoing activity. Do not want you to work is also grammatical generally, but this item specifically practises the -ing pattern.",
      },
      {
        prompt: "Give or take a day, I ___ (finish; Future Perfect) the main draft by next Friday, so I expect to feel less overwhelmed.",
        answer: "will have finished",
        accepted: ["'ll have finished"],
        explanation: "Will have finished looks back from a future endpoint. Give or take a day softens the schedule estimate; it would not be appropriate for an unchangeable legal deadline.",
      },
      {
        prompt: "Oliver was to some extent relieved at yesterday's meeting because Ben ___ (explain; Past Perfect) the problem before the investors arrived.",
        answer: "had explained",
        accepted: ["'d explained"],
        explanation: "Had explained places the explanation before the past meeting and arrival. Before alone does not force a Past Perfect; the instruction selects it to practise this viewpoint.",
      },
      {
        prompt: "After Michael had realised his mic was on, I saw him ___ (go; bare infinitive to present the whole change) red, then recover and smile.",
        answer: "go",
        explanation: "See + object + bare infinitive presents the event as a whole. Going would frame an event in progress instead; the instruction specifies the whole-event viewpoint.",
      },
      {
        prompt: "Once Grace had calmed down, I wanted her ___ (take; to-infinitive after want + object) roughly five minutes to gather her thoughts.",
        answer: "to take",
        explanation: "Want + object + to-infinitive expresses what the speaker wanted another person to do. It is wanted her to take, not wanted her take.",
      },
    ],
  },
];

export const VAGUE_LANGUAGE_SPEAKING: string[] = [
  "A pitch goes wrong. Describe what the team had already done before the investors arrived, using two Feelings expressions and two approximate quantities. Which figures would you check before sending a formal proposal?",
  "Plan a small reunion. Explain what you will have organised by the time the first guests arrive. Use an approximate attendance estimate, a strict spending limit and one emotion you expect to feel.",
  "You were taken aback by a colleague's reaction and are still on edge. Explain what had happened beforehand, then soften one interpretation with kind of, sort of or to some extent. What do you actually know, and what are you guessing?",
  "You have been asked for a ballpark figure, not a final quote. Give a cautious estimate and say what you will have checked by Friday. Your partner asks whether the estimate is a maximum: explain the difference.",
  "Retell a moment when somebody went red, clammed up or burst out laughing. Use one Past Perfect to clarify an earlier event. Describe one whole event with saw someone + bare infinitive, or an ongoing event with saw someone + -ing, and explain your choice.",
  "A teammate is feeling overwhelmed. Agree on a realistic plan using roughly or or so. Say what you do not want them doing, and what they will have completed by tomorrow evening. Keep any non-negotiable deadline precise.",
  "Compare two versions of a complaint: a precise report and a casual summary beginning broadly speaking. Include a repeated annoying habit with always + Present Continuous, then explain what had happened before you lost your temper.",
  "Look back from an imagined successful next month. What will you have achieved, and why will you feel thrilled to bits or deeply moved? Add one sentence about a difficulty you had overcome before the plan began, and distinguish an estimate from a minimum or maximum.",
];

export const VAGUE_LANGUAGE_HOMEWORK_REFERENCE = "At six on Friday, Nora finally closed her laptop. She had sent the outline before her manager called, but she was still on edge: the team had promised a ballpark figure, not an exact budget. The estimate was in the region of £3,000, with no more than £500 for travel. A colleague burst out laughing when she mistook that limit for an average. Nora went red, then laughed too. They agreed to meet at nine or thereabouts on Monday. By Tuesday lunchtime, they will have checked every cost. By the end of the week, Nora will have prepared a clearer proposal. She hopes she will feel less overwhelmed and to some extent more confident. Nothing has been approved yet.";

/** Neutral ids/titles deliberately avoid triggering the vocabulary homework expander. */
export const VAGUE_LANGUAGE_HOMEWORK: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "C1 · Vague language — a short follow-up",
  intro: "About 15–20 minutes: sixteen quick checks and one short written update. Review the lesson if needed; this is a light recap, not another full lesson.",
  exercises: [
    {
      id: "vague-home-estimates",
      title: "1 · Estimates and limits",
      kind: "fill",
      instruction: "Choose one of the options for each gap. Notice whether the phrase expresses an estimate, a minimum or a maximum.",
      items: [
        { id: "vague-home-estimate-1", prompt: "It took ___ two hours, perhaps a little less.", answer: "roughly", choices: ["at least", "roughly", "or thereabouts"] },
        { id: "vague-home-estimate-2", prompt: "I sent twenty ___ emails; I did not count them exactly.", answer: "or so", choices: ["in the region of", "or so", "at most"] },
        { id: "vague-home-estimate-3", prompt: "Exactly ten minutes is acceptable, but nine is not. Allow ___ ten minutes.", answer: "at least", choices: ["at most", "at least", "just over"] },
        { id: "vague-home-estimate-4", prompt: "The spending cap is ___ £200: exactly £200 is allowed, but £201 is not.", answer: "no more than", choices: ["in the region of", "no less than", "no more than"] },
      ],
    },
    {
      id: "vague-home-perfects",
      title: "2 · Earlier past or future completion?",
      kind: "fill",
      instruction: "Open the brackets. Use the Past Perfect Simple for an earlier past event and the Future Perfect Simple for completion by a future point. Full forms and standard contractions are accepted.",
      items: [
        { id: "vague-home-perfect-1", prompt: "By the time I arrived yesterday, Jack ___ (leave). I was taken aback.", answer: "had left", accepted: ["'d left"] },
        { id: "vague-home-perfect-2", prompt: "By six tomorrow, we ___ (finish) the draft and can relax.", answer: "will have finished", accepted: ["'ll have finished"] },
        { id: "vague-home-perfect-3", prompt: "Nora felt flustered yesterday because she ___ (not / see) the revised schedule before the call.", answer: "had not seen", accepted: ["hadn't seen"] },
        { id: "vague-home-perfect-4", prompt: "By the time the meeting starts tomorrow, everyone ___ (arrive).", answer: "will have arrived", accepted: ["'ll have arrived"] },
      ],
    },
    {
      id: "vague-home-review",
      title: "3 · Four familiar patterns",
      kind: "fill",
      instruction: "Follow the requested form: temporary behaviour, a stative verb, an unwanted ongoing activity and a whole-event perception pattern.",
      items: [
        { id: "vague-home-review-1", prompt: "Why ___ (you / be; Present Continuous) so rude right now? This is not like you.", answer: "are you being" },
        { id: "vague-home-review-2", prompt: "I ___ (know; Present Simple) what you mean, but I am only partly convinced.", answer: "know" },
        { id: "vague-home-review-3", prompt: "I do not want you ___ (work; -ing form) late again; you already seem overwhelmed.", answer: "working" },
        { id: "vague-home-review-4", prompt: "I saw Grace ___ (go; bare infinitive, whole event) red, recover and smile.", answer: "go" },
      ],
    },
    {
      id: "vague-home-reading",
      title: "4 · A brief project update",
      kind: "fill",
      instruction: "Read the complete update, then choose one answer for each gap. Separate what had happened, what is estimated and what will be complete later.",
      referenceTitle: "Nora's update",
      referenceText: VAGUE_LANGUAGE_HOMEWORK_REFERENCE,
      items: [
        { id: "vague-home-reading-1", prompt: "Nora sent the outline ___ the manager called.", answer: "before", choices: ["before", "after", "at the same time as"] },
        { id: "vague-home-reading-2", prompt: "The £3,000 figure is ___, not a final approved total.", answer: "an estimate", choices: ["an estimate", "a travel-only allowance", "a confirmed invoice"] },
        { id: "vague-home-reading-3", prompt: "The £500 travel figure is a ___, not an average.", answer: "maximum", choices: ["minimum", "maximum", "suggested average"] },
        { id: "vague-home-reading-4", prompt: "By Tuesday lunchtime, the team will have ___.", answer: "checked every cost", choices: ["received final approval", "checked every cost", "finished the clearer proposal"] },
      ],
    },
    {
      id: "vague-home-update",
      title: "5 · One short update",
      kind: "question-text",
      instruction: "Write one update of 90–110 words. No recording or extra essay is required. The teacher checks this final task; the sixteen earlier items are checked automatically.",
      items: [{
        id: "vague-home-update-1",
        prompt: "Write about a real or imagined plan, meeting or small event. Explain one thing you had done before a past problem, and one thing you will have completed by a future point. Use two vague-language expressions and one Feelings expression from the previous lesson. Keep any firm deadline or spending limit precise. Aim for a useful, natural update, not a list of grammar examples.",
      }],
    },
  ],
};
