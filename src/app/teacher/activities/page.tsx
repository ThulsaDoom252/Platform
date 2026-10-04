import { getDict } from "@/lib/i18n/server";
import {
  listWordDeckActivitiesAction,
} from "@/lib/actions/word-deck";
import { listGuessPicturePresetsAction } from "@/lib/actions/guess-picture";
import { listRevisionPresetsAction } from "@/lib/actions/revision";
import { WordDeckStudio } from "@/components/game/word-deck-studio";
import { GuessPictureStudio } from "@/components/game/guess-picture-studio";
import { RevisionActivityStudio } from "@/components/revision/revision-activity-studio";

/**
 * Активности: витрина игр.
 *
 * Играют в классе — там известен ученик, — поэтому отсюда ведёт ссылка
 * в класс, а не вторая копия настройки. Здесь же видно, сколько слов
 * готово к игре: без картинок играть не во что.
 */
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const { t } = await getDict();
  const { activity: initialActivityId } = await searchParams;
  const [wordDeckActivities, guessPicturePresets, revisionPresets] = await Promise.all([
    listWordDeckActivitiesAction(),
    listGuessPicturePresetsAction(),
    listRevisionPresetsAction(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.nav.activities}</h1>
      </div>

      <WordDeckStudio
        initialActivities={wordDeckActivities.filter((activity) => activity.settings.gameType !== "SPELLING")}
        initialActivityId={initialActivityId}
      />
      <WordDeckStudio
        mode="SPELLING"
        initialActivities={wordDeckActivities.filter((activity) => activity.settings.gameType === "SPELLING")}
        initialActivityId={initialActivityId}
      />
      <RevisionActivityStudio initialPresets={revisionPresets} />
      <GuessPictureStudio initialPresets={guessPicturePresets} />
    </div>
  );
}
