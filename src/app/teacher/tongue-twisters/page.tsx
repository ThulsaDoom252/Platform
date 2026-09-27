import { getDict } from "@/lib/i18n/server";
import { listTwistersAction } from "@/lib/actions/tongue-twisters";
import { TwisterPool } from "@/components/twisters/twister-pool";

/** Общий пул скороговорок: он один на учителя, ученикам раздаётся по одной. */
export default async function TongueTwistersPage() {
  const { t } = await getDict();
  const pool = await listTwistersAction();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.twisters.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.twisters.subtitle}</p>
      </div>

      <TwisterPool initial={pool} />
    </div>
  );
}
