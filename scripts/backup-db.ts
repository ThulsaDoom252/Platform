/**
 * Копия базы в ./backups.
 *
 * Зовёт pg_dump, поэтому нужен установленный PostgreSQL. Путь к нему
 * берётся из PG_DUMP, иначе ищется в PATH, иначе — в стандартных местах
 * установки на Windows.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function findPgDump(): string {
  if (process.env.PG_DUMP) return process.env.PG_DUMP;

  const exe = process.platform === "win32" ? "pg_dump.exe" : "pg_dump";
  // Сначала пробуем PATH — если сработает, путь искать не нужно.
  if (spawnSync(exe, ["--version"], { stdio: "ignore" }).status === 0) return exe;

  if (process.platform === "win32") {
    for (let v = 18; v >= 13; v--) {
      const p = `C:\\Program Files\\PostgreSQL\\${v}\\bin\\pg_dump.exe`;
      if (existsSync(p)) return p;
    }
  }

  throw new Error(
    "Не нашёл pg_dump. Укажи путь к нему в переменной PG_DUMP в .env, " +
      "например PG_DUMP=\"C:\\\\Program Files\\\\PostgreSQL\\\\17\\\\bin\\\\pg_dump.exe\"",
  );
}

function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Не задана DATABASE_URL. Скопируй .env.example в .env.");

  const db = new URL(url);
  const dir = resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });

  const stamp = new Date()
    .toLocaleString("sv-SE")        // 2026-09-22 23:41:07 — уже без часового пояса
    .replace(/[: ]/g, "-")
    .slice(0, 16);
  const file = join(dir, `${db.pathname.slice(1)}-${stamp}.sql`);

  console.log(`Снимаю копию базы ${db.pathname.slice(1)}…`);

  const res = spawnSync(
    findPgDump(),
    [
      "--host", db.hostname,
      "--port", db.port || "5432",
      "--username", decodeURIComponent(db.username),
      "--dbname", db.pathname.slice(1),
      "--no-owner",
      "--no-privileges",
      "--file", file,
    ],
    {
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, PGPASSWORD: decodeURIComponent(db.password) },
    },
  );

  if (res.status !== 0) {
    throw new Error(`pg_dump завершился с кодом ${res.status}. Копия не снята.`);
  }

  const kb = Math.round(statSync(file).size / 1024);
  console.log(`Готово: ${file} (${kb} КБ)`);
  console.log("Восстановить:  psql -U <роль> -d <база> -f <файл>");
}

main();
