import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalsCss = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

test("Tailwind dark variants follow the application's data-mode setting", () => {
  assert.ok(
    globalsCss.includes(
      '@custom-variant dark (&:where(:root[data-mode="dark"], :root[data-mode="dark"] *));',
    ),
  );
  assert.match(globalsCss, /:root\[data-mode=["']dark["']\]\s*\{/);
});
