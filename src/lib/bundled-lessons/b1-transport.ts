import { normalizeInteractiveHomework, type InteractiveHomeworkPlan } from "../lesson-homework";
import { addRegularLessonFocusIds, normalizeRegularLessonSections, regularAnswerMap, type RegularLessonSection, type RegularLessonTone } from "../regular-lesson";
import { cleanScriptHtml } from "../script-html";
import { TRANSPORT_VOCABULARY, TRANSPORT_WORDS, transportWordAnswers } from "./b1-transport-vocabulary";
import { TRANSPORT_PASSAGES, type TransportPassage } from "./b1-transport-passages";
import { TRANSPORT_COLLOCATIONS, TRANSPORT_PREPOSITION_PRACTICE, TRANSPORT_TENSE_PRACTICE, TRANSPORT_REPAIR, TRANSPORT_TRANSLATIONS, TRANSPORT_CREATIVE, TRANSPORT_HOMEWORK, type TransportPracticeItem } from "./b1-transport-activities";

export const TRANSPORT_LESSON_TITLE = "B1 · Transport and the way of travelling";
export const TRANSPORT_REFERENCES = [
  { title: "Cambridge · Travel prepositions", url: "https://dictionaryblog.cambridge.org/2015/09/02/in-london-but-at-the-station-prepositions-for-talking-about-travel/" },
  { title: "British Council · Past perfect", url: "https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/past-perfect" },
  { title: "Cambridge · Past perfect simple", url: "https://dictionary.cambridge.org/grammar/british-grammar/past-perfect-i-" },
  { title: "Oxford · Highway", url: "https://www.oxfordlearnersdictionaries.com/us/definition/english/highway" },
  { title: "Oxford · Motorway", url: "https://www.oxfordlearnersdictionaries.com/us/definition/english/motorway" },
];
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const safe = (html: string) => cleanScriptHtml(addRegularLessonFocusIds(html));
const lexical = TRANSPORT_VOCABULARY.map(word => new RegExp(`(?<![\\p{L}\\p{N}])(?:${word.pattern})(?![\\p{L}\\p{N}])`, "giu"));
const perfect = /\b(?:had(?:n't| not)?|(?:I|you|he|she|we|they)['’]d)\s+(?:(?:already|just|never|ever)\s+)?(?:booked|planned|changed|arrived|left|checked|blocked|parked|caused|closed|slowed|gone|filled|read|missed|downloaded|imagined|compared|waited|formed|been)(?:\s+(?:up|down|on|in|out|off))?\b/giu;
const transportPrepositions = /\b(?:(?:on|in)\s+(?:(?:a|an|the|my|your|his|her|our|their)\s+)?(?:bus|coach|train|tram|ferry|car|taxi|van|plane|bike|lorry)(?:\s+cab)?|by\s+(?:bus|coach|train|tram|ferry|car|taxi|van|plane|bike)|on foot)\b/giu;
const pastSimple = /\b(?:arrived|reached|went|found|waited|stopped|offered|passed|discovered|realised|suggested|joined|took|said|laughed|ended|wrote|decided|checked|changed|looked|walked|called|fastened|closed|parked|compared|preferred|cost|booked|left|read|was|were)\b/giu;

/** Match plain authored prose, merge overlaps, then escape; input can never inject HTML. */
export function highlightTransportText(text: string): string {
  const ranges = [...lexical, perfect, transportPrepositions, pastSimple].flatMap(pattern => [...text.matchAll(new RegExp(pattern))].map(match => ({ start: match.index, end: match.index + match[0].length })));
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  let html = "", cursor = 0;
  for (const range of merged) {
    html += escape(text.slice(cursor, range.start)) + `<strong>${escape(text.slice(range.start, range.end))}</strong>`;
    cursor = range.end;
  }
  return html + escape(text.slice(cursor));
}

