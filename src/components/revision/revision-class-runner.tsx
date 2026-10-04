"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  myClassRevisionAction,
  type RevisionCard,
} from "@/lib/actions/revision";
import { RevisionRunner } from "@/components/revision/revision-runner";

export function RevisionClassRunner({ revisionId }: { revisionId: string }) {
  const { t } = useT();
  const [card, setCard] = useState<RevisionCard | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    myClassRevisionAction(revisionId)
      .then((next) => alive && setCard(next))
      .catch(() => alive && setCard(null));
    return () => { alive = false; };
  }, [revisionId]);

  if (card === undefined) {
    return <p className="py-10 text-center text-sm text-faint">{t.common.loading}</p>;
  }
  if (!card) {
    return <p className="py-10 text-center text-sm font-semibold text-rose-500">{t.revision.failed}</p>;
  }
  return <RevisionRunner card={card} embedded />;
}
