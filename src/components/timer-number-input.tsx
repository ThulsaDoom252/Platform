"use client";

import { useState, type ComponentProps } from "react";
import { editTimerInput, syncTimerInput } from "@/lib/timer-settings";

/** Keep the editable string separate from the numeric settings sent on Save. */
export function TimerNumberInput({ value, onChange, ...props }: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => ({ value, text: String(value) }));
  const current = syncTimerInput(draft, value);
  if (current !== draft) setDraft(current);
  return <input {...props} type="number" value={current.text} onChange={(event) => {
    const next = editTimerInput(event.target.value);
    setDraft(next);
    onChange(next.value);
  }} />;
}