function control(answer: string, accepted: string[] = [], teacher: boolean): string {
  return teacher ? `<span class="ans">${escape([...new Set([answer, ...accepted])].join(" / "))}</span>` : '<span class="blank"></span>';
}
function practice(items: TransportPracticeItem[], teacher: boolean, wholeSentence = false, listClass = "sentence-check"): string {
  return `<ol class="${listClass}">${items.map(item => {
    const parts = item.prompt.split("___");
    if (!wholeSentence && parts.length !== 2) throw new Error(`Transport practice requires one gap: ${item.prompt}`);
    const prompt = wholeSentence ? `${escape(item.prompt)} → ${control(item.answer, item.accepted, teacher)}`
      : `${highlightTransportText(parts[0])}${control(item.answer, item.accepted, teacher)}${highlightTransportText(parts[1])}`;
    return `<li>${prompt}${teacher ? `<div class="key">${escape(item.explanation)}</div>` : ""}</li>`;
  }).join("")}</ol>`;
}
function guessing(teacher: boolean): string {
  return `<h3>Guess the transport expression</h3><p class="instr">Write the lesson word or phrase from its description. Include or omit a/an/to. For the invitation and the car incident, one of the two alternatives is enough. There is no word bank: practise recall.</p><ol class="sentence-check">${TRANSPORT_VOCABULARY.map(seed => `<li>${escape(seed.description)} → ${control(seed.word, transportWordAnswers(seed), teacher)}${teacher ? `<div class="key">${escape(seed.translation)}. ${escape(seed.note)}</div>` : ""}</li>`).join("")}</ol>`;
}
function passageHtml(passage: TransportPassage, teacher: boolean): string {
  const body = passage.kind === "reading" ? passage.paragraphs!.map((p, index) => `<p><span class="pn">${index + 1}</span> ${highlightTransportText(p)}</p>`).join("")
    : `<div class="lines">${passage.turns!.map((turn, index) => `<p><span class="ln">${index + 1}</span> <span class="sp">${escape(turn.speaker)}:</span> ${highlightTransportText(turn.text)}</p>`).join("")}</div>`;
  return `${body}<h3>True or False? · Find the evidence</h3><p class="instr">Choose True or False, then correct each false statement using information in the passage.</p><ol class="tf">${passage.trueFalse.map(item => `<li>${escape(item.prompt)} ${teacher ? `<span class="ans">${item.answer ? "True / T" : "False / F"}</span><div class="key">${escape(item.explanation)}</div>` : '<span class="tfbox"></span>'}</li>`).join("")}</ol>
    <h3>Questions · Retell the journey</h3><p class="instr">Answer in your own words. Short clear answers are enough. Use Past Perfect when looking back at an earlier event.</p><ol>${passage.questions.map(item => `<li>${escape(item.prompt)}${teacher ? `<div class="key">Suggested answer: ${escape(item.suggestedAnswer)}</div>` : ""}</li>`).join("")}</ol>`;
}

const prepositionGuide = `<h3>Travelling: on, in and by</h3>
  <table><thead><tr><th>Pattern</th><th>Use</th><th>Example</th></tr></thead><tbody>
  <tr><td><strong>on a/the bus, coach, train, tram, ferry, plane</strong></td><td>A passenger journey on these services.</td><td>We found seats <strong>on the coach</strong>.</td></tr>
  <tr><td><strong>in a/the/my car, taxi, van</strong></td><td>Inside these vehicles.</td><td>I left my bag <strong>in the taxi</strong>.</td></tr>
  <tr><td><strong>on a bike / motorbike</strong></td><td>Riding, although these are not public transport.</td><td>She arrived <strong>on her bike</strong>.</td></tr>
  <tr><td><strong>by + transport</strong></td><td>The method; no a/the/my.</td><td>I commute <strong>by tram</strong>, not by the tram.</td></tr>
  <tr><td><strong>on foot</strong></td><td>Walking.</td><td>We reached the port <strong>on foot</strong>.</td></tr></tbody></table>
  <h3>Getting aboard and getting out</h3><table><thead><tr><th>Enter</th><th>Leave</th></tr></thead><tbody>
  <tr><td><strong>get on</strong> a bus / train / tram / ferry</td><td><strong>get off</strong> a bus / train / tram / ferry</td></tr>
  <tr><td><strong>get in / into</strong> a car / taxi / van</td><td><strong>get out of</strong> a car / taxi / van</td></tr></tbody></table>
  <p><strong>Board the train / coach / ferry</strong> is more formal. Do not add on after board. <strong>Hop in! / Jump in!</strong> are informal invitations to a safely stopped car.</p>
  <p class="note">Learn the usual combinations, not “public transport = on” or “can stand up = on”: taxis and bikes show why those shortcuts fail. In the bus can emphasise physical location, but on the bus is the normal passenger-journey wording practised here. Inside a lorry's cab: <strong>in the cab</strong>.</p>
  <p>Compare <strong>I travelled by car</strong> (method) and <strong>I travelled in my car</strong> (specific vehicle).</p>`;

