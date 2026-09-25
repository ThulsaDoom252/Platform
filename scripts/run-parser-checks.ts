/**
 * Прогон сценарных проверок из scripts/test-*.ts.
 *
 * Они писались как самостоятельные скрипты и печатают разбор целиком —
 * это удобно, когда правишь парсер руками, но бесполезно в общем прогоне.
 * Здесь каждый запускается отдельным процессом, а наружу выходит только
 * «прошло/упало»; вывод показывается лишь у упавших.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "scripts");
const files = readdirSync(dir)
  .filter((name) => name.startsWith("test-") && name.endsWith(".ts"))
  .sort();

if (files.length === 0) {
  console.log("Сценарных проверок не найдено.");
  process.exit(0);
}

let failed = 0;

for (const name of files) {
  const run = spawnSync(
    process.execPath,
    [join(dir, "..", "node_modules", "tsx", "dist", "cli.mjs"), join(dir, name)],
    { encoding: "utf8" },
  );

  const ok = run.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "✔" : "✖"} ${name}`);

  if (!ok) {
    const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
    console.log(out.split("\n").slice(-12).map((line) => "    " + line).join("\n"));
  }
}

console.log(`\nсценарных проверок: ${files.length}, упало: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
