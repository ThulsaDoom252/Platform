import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { materialBlocks, materialNodes, materialPhrases, studentLearningTranslations, users } from "./db/schema";
import { applyLearningTranslations, collectLearningTranslations, type LearningLanguage, type LearningSegment } from "./learning-language-content";

// The same ECMAScript whitespace characters used by String.trim(), rather than
// PostgreSQL's narrower default btrim (a regular space only).
const JS_WHITESPACE = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
const explainContext = "English learning translation";
const pairedPrefix = "English learning item: ";
const pairedMiddle = ". Existing translation (sense/context only): ";
const quoted = (value: SQL) => sql`to_json(${value})::text`;
const jsonContent = (value: SQL) => sql`substring(${quoted(value)} from 2 for length(${quoted(value)}) - 2)`;
const trimmed = (value: SQL) => sql`btrim(coalesce(${value}, ''), ${JS_WHITESPACE})`;

/** JSON-string contents of JavaScript text.slice(0, 1000), including a split surrogate. */
export function learningJsonPrefixSql(value: SQL): SQL {
  const text = sql`coalesce(${value}, '')`;
  return sql`(case when length(${text}) <= 500 then ${jsonContent(text)} else (
    select ${jsonContent(sql`coalesce(string_agg(character, '' order by ordinal) filter (where units <= 1000), '')`)}
      || coalesce(max(case when units = 1001 and octet_length(character) = 4
        then chr(92) || 'u' || to_hex(55296 + (ascii(character) - 65536) / 1024) else '' end), '')
    from (
      select character, ordinal, sum(case when octet_length(character) = 4 then 2 else 1 end)
        over (order by ordinal) as units
      from regexp_split_to_table(${text}, '') with ordinality as prefix(character, ordinal)
    ) as characters
  ) end)`;
}

/** Exact JSON.stringify array layout used by learningSegmentId; no pgcrypto extension. */
export function learningSegmentKeySql(input: {
  studentId: SQL; language: SQL; text: SQL; source: SQL; contextJson: SQL;
}): SQL {
  return sql`encode(sha256(convert_to(
    '[' || ${quoted(sql`${input.studentId}::text`)} || ',' || ${quoted(sql`${input.language}::text`)}
      || ',' || ${quoted(input.text)} || ',' || coalesce(${quoted(input.source)}, 'null')
      || ',' || ${input.contextJson} || ']', 'UTF8'
  )), 'hex')`;
}

function detectedLanguage(text: SQL, fallback: SQL): SQL {
  const uk = sql`length(regexp_replace(coalesce(${text}, ''), '[^іїєґІЇЄҐ]', '', 'g'))`;
  const ru = sql`length(regexp_replace(coalesce(${text}, ''), '[^ыэъёЫЭЪЁ]', '', 'g'))`;
  return sql`(case when ${uk} = 0 and ${ru} = 0 then ${fallback}
    when ${uk} > ${ru} then 'UK' else 'RU' end)`;
}

/** Same hint as buildTree/pageTranslationLang: translation + section + note, then rule JSON. */
export function dictionaryPageTranslationHintSql(): SQL {
  return sql`(select ${detectedLanguage(sql`coalesce(string_agg(content, ' '), '')`, sql`${materialNodes.translationLang}::text`)}
    from (
      select concat_ws(' ', ${materialPhrases.translation}, ${materialPhrases.section}, ${materialPhrases.note}) as content
      from ${materialPhrases} where ${materialPhrases.nodeId} = ${materialNodes.id}
      union all
      select ${materialBlocks.data}::text from ${materialBlocks} where ${materialBlocks.nodeId} = ${materialNodes.id}
    ) as page_language)`;
}

/**
 * Read only an exact existing cache row for this current student's target language.
 * Missing cache entries retain the stored field; this lookup never translates or warms a cache.
 * Pass english=null for an explanatory note/NOTE item, not an English/translation pair.
 */
export function cachedDictionaryTextSql(current: SQL, english: SQL | null, pageHint: SQL): SQL<string | null> {
  const target = sql`${users.learningLanguage}::text`;
  const text = trimmed(current);
  const en = english === null ? sql`''::text` : trimmed(english);
  const source = detectedLanguage(text, pageHint);
  const sourceText = sql`(case when ${en} <> '' then ${en} else ${text} end)`;
  const sourceLanguage = sql`(case when ${en} <> '' then 'EN' else ${source} end)`;
  const contextJson = english === null ? sql`${JSON.stringify(explainContext)}::text` : sql`(
    '"' || ${pairedPrefix} || ${learningJsonPrefixSql(english)} || ${pairedMiddle}
    || ${learningJsonPrefixSql(current)} || '"'
  )`;
  const key = learningSegmentKeySql({ studentId: sql`${users.id}`, language: target, text: sourceText, source: sourceLanguage, contextJson });
  return sql<string | null>`(/* cached_dictionary_text */ case
    when ${materialNodes.scope} <> 'STUDENT' or ${target} is null then ${current}
    when ${text} <> '' and ${source} = ${target} then ${current}
    when ${sourceText} = '' or (${text} <> '' and ${text} !~ '[Ѐ-ӿ]' and ${en} = '') then ${current}
    else coalesce((select ${studentLearningTranslations.translation} from ${studentLearningTranslations}
      where ${studentLearningTranslations.id} = ${key}
        and ${studentLearningTranslations.studentId} = ${users.id}
        and ${studentLearningTranslations.language}::text = ${target}
      limit 1), ${current}) end)`;
}

/** Match the paired-vs-explanation choice made by collectLearningTranslations. */
export function cachedDictionaryTranslationSql(current: SQL, english: SQL, pageHint: SQL, noteCondition?: SQL): SQL<string | null> {
  return sql<string | null>`(case when ${english} ~ '[Ѐ-ӿ]' ${noteCondition ? sql`or ${noteCondition}` : sql``}
    then ${cachedDictionaryTextSql(current, null, pageHint)}
    else ${cachedDictionaryTextSql(current, english, pageHint)} end)`;
}

export function cachedDictionaryPhraseTitleSql(pageHint: SQL): SQL<string> {
  return sql<string>`(case when ${materialPhrases.kind} = 'NOTE'
    then ${cachedDictionaryTextSql(sql`${materialPhrases.phrase}`, null, pageHint)}
    else ${materialPhrases.phrase} end)`;
}

export function dictionaryLearningSegmentId(studentId: string, language: LearningLanguage, segment: LearningSegment): string {
  return createHash("sha256").update(JSON.stringify([studentId, language, segment.text, segment.source ?? null, segment.context])).digest("hex");
}

/** Bounded-entry verification/hydration, never a full tree and never a cache fill. */
export function applyCachedDictionaryTranslations<T>(value: T, studentId: string, target: LearningLanguage, cache: ReadonlyMap<string, string>): T {
  const plan = collectLearningTranslations(value, target);
  const keys = plan.segments.map((segment) => dictionaryLearningSegmentId(studentId, target, segment));
  const translated = plan.segments.map((segment, index) => cache.get(keys[index]) ?? segment.text);
  const available = new Set(keys.flatMap((key, index) => cache.has(key) ? [index] : []));
  return applyLearningTranslations(value, target, { ...plan, patches: plan.patches.filter((patch) => available.has(patch.segment)) }, translated);
}