const pastGuide = `<h3>Two layers of a journey</h3>
  <p><strong>Past Simple</strong> tells the main story: “We <strong>arrived</strong>, <strong>checked</strong> the board and <strong>got on</strong> the train.”</p>
  <p><strong>Past Perfect: had + past participle</strong> looks back from a past moment: “When we <strong>arrived</strong>, the train <strong>had already left</strong>.” Departure was earlier; arrival is the later reference.</p>
  <p><strong>Earlier:</strong> 08:00 — the train left. <strong>Later:</strong> 08:10 — we arrived. You can reverse the clauses without changing the order of events: “The train had already left when we arrived.”</p>
  <table><thead><tr><th></th><th>Past Simple</th><th>Past Perfect</th></tr></thead><tbody>
  <tr><th>Positive</th><td>We boarded the ferry.</td><td>We had booked the tickets.</td></tr>
  <tr><th>Negative</th><td>We didn't board it.</td><td>We hadn't booked them.</td></tr>
  <tr><th>Question</th><td>Did you board it?</td><td>Had you booked them?</td></tr></tbody></table>
  <p>Use <strong>had</strong> for every subject. After had, use V3: go → <strong>gone</strong>, get → <strong>got</strong> (UK) / <strong>gotten</strong> (US), take → <strong>taken</strong>, leave → <strong>left</strong>, be → <strong>been</strong>. After did/didn't, use the base verb.</p>
  <h3>Explain a problem; don't put every verb in Past Perfect</h3>
  <p>“We missed the coach because we <strong>had waited</strong> at the wrong stop.” The earlier waiting explains the problem. <strong>By the time</strong> often gives the later reference: “By the time I reached the platform, the train had left.”</p>
  <p>For an ordinary sequence, use Past Simple: “I bought a ticket, boarded the tram and sat down.” With before/after, the order may already be clear, so Past Simple can also be natural: “After I bought a ticket, I boarded.” Past Perfect adds an explicit look back: “After I had bought a ticket, I boarded.”</p>
  <p class="note">Past Perfect is not simply “a very old event”. One finished event normally uses Past Simple: “We travelled by ferry in 2019.” In practice exercises, follow the stated narrative perspective. <strong>It takes me…</strong> becomes <strong>It took me…</strong> in a finished past journey.</p>`;

