/**
 * Completes every Activity/Shorts vocabulary entry with the rich fields used
 * by Materials. Run without --apply for an audit; pass --apply to save.
 */
import { config } from "dotenv";
import { Client } from "pg";
import { transcribe } from "../src/lib/transcription-core";
import { categoryColor } from "../src/lib/category-color";

const envArg = process.argv.find((arg) => arg.startsWith("--env="));
config({ path: envArg?.slice("--env=".length) || ".env" });

type Enrichment = { examples: [string, string]; note: string };

const rich: Record<string, Enrichment> = {
  "to wonder": { examples: ["I wonder why he left so early.", "She wondered if the plan would work."], note: "Often followed by if, whether, why, what, or another question word." },
  "to track down": { examples: ["The police tracked down the missing car.", "I finally tracked down the book you wanted."], note: "A phrasal verb for finding someone or something after a difficult search." },
  "to retire": { examples: ["My father plans to retire next year.", "She retired from the army at fifty."], note: "Use retire from for a job or organization; retirement is the noun." },
  "to face": { examples: ["We need to face the problem together.", "The team faces a difficult choice."], note: "Here it means deal with a difficult situation, not simply look toward something." },
  "to make a vow": { examples: ["He made a vow never to lie again.", "They made a vow to protect each other."], note: "A vow is a very serious promise. Use make a vow to do something." },
  "to come out of retirement": { examples: ["The coach came out of retirement for one last season.", "She may come out of retirement to help the team."], note: "The opposite of retire: return to work or an activity after retiring." },
  "to look for": { examples: ["I am looking for my keys.", "They looked for a quiet place to talk."], note: "Look for means try to find. Find means succeed in locating it." },
  "to push somebody's buttons": { examples: ["He knows how to push my buttons.", "That rude joke really pushed her buttons."], note: "An informal idiom meaning deliberately annoy or provoke someone." },
  "to grab": { examples: ["She grabbed my hand before I fell.", "Grab your coat and come with me."], note: "Usually suggests a quick or firm movement; it is less neutral than take." },
  "to count": { examples: ["The child can count to twenty.", "Every minute counts in an emergency."], note: "It can mean say numbers in order or be important." },
  "to slap": { examples: ["He slapped the table with his hand.", "She slapped him across the face."], note: "Hit with an open hand. The noun is a slap." },
  "to draw a weapon": { examples: ["The officer told him not to draw his weapon.", "The guard drew a weapon when he saw the threat."], note: "Here draw means take a weapon out and prepare to use it." },
  "to disarm": { examples: ["The officer disarmed the attacker.", "They managed to disarm the bomb safely."], note: "It can mean take away a weapon or make a bomb unable to explode." },
  "to shoot": { examples: ["Do not shoot at the birds.", "The photographer went outside to shoot a video."], note: "It can mean fire a weapon or record a photo or video; context decides." },
  "to wing": { examples: ["The bullet winged him in the shoulder.", "The hunter only winged the bird."], note: "Informal: wound someone slightly, especially with a bullet." },
  "to injure": { examples: ["He injured his knee during training.", "Three people were injured in the accident."], note: "Injure is common for accidents. Injury is the noun." },
  "to wound": { examples: ["The soldier was wounded in the arm.", "The knife wounded him badly."], note: "Usually used for damage caused by a weapon or violence; wound is also a noun." },
  "to make a mistake": { examples: ["I made a mistake in the report.", "Everyone makes mistakes sometimes."], note: "English uses make a mistake, not do a mistake." },
  "to insist": { examples: ["She insisted on paying for dinner.", "He insisted that the door was locked."], note: "Use insist on + -ing, or insist that + clause." },
  "to concede": { examples: ["He finally conceded that I was right.", "The team conceded defeat after the final round."], note: "Formal: admit something is true or accept defeat." },
  "to deflect": { examples: ["The shield deflected the blow.", "He tried to deflect attention from the real problem."], note: "It can change the direction of a physical object or redirect attention or criticism." },
  "a threat": { examples: ["The police treated the message as a threat.", "Climate change is a serious threat to the island."], note: "Use a threat to someone or something; threaten is the verb." },
  "expertise": { examples: ["We need her technical expertise.", "He has expertise in cybersecurity."], note: "An uncountable noun. Say expertise in a field, not an expertise." },
  "a human being": { examples: ["Every human being needs clean water.", "A robot is not a human being."], note: "A neutral expression emphasizing that someone is a person." },
  "retirement": { examples: ["He plans to travel after retirement.", "She is saving money for her retirement."], note: "The noun from retire. Use in retirement or after retirement." },
  "son of a bitch (SOB)": { examples: ["The villain called him a son of a bitch.", "You clever son of a bitch—you solved it!"], note: "A strong insult, though friends sometimes use it jokingly. Avoid it in polite situations." },
  "a high-stakes situation": { examples: ["A final exam can feel like a high-stakes situation.", "She stays calm in high-stakes situations."], note: "High-stakes describes a situation where success or failure has serious consequences." },
  "a weapon": { examples: ["The guard checked him for a weapon.", "Anything can become a weapon if it is used to hurt someone."], note: "A countable noun: a weapon, several weapons." },
  "an injury": { examples: ["She missed the match because of an injury.", "The doctor examined his shoulder injury."], note: "The result of physical harm. Compare injure, the verb." },
  "a wound": { examples: ["The nurse cleaned the wound.", "He had a deep wound in his leg."], note: "A specific cut or injury to the body, often caused by a weapon." },
  "guts": { examples: ["It takes guts to admit a mistake.", "She had the guts to speak up."], note: "Informal plural noun meaning courage. Use have the guts to do something." },
  "gut": { examples: ["I had a strange feeling in my gut.", "Trust your gut when something feels wrong."], note: "Informal for stomach; gut feeling means a strong instinct." },
  "a gutshot": { examples: ["The character survived a gutshot.", "A gutshot can cause serious internal injuries."], note: "A shot to the stomach area; mainly used in action, crime, or medical contexts." },
  "a headshot": { examples: ["The game gives extra points for a headshot.", "The actor needs a new professional headshot."], note: "It can mean a shot to the head or a portrait photo of a person's face." },
  "during": { examples: ["Please stay quiet during the exam.", "It rained during the night."], note: "During is followed by a noun. Use while before a clause." },
  "unlike": { examples: ["Unlike his brother, Max is very patient.", "This year was unlike any other year."], note: "Use unlike + noun or pronoun to show a difference." },
  "sly": { examples: ["The fox in the story is sly.", "He gave me a sly smile."], note: "Often describes cleverness that is secretive or slightly dishonest." },
  "supposed to": { examples: ["You are supposed to wear a seat belt.", "The train is supposed to arrive at six."], note: "Use be supposed to for rules, expectations, or plans." },
  "That's all behind me now": { examples: ["I made mistakes, but that's all behind me now.", "That difficult period is behind her now."], note: "An idiom meaning a past problem no longer controls your present life." },
  "(have) got to": { examples: ["I've got to finish this today.", "She's got to leave before six."], note: "Informal have to. In fast speech, got to often becomes gotta." },
  "I'm in": { examples: ["We're going hiking tomorrow. I'm in!", "If you need another player, I'm in."], note: "Informal: I agree to participate. The opposite is I'm out." },
  "This is ridiculous": { examples: ["We have waited for three hours. This is ridiculous.", "This price is ridiculous!"], note: "A strong way to say something is unreasonable or absurd." },
  "I'd rather": { examples: ["I'd rather stay home tonight.", "I'd rather you told me the truth."], note: "Use would rather + base verb; for another person's action, use would rather + subject + past form." },
  "Is that all you got?": { examples: ["The boxer smiled and asked, 'Is that all you got?'", "Is that all you've got, or is there more?"], note: "A challenging, informal taunt. The standard form is Is that all you've got?" },

  "to make excuses for smth": { examples: ["Stop making excuses for his behavior.", "She made excuses for being late."], note: "Use make excuses for + noun or -ing. Smth is only a dictionary abbreviation." },
  "period": { examples: ["I am not changing my mind, period.", "You cannot speak to her like that. Period."], note: "At the end of a statement, period means the discussion is finished." },
  "to be frank": { examples: ["To be frank, I do not trust him.", "To be frank with you, the plan is too risky."], note: "A polite signal that a direct or possibly unpleasant opinion is coming." },
  "aid": { examples: ["The country sent medical aid after the earthquake.", "The project depends on international aid."], note: "Usually uncountable when it means help. Aid can also be a verb." },
  "to undermine": { examples: ["The rumor undermined public trust.", "Constant criticism can undermine her confidence."], note: "Means weaken gradually, often in an indirect or hidden way." },
  "to beg": { examples: ["He begged them to stay.", "She begged for another chance."], note: "Use beg someone to do something or beg for something." },
  "as long as": { examples: ["You can stay as long as you are quiet.", "I waited as long as I could."], note: "It can mean provided that or for the whole time that." },
  "a trap": { examples: ["The offer looked good, but it was a trap.", "The animal escaped from the trap."], note: "It can be a physical device or a situation designed to deceive someone." },
  "martial law": { examples: ["The government declared martial law.", "Public gatherings were limited under martial law."], note: "Do not confuse martial with marital, which relates to marriage." },
  "a media outlet": { examples: ["The story appeared in a major media outlet.", "Several media outlets reported the same event."], note: "A news organization or channel, not a physical shop." },
  "to assault": { examples: ["He was arrested for assaulting a police officer.", "The troops assaulted the position at dawn."], note: "A strong formal verb for a physical attack. Assault is also a noun." },
  "rational": { examples: ["We need a rational explanation.", "Try to stay calm and make a rational decision."], note: "Based on reason and evidence rather than emotion." },
  "to point fingers": { examples: ["We need solutions, not people pointing fingers.", "They started pointing fingers at each other."], note: "An idiom meaning blame others, often before the facts are clear." },
  "insistent": { examples: ["She was insistent that we leave immediately.", "His insistent questions made everyone uncomfortable."], note: "The adjective from insist; it describes firm, repeated pressure." },
  "GDP": { examples: ["Tourism makes up a large part of the country's GDP.", "GDP grew by three percent last year."], note: "Pronounced letter by letter. It stands for gross domestic product." },
  "a supplier": { examples: ["We changed our internet supplier.", "The factory needs a reliable parts supplier."], note: "A person or company that supplies goods or services." },
  "a drug dealer": { examples: ["The police arrested a drug dealer.", "He played a drug dealer in the film."], note: "A person who sells illegal drugs; dealer alone has many neutral meanings." },
  "a drug user": { examples: ["The clinic offers help to drug users.", "A drug user may need medical support."], note: "A neutral descriptive term; avoid using it as a label when a more specific phrase is possible." },
  "energized": { examples: ["I felt energized after the walk.", "The good news energized the whole team."], note: "Use feel energized for a state; energize is the verb." },
  "to sniff": { examples: ["The dog sniffed my bag.", "She sniffed the milk to see if it was fresh."], note: "A short breath in through the nose, often to smell something." },
  "to spark": { examples: ["The decision sparked a public debate.", "One comment sparked an argument."], note: "Often followed by a reaction: spark a debate, protest, idea, or conflict." },
  "spark": { examples: ["A spark started the fire.", "Her question provided the spark for a new idea."], note: "A literal flash of fire or a figurative cause that starts something." },

  "mercy": { examples: ["The judge showed mercy to the young man.", "They begged the soldier for mercy."], note: "Common patterns: show mercy, have mercy on someone, and beg for mercy." },
  "mercy kill": { examples: ["The vet had to mercy-kill the badly injured animal.", "The fighter joked that the match would be a mercy kill."], note: "Mercy killing is the usual noun. The verb mercy-kill is rare and often figurative or darkly humorous." },
  "old man": { examples: ["The old man walks in the park every morning.", "Her old man still works at the factory."], note: "Normally an elderly man; informally, someone's father or male partner." },
  "to squeeze": { examples: ["Squeeze the lemon into the tea.", "She squeezed my hand gently."], note: "Means press firmly from two or more sides; it can also mean fit into a tight space." },
  "lungs": { examples: ["Smoking can damage your lungs.", "Take a deep breath and fill your lungs with air."], note: "Normally used in the plural because people have two lungs." },
  "to beg for life": { examples: ["The prisoner began to beg for his life.", "In the film, the victim begs for her life."], note: "The natural phrase is beg for one's life, so the possessive changes with the person." },
  "to open up": { examples: ["It took him time to open up to his therapist.", "She opened up about her childhood."], note: "Use open up to someone or open up about a subject." },
  "the Lord": { examples: ["They prayed to the Lord for help.", "He thanked the Lord for bringing them home safely."], note: "A respectful religious title for God; it is capitalized in this meaning." },
  "to knock out": { examples: ["The boxer knocked out his opponent in round two.", "The medicine knocked me out for eight hours."], note: "It can make someone unconscious literally or make someone sleep very deeply." },
  "to make sense": { examples: ["Your plan makes sense to me.", "This sentence does not make sense."], note: "The subject is the idea or statement: it makes sense. Do not say it has sense." },
  "kind of (kinda)": { examples: ["I am kind of tired today.", "The film was kinda strange, but I liked it."], note: "Kind of softens a statement. Kinda is very informal and mainly represents speech." },
  "a plastic tube": { examples: ["The nurse used a plastic tube to give him water.", "Air travels through the plastic tube."], note: "Tube is a hollow cylinder used to carry air, liquid, or food." },
  "to be paralyzed from the neck down": { examples: ["After the accident, he was paralyzed from the neck down.", "The injury left her paralyzed from the neck down."], note: "Use be or become paralyzed from the neck down. Paralyzed is the American spelling; paralysed is British." },
};

