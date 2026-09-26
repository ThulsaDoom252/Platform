import { test } from "node:test";
import assert from "node:assert/strict";
import { IRREGULAR_VERBS_BASE, verbKey } from "../src/lib/irregular-verbs-base";

test("справочник разобрался целиком", () => {
  // Список правился руками, поэтому проверяем, что ни одна строка не
  // потеряла колонку: пустая форма в таблице выглядит как ошибка урока.
  assert.ok(
    IRREGULAR_VERBS_BASE.length > 350,
    `глаголов всего ${IRREGULAR_VERBS_BASE.length}`,
  );

  for (const v of IRREGULAR_VERBS_BASE) {
    assert.ok(v.base, "пустая начальная форма");
    assert.ok(v.past, `нет второй формы у ${v.base}`);
    assert.ok(v.participle, `нет третьей формы у ${v.base}`);
    assert.ok(v.translation, `нет перевода у ${v.base}`);
    assert.ok(
      /^[a-z][a-z-]*$/.test(v.base),
      `странная начальная форма: ${v.base}`,
    );
  }
});

test("повторов по трём формам нет", () => {
  const seen = new Set<string>();
  for (const v of IRREGULAR_VERBS_BASE) {
    const key = verbKey(v);
    assert.ok(!seen.has(key), `повтор: ${key}`);
    seen.add(key);
  }
});

test("на месте и частые глаголы, и редкие", () => {
  const bases = new Set(IRREGULAR_VERBS_BASE.map((v) => v.base));
  for (const word of ["be", "go", "write", "read", "put", "swim", "withstand"]) {
    assert.ok(bases.has(word), `потерян ${word}`);
  }
});