export function buildB1TransportLesson() {
  if (TRANSPORT_WORDS.length !== 26 || new Set(TRANSPORT_WORDS.map(word => word.word)).size !== 26) throw new Error("Transport requires all 26 distinct vocabulary entries");
  if (TRANSPORT_PASSAGES.length !== 3 || TRANSPORT_PASSAGES.some(p => p.trueFalse.length !== 8 || p.questions.length !== 8)) throw new Error("Each transport passage needs 8 True/False and 8 questions");
  const sections: RegularLessonSection[] = [];
  const add = (id: string, title: string, tone: RegularLessonTone, studentHtml: string, teacherHtml = studentHtml, teacherOnly = false, defaultOpen = false) => {
    sections.push({ id, title, tone, studentHtml: safe(studentHtml), teacherHtml: safe(teacherHtml), defaultOpen, ...(teacherOnly ? { teacherOnly: true } : {}) });
  };
  const addPractice = (id: string, title: string, heading: string, instruction: string, items: TransportPracticeItem[], wholeSentence = false, listClass = "sentence-check") => {
    const intro = `<h3>${escape(heading)}</h3><p class="instr">${escape(instruction)}</p>`;
    add(id, title, "exercise", intro + practice(items, false, wholeSentence, listClass), intro + practice(items, true, wholeSentence, listClass));
  };
  add("transport-teacher", "Teacher route & answer guidance", "warm", "", `<h3>Transport rescue: flexible teaching route</h3><p>A full B1 pack, not a race through every activity. For a 60–75-minute class, choose warm-up, vocabulary targets, the two grammar guides and one passage. Save another dialogue for the next class or add its exercises to homework. All 26 requested entries are retained. The original typo bust lane is corrected to bus lane.</p><p>The Answers control reveals 92 automatic keys, evidence for all 24 True/False decisions and suggested answers to all 24 passage questions. Personal answers and the creative route are open-ended. Accept equivalent meaningful translations. Earlier-action tense tasks explicitly request Past Perfect; do not tell students it is obligatory in every real sentence containing before or after.</p><p>Do not assume the learner drives, commutes, has travelled abroad or wants to discuss a real accident. Imaginary, non-graphic examples are welcome. Prices and timetables in the stories are fictional. The text uses all vocabulary families; the dialogues revisit them in practical situations. New words, travel prepositions and narrative tense forms are bold in the passages.</p><p>All stories, definitions and exercises are original. Reference checks:</p><ul>${TRANSPORT_REFERENCES.map(link => `<li><a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.title)}</a></li>`).join("")}</ul>`, true);
  add("transport-warmup", "Warm-up · The journey matters", "warm", `<h3>Questions · Your travel choices</h3><p class="instr">Use real or imagined examples. You can skip any personal detail.</p><ol><li>What makes a journey enjoyable: speed, comfort, price or the view?</li><li>What is your favourite way to travel a short distance? What about a long distance?</li><li>What small mistake can turn a simple journey into a problem?</li><li>Would you rather have a perfect plan or be good at finding a Plan B? Why?</li></ol>`);
  add("transport-vocabulary", "Vocabulary · Transport & travelling", "vocab", `<p>26 expressions for vehicles, road features, journeys and problems. Verbs use the infinitive. The pattern it takes + time changes with tense: it took us an hour. Jump in / hop in and car accident / car crash are paired alternatives, not missing words. Translations and examples are provided; English descriptions help you practise guessing.</p>`, undefined, false, true);
  add("transport-guess", "1 · Guess the word or phrase", "exercise", guessing(false), guessing(true));
  const personal = `<h3>Questions · Your route, your choice</h3><p class="instr">Answer about yourself or an imaginary traveller. Use the expression in bold where it fits; add a reason or example.</p><ol>${TRANSPORT_VOCABULARY.map(seed => `<li>${highlightTransportText(seed.question)}</li>`).join("")}</ol>`;
  add("transport-personal", "2 · Questions for you", "exercise", personal, `${personal}<div class="key">Answers are personal. Encourage a short answer and a reason. Reformulate target phrases naturally; never require driving experience or real accident details.</div>`);
  addPractice("transport-collocations", "3 · Travel expressions in context", "Useful combinations", "Write only the missing word or expression from the lesson.", TRANSPORT_COLLOCATIONS);
  add("transport-on-in", "Grammar 1 · On / in / by transport", "grammar", prepositionGuide);
  addPractice("transport-on-in-practice", "Grammar practice · On, in or by?", TRANSPORT_PREPOSITION_PRACTICE.title, TRANSPORT_PREPOSITION_PRACTICE.instruction, TRANSPORT_PREPOSITION_PRACTICE.items);
  add("transport-past-guide", "Grammar 2 · Past Simple vs Past Perfect", "grammar", pastGuide);
  addPractice("transport-past-practice", "Grammar practice · What had happened first?", TRANSPORT_TENSE_PRACTICE.title, TRANSPORT_TENSE_PRACTICE.instruction, TRANSPORT_TENSE_PRACTICE.items);
  addPractice("transport-repair", "4 · Repair the travel messages", "Spot and repair the mistake", "Rewrite each whole sentence, correcting the one grammar or word-order error.", TRANSPORT_REPAIR, true);
  addPractice("transport-translation", "5 · Translation · Travel messages", "Say it in English", "Use the lesson words and the requested tense. Write the complete English sentence.", TRANSPORT_TRANSLATIONS, true, "translation-check");
  for (const passage of TRANSPORT_PASSAGES) add(passage.id, passage.title, passage.kind, passageHtml(passage, false), passageHtml(passage, true));
  const creative = `<h3>Questions · ${escape(TRANSPORT_CREATIVE.title)}</h3><p class="instr">${escape(TRANSPORT_CREATIVE.instruction)}</p><ol>${TRANSPORT_CREATIVE.prompts.map(p => `<li>${escape(p)}</li>`).join("")}</ol>`;
  add("transport-creative", "Creative task · Save the journey", "exercise", creative, `${creative}<div class="key">${escape(TRANSPORT_CREATIVE.teacherNotes)}</div>`);
  const normalized = normalizeRegularLessonSections(sections);
  const automaticKeys = normalized.reduce((sum, section) => sum + regularAnswerMap(section).size, 0);
  if (automaticKeys !== 92) throw new Error(`Transport needs 92 complete private answer keys, found ${automaticKeys}`);
  const homework = normalizeInteractiveHomework(TRANSPORT_HOMEWORK);
  if (!homework || homework.exercises.length !== 7 || homework.exercises.reduce((sum, e) => sum + e.items.length, 0) !== 19) throw new Error("Transport homework must retain 7 compact blocks and 19 items");
  return {
    title: TRANSPORT_LESSON_TITLE,
    description: "26 transport words and expressions · on/in/by & Past Simple vs Past Perfect · guessing, personal questions, context, editing & translation · one reading and two dialogues with 8 True/False + 8 questions each · creative travel rescue & light written/voice homework.",
    sections: normalized, words: TRANSPORT_WORDS,
    homework: [JSON.parse(JSON.stringify(homework)) as InteractiveHomeworkPlan],
  };
}