type Row = {
  id: string;
  word: string;
  category: string;
  translation: string | null;
  note: string | null;
  examples: { en: string; tr: string }[];
  ipa_us: string | null;
};

async function translate(texts: string[]): Promise<string[]> {
  const key = (process.env.DEEPL_AUTH_KEY || process.env.DEEPL_KEY || "").trim();
  if (key) {
    try {
      const base = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
      const out: string[] = [];
      for (let at = 0; at < texts.length; at += 50) {
        const batch = texts.slice(at, at + 50);
        const response = await fetch(`${base}/v2/translate`, {
          method: "POST",
          headers: { authorization: `DeepL-Auth-Key ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ text: batch, source_lang: "EN", target_lang: "UK", preserve_formatting: true }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`DeepL ${response.status}`);
        const json = (await response.json()) as { translations: { text: string }[] };
        out.push(...json.translations.map((item) => item.text.trim()));
      }
      return out;
    } catch (error) {
      console.warn(`${String(error)}; using the Google Translate fallback.`);
    }
  }

  const result = new Array<string>(texts.length);
  for (let at = 0; at < texts.length; at += 8) {
    const batch = texts.slice(at, at + 8);
    await Promise.all(batch.map(async (text, index) => {
      const query = new URLSearchParams({ client: "gtx", sl: "en", tl: "uk", dt: "t", q: text });
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Google Translate ${response.status}`);
      const json = (await response.json()) as [Array<[string]>];
      result[at + index] = json[0].map((segment) => segment[0]).join("").trim();
    }));
  }
  return result;
}

async function main() {
  const url = process.env.NEON_DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Database URL is missing");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<Row>(`
      select lw.id, lw.word, lw.category, lw.translation, lw.note, lw.examples, lw.ipa_us
      from lesson_words lw
      join lesson_units lu on lu.id = lw.unit_id
      where lu.kind <> 'REGULAR'
      order by lu.title, lw.sort_order
    `);

    const missingRich = result.rows.filter((row) => !row.note?.trim() || row.examples.length === 0);
    const withoutPlan = missingRich.filter((row) => !rich[row.word]);
    if (withoutPlan.length > 0) {
      throw new Error(`No curated enrichment for: ${[...new Set(withoutPlan.map((row) => row.word))].join(", ")}`);
    }

    const jobs: { row: Row; noteEn: string; examplesEn: [string, string] }[] = [];
    for (const row of missingRich) {
      const item = rich[row.word];
      jobs.push({ row, noteEn: item.note, examplesEn: item.examples });
    }
    // Usage notes stay in English so grammar forms and idioms are never
    // accidentally translated into misleading literal equivalents.
    const sourceTexts = jobs.flatMap((job) => job.examplesEn);
    const translated = sourceTexts.length > 0 ? await translate(sourceTexts) : [];
    let translatedAt = 0;

    const missingTranslations = result.rows.filter((row) => !row.translation?.trim());
    const headwordTranslations = missingTranslations.length > 0
      ? await translate(missingTranslations.map((row) => row.word.replace(/^to\s+/i, "")))
      : [];
    const translationById = new Map(missingTranslations.map((row, index) => [row.id, headwordTranslations[index]]));

    const updates = [];
    for (const row of result.rows) {
      const job = jobs.find((candidate) => candidate.row.id === row.id);
      const note = job ? job.noteEn : row.note;
      const examples = job
        ? job.examplesEn.map((en) => ({ en, tr: translated[translatedAt++] }))
        : row.examples;
      const ipa = row.ipa_us || await transcribe(row.word);
      updates.push({
        id: row.id,
        translation: row.translation || translationById.get(row.id) || null,
        note,
        examples,
        ipa,
        color: categoryColor(row.category),
      });
    }

    console.table({
      lessonsWords: result.rows.length,
      enriched: jobs.length,
      translations: missingTranslations.length,
      transcriptions: updates.filter((item, index) => item.ipa && !result.rows[index].ipa_us).length,
      colors: updates.length,
    });
    if (process.argv.includes("--preview")) {
      console.dir(updates.filter((item) => jobs.some((job) => job.row.id === item.id)).slice(0, 8), { depth: null });
    }
    if (!process.argv.includes("--apply")) {
      console.log("Audit only. Pass --apply to save.");
      return;
    }

    await client.query("begin");
    for (const item of updates) {
      await client.query(
        `update lesson_words
         set translation = $2, note = $3, examples = $4::jsonb, ipa_us = $5, section_color = $6
         where id = $1`,
        [item.id, item.translation, item.note, JSON.stringify(item.examples), item.ipa, item.color],
      );
    }
    await client.query("commit");
    console.log(`Saved ${updates.length} rich lesson words.`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
