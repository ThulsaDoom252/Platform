export type DailyRoutinesPassage = {
  id: string;
  title: string;
  kind: "reading" | "dialogue";
  paragraphs?: string[];
  turns?: { speaker: string; text: string }[];
  trueFalse: { prompt: string; answer: boolean; explanation: string }[];
  questions: { prompt: string; suggestedAnswer: string }[];
};

export const DAILY_ROUTINES_PASSAGES: DailyRoutinesPassage[] = [
  {
    id: "a-calmer-start",
    title: "A calmer start in a new town",
    kind: "reading",
    paragraphs: [
      "Six months ago, Daniel moved to a small town and started working at a library. Before the move, he used to stay up late and check his messages in bed. He also used to hit the snooze button three or four times every morning. His old office was near his flat, so he rarely planned his mornings. His new routine needs more organisation, but he feels healthier now.",
      "On working days, Daniel sets his alarm for 6:45. First, he feeds the cat, Pepper, and then he feeds the dog, Milo. After that, he walks the dog for twenty minutes. He makes his own breakfast when they return. On Mondays, Wednesdays and Fridays, he also has a shave before leaving home. He is used to getting up early now, although the first two weeks were difficult.",
      "Daniel commutes by bus, which takes thirty minutes. He is getting used to travelling with other people instead of walking to work. He sometimes grabs a coffee near the bus stop, but not every day. He checks his phone once to see whether the bus is delayed. During the journey, he usually reads rather than looking at a screen.",
      "He makes his own lunch the evening before and eats it in the library's small kitchen. On Tuesdays, he runs errands after work: he collects a parcel or buys pet food. He used to buy lunch every day, so preparing food has helped him save money. At first, remembering everything was hard. Now he keeps a short list on the fridge.",
      "In the evening, Daniel makes his own dinner and then chills on the sofa with a book. If he feels tired, he has a nap, but never for more than twenty minutes. He usually has an early night before a working day. He is used to cooking regularly, but he is still getting used to keeping his evenings free from work messages.",
      "On Sundays, Daniel sleeps in until about nine. He does not follow a timetable all weekend. For him, a good routine is helpful, not a set of strict rules. There is still time to meet friends and try something new.",
    ],
    trueFalse: [
      {
        prompt: "Daniel moved to his new town six months ago.",
        answer: true,
        explanation: "The opening sentence says he moved six months ago and started working at a library.",
      },
      {
        prompt: "Before the move, Daniel always got up immediately when his alarm rang.",
        answer: false,
        explanation: "He used to hit the snooze button three or four times every morning.",
      },
      {
        prompt: "Daniel feeds Pepper before he feeds Milo.",
        answer: true,
        explanation: "He feeds the cat, Pepper, first and the dog, Milo, next.",
      },
      {
        prompt: "Daniel has a shave every working morning.",
        answer: false,
        explanation: "He has a shave on Mondays, Wednesdays and Fridays, not every working day.",
      },
      {
        prompt: "His bus journey to work takes half an hour.",
        answer: true,
        explanation: "The text says Daniel commutes by bus and the journey takes thirty minutes.",
      },
      {
        prompt: "Daniel prepares his lunch at the library in the morning.",
        answer: false,
        explanation: "He makes his own lunch the evening before and eats it in the library's kitchen.",
      },
      {
        prompt: "Daniel limits his naps to twenty minutes or less.",
        answer: true,
        explanation: "He has a nap when tired, but never for more than twenty minutes.",
      },
      {
        prompt: "Daniel follows the same strict timetable throughout the weekend.",
        answer: false,
        explanation: "He sleeps in on Sundays and does not follow a timetable all weekend.",
      },
    ],
    questions: [
      {
        prompt: "Why does Daniel's new routine need more organisation than his old one?",
        suggestedAnswer: "His old office was near his flat, but now he has a morning routine to follow and a bus to catch.",
      },
      {
        prompt: "Which two old habits did Daniel have in bed or when waking up?",
        suggestedAnswer: "He used to check his messages in bed and hit the snooze button several times.",
      },
      {
        prompt: "What does Daniel do with Milo before making breakfast?",
        suggestedAnswer: "He feeds Milo and takes him for a twenty-minute walk.",
      },
      {
        prompt: "What is Daniel getting used to about his journey to work?",
        suggestedAnswer: "He is getting used to travelling with other people on the bus instead of walking to work.",
      },
      {
        prompt: "Why does Daniel check his phone near the bus stop?",
        suggestedAnswer: "He checks whether the bus is delayed.",
      },
      {
        prompt: "How has preparing lunch changed Daniel's spending?",
        suggestedAnswer: "Making his own lunch has helped him save money because he used to buy lunch every day.",
      },
      {
        prompt: "What kinds of errands does Daniel run on Tuesdays?",
        suggestedAnswer: "He collects a parcel or buys pet food.",
      },
      {
        prompt: "What is Daniel still learning to do in the evenings?",
        suggestedAnswer: "He is still getting used to keeping his evenings free from work messages.",
      },
    ],
  },
  {
    id: "the-new-morning-shift",
    title: "Dialogue 1 — The new morning shift",
    kind: "dialogue",
    turns: [
      { speaker: "Tomas", text: "How is the morning shift at the museum, Nina? You used to work in the evenings, didn't you?" },
      { speaker: "Nina", text: "Yes. I used to stay up late after work and sleep in until ten. Now I start at eight thirty." },
      { speaker: "Tomas", text: "That is quite a change. What time do you set your alarm, and do you hit the snooze button?" },
      { speaker: "Nina", text: "I set my alarm for six thirty. I used to hit the snooze button, but now I get up straight away." },
      { speaker: "Tomas", text: "Are you used to getting up that early, or is it still difficult?" },
      { speaker: "Nina", text: "I'm getting used to waking up before everyone else. Making a plan the night before really helps me." },
      { speaker: "Tomas", text: "What do you do first? Please don't tell me you immediately check your phone." },
      { speaker: "Nina", text: "No! I feed the dog, walk the dog, and then feed the cat. They make sure I don't forget." },
      { speaker: "Tomas", text: "My brother has a shave before breakfast. Does getting ready take you a long time?" },
      { speaker: "Nina", text: "Not really. I make my own breakfast and get dressed. I only check my messages after eating." },
      { speaker: "Tomas", text: "How do you commute? Do you still travel all the way across town?" },
      { speaker: "Nina", text: "I take the train. I'm used to commuting now. I sometimes grab a coffee outside the station." },
      { speaker: "Tomas", text: "And lunch? The museum café looks lovely, but I imagine eating there every day is expensive." },
      { speaker: "Nina", text: "Exactly. I make my own lunch and take it with me. The café is just a Friday treat." },
      { speaker: "Tomas", text: "Do you run errands after your shift, or do you go straight home?" },
      { speaker: "Nina", text: "I run errands on Wednesdays. On other days, I go home and sometimes have a nap for fifteen minutes." },
      { speaker: "Tomas", text: "And after that? Do you still meet friends in the evening?" },
      { speaker: "Nina", text: "Sometimes. I usually make my own dinner first, then chill on the sofa or call a friend." },
      { speaker: "Tomas", text: "So you probably have an early night before a morning shift." },
      { speaker: "Nina", text: "Usually by ten. I'm used to planning my evenings, but I'm still getting used to saying no to late invitations." },
    ],
    trueFalse: [
      {
        prompt: "Nina used to work in the evenings.",
        answer: true,
        explanation: "Tomas mentions her old evening work, and Nina confirms it in her reply.",
      },
      {
        prompt: "Nina's new shift begins at six thirty.",
        answer: false,
        explanation: "She sets her alarm for six thirty, but her shift starts at eight thirty.",
      },
      {
        prompt: "Nina now gets up without using the snooze button.",
        answer: true,
        explanation: "She says she used to hit it, but now gets up straight away.",
      },
      {
        prompt: "The first thing Nina does is check her phone.",
        answer: false,
        explanation: "Nina says no to that idea and explains that she feeds and walks the dog first.",
      },
      {
        prompt: "Nina travels to work by train.",
        answer: true,
        explanation: "When Tomas asks how she commutes, Nina says she takes the train.",
      },
      {
        prompt: "Nina buys her lunch at the museum café every day.",
        answer: false,
        explanation: "She makes her own lunch; the museum café is only a Friday treat.",
      },
      {
        prompt: "Nina sometimes has a fifteen-minute nap after going home.",
        answer: true,
        explanation: "She says she sometimes has a nap for fifteen minutes on days when she goes home directly.",
      },
      {
        prompt: "Nina already finds it completely easy to refuse late invitations.",
        answer: false,
        explanation: "She is still getting used to saying no to late invitations.",
      },
    ],
    questions: [
      {
        prompt: "How has Nina's usual waking time changed since her old job?",
        suggestedAnswer: "She used to sleep in until ten, but now her alarm rings at six thirty.",
      },
      {
        prompt: "What helps Nina deal with the early start?",
        suggestedAnswer: "Making a plan the night before helps her.",
      },
      {
        prompt: "In what order does Nina look after her two pets?",
        suggestedAnswer: "She feeds the dog, walks the dog, and then feeds the cat.",
      },
      {
        prompt: "When does Nina check her messages?",
        suggestedAnswer: "She checks them after eating breakfast.",
      },
      {
        prompt: "Where does Nina sometimes get a coffee?",
        suggestedAnswer: "She sometimes grabs a coffee outside the station.",
      },
      {
        prompt: "Why does Nina take a homemade lunch to work?",
        suggestedAnswer: "Eating at the museum café every day would be expensive.",
      },
      {
        prompt: "On which day does Nina run errands?",
        suggestedAnswer: "She runs errands on Wednesdays.",
      },
      {
        prompt: "What does Nina usually do after making dinner?",
        suggestedAnswer: "She chills on the sofa or calls a friend.",
      },
    ],
  },
  {
    id: "a-weekend-reset",
    title: "Dialogue 2 — A weekend reset",
    kind: "dialogue",
    turns: [
      { speaker: "Sam", text: "I feel tired on Saturdays. I used to sleep in happily, but now I wake up worrying about work." },
      { speaker: "Lea", text: "I used to stay up late with my laptop. I'm used to finishing work at six now." },
      { speaker: "Sam", text: "Do you set your alarm at weekends? I usually hit the snooze button twice." },
      { speaker: "Lea", text: "Only on Sundays, for my walking group. On Saturdays, I wake up naturally and make my own breakfast." },
      { speaker: "Sam", text: "I check my phone before getting out of bed. Then I check my messages while eating." },
      { speaker: "Lea", text: "I'm getting used to leaving my phone in the kitchen overnight. Try that this weekend." },
      { speaker: "Sam", text: "Maybe. When my partner is away, I feed the cat and feed the dog first. They won't let me forget." },
      { speaker: "Lea", text: "And you walk the dog afterwards? That sounds like a good reason to get outside." },
      { speaker: "Sam", text: "Yes. Then I have a shave and usually go out to grab a coffee." },
      { speaker: "Lea", text: "Could you run errands on the same trip? You wouldn't have to go out again later." },
      { speaker: "Sam", text: "I need to collect some medicine tomorrow. I also want to make my own lunch." },
      { speaker: "Lea", text: "I'm used to cooking extra food at lunchtime. It means I can make my own dinner much faster later." },
      { speaker: "Sam", text: "I never thought of that. I normally order food, then chill on the sofa until bedtime." },
      { speaker: "Lea", text: "Rest is fine. I sometimes have a nap, but a long one makes sleeping at night harder for me." },
      { speaker: "Sam", text: "I should probably have an early night tonight. My new office job starts on Monday." },
      { speaker: "Lea", text: "Will you commute every day? You used to work from home, didn't you?" },
      { speaker: "Sam", text: "Yes. I'm getting used to travelling by bus. I tried the route yesterday, so Monday should be less stressful." },
      { speaker: "Lea", text: "That's sensible. I'm used to taking a book on the bus. The journey can become useful quiet time." },
      { speaker: "Sam", text: "I'll try that, and keep my phone in the kitchen tonight. Two small changes are enough to start with." },
      { speaker: "Lea", text: "Exactly. You're getting used to a new routine, not becoming a different person." },
    ],
    trueFalse: [
      {
        prompt: "Sam now wakes up worrying about work on Saturdays.",
        answer: true,
        explanation: "He says he now wakes up worrying about work instead of sleeping in happily.",
      },
      {
        prompt: "Lea sets an alarm every Saturday for her walking group.",
        answer: false,
        explanation: "She sets an alarm on Sundays for the group; on Saturdays she wakes up naturally.",
      },
      {
        prompt: "Lea is learning to leave her phone in the kitchen overnight.",
        answer: true,
        explanation: "She says she is getting used to leaving it there overnight.",
      },
      {
        prompt: "Sam never looks after the pets because his partner always does it.",
        answer: false,
        explanation: "When his partner is away, Sam feeds the cat and the dog, then walks the dog.",
      },
      {
        prompt: "Sam needs to collect some medicine the following day.",
        answer: true,
        explanation: "He says, 'I need to collect some medicine tomorrow.'",
      },
      {
        prompt: "Lea finds that a long nap helps her sleep better at night.",
        answer: false,
        explanation: "A long nap makes sleeping at night harder for Lea.",
      },
      {
        prompt: "Sam tested his new bus route before starting his office job.",
        answer: true,
        explanation: "He tried the route yesterday, before his new job starts on Monday.",
      },
      {
        prompt: "At the end, Sam decides to change every part of his routine immediately.",
        answer: false,
        explanation: "He chooses only two small changes: taking a book on the bus and leaving his phone in the kitchen.",
      },
    ],
    questions: [
      {
        prompt: "What old working habit did Lea change?",
        suggestedAnswer: "She used to stay up late with her laptop, but now she finishes work at six.",
      },
      {
        prompt: "What does Sam currently do with his phone before and during breakfast?",
        suggestedAnswer: "He checks his phone before getting out of bed and checks his messages while eating.",
      },
      {
        prompt: "Why does Lea suggest combining coffee with errands?",
        suggestedAnswer: "It would save Sam from having to go out again later.",
      },
      {
        prompt: "How does Lea save time when preparing dinner?",
        suggestedAnswer: "She cooks extra food at lunchtime so that making dinner is faster.",
      },
      {
        prompt: "How does Sam usually spend the evening after ordering food?",
        suggestedAnswer: "He chills on the sofa until bedtime.",
      },
      {
        prompt: "Why does Sam want an early night?",
        suggestedAnswer: "He feels tired and is preparing for his new office job, which starts on Monday.",
      },
      {
        prompt: "What change in travel is Sam getting used to?",
        suggestedAnswer: "He is getting used to commuting by bus instead of working from home.",
      },
      {
        prompt: "Which two small changes does Sam agree to try at the end?",
        suggestedAnswer: "He will take a book on the bus and leave his phone in the kitchen overnight.",
      },
    ],
  },
];
