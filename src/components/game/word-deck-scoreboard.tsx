"use client";

import { ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { wordDeckScores, type WordDeckLiveState } from "@/lib/word-deck";

export const wordDeckScoreCopy = {
  en: { score: "Score", results: "Show score", hide: "Hide score", final: "Final score", live: "Score so far", right: "Thumbs up · 1 point", wrong: "Thumbs down · 0 points", unrated: "not rated", rules: "👍 1 point · 👎 0 points. You can change any card’s rating.", student: "Student", teacher: "Teacher" },
  ru: { score: "Счёт", results: "Посмотреть счёт", hide: "Скрыть счёт", final: "Итоговый счёт", live: "Текущий счёт", right: "Палец вверх · 1 балл", wrong: "Палец вниз · 0 баллов", unrated: "без оценки", rules: "👍 1 балл · 👎 0 баллов. Оценку карты можно исправить.", student: "Ученик", teacher: "Учитель" },
  uk: { score: "Рахунок", results: "Переглянути рахунок", hide: "Сховати рахунок", final: "Підсумковий рахунок", live: "Поточний рахунок", right: "Палець вгору · 1 бал", wrong: "Палець вниз · 0 балів", unrated: "без оцінки", rules: "👍 1 бал · 👎 0 балів. Оцінку картки можна змінити.", student: "Учень", teacher: "Вчитель" },
};

export function WordDeckScoreboard({ deck, ratings, final = false, canEdit = false }: Pick<WordDeckLiveState, "deck" | "ratings"> & { final?: boolean; canEdit?: boolean }) {
  const { locale } = useT();
  const labels = wordDeckScoreCopy[locale];
  const scores = wordDeckScores(deck, ratings);
  return <section data-word-deck-scores className="mx-auto mt-4 max-w-2xl rounded-2xl border border-white/20 bg-slate-950/35 p-4 shadow-lg backdrop-blur-sm">
    <h4 className="flex items-center justify-center gap-2 text-sm font-black"><Trophy className="h-4 w-4 text-amber-300" />{final ? labels.final : labels.live}</h4>
    <div className="mt-3 grid grid-cols-2 gap-3">
      {(["STUDENT", "TEACHER"] as const).map(owner => {
        const score = scores[owner];
        return <div key={owner} data-score-owner={owner} className="rounded-xl border border-white/15 bg-white/10 p-3 text-center">
          <p className="text-xs font-bold text-white/80">{owner === "STUDENT" ? labels.student : labels.teacher}</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{score.right}<span className="ml-1 text-sm font-semibold text-white/55">/ {score.total}</span></p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold"><span className="inline-flex items-center gap-1 text-emerald-200"><ThumbsUp className="h-3 w-3" />{score.right}</span><span className="inline-flex items-center gap-1 text-rose-200"><ThumbsDown className="h-3 w-3" />{score.wrong}</span></p>
          <p className="mt-1 text-[10px] text-white/60">{score.total - score.right - score.wrong} {labels.unrated}</p>
        </div>;
      })}
    </div>
    <p className="mt-3 text-center text-[11px] text-white/65">{canEdit ? labels.rules : "👍 1 · 👎 0"}</p>
  </section>;
}
