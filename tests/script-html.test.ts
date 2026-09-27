import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanScriptHtml, scriptPreview } from "../src/lib/script-html";

test("обычное оформление проходит целиком", () => {
  const html =
    '<h3>Warm up</h3><p><b>Привет</b>, <i>как дела</i>?</p><ul><li>раз</li><li>два</li></ul>';
  assert.equal(cleanScriptHtml(html), html);
});

test("цвет и выравнивание остаются", () => {
  const html = '<p style="color: #ff0000; text-align: center">Важное</p>';
  assert.match(cleanScriptHtml(html), /color: #ff0000/);
  assert.match(cleanScriptHtml(html), /text-align: center/);
});

test("скрипты вырезаются вместе с содержимым", () => {
  const out = cleanScriptHtml('<p>до</p><script>alert(1)</script><p>после</p>');
  assert.equal(out, "<p>до</p><p>после</p>");
  assert.ok(!out.includes("alert"));
});

test("обработчики событий не проходят", () => {
  const out = cleanScriptHtml('<p onclick="steal()" onmouseover="x()">текст</p>');
  assert.equal(out, "<p>текст</p>");
});

test("ссылка на javascript отбрасывается, обычная остаётся", () => {
  assert.equal(cleanScriptHtml('<a href="javascript:alert(1)">клик</a>'), "<a>клик</a>");
  assert.match(
    cleanScriptHtml('<a href="https://grammarway.com">разбор</a>'),
    /href="https:\/\/grammarway\.com" target="_blank"/,
  );
});

test("чужие теги отбрасываются, текст внутри остаётся", () => {
  assert.equal(cleanScriptHtml("<form><p>текст</p></form>"), "<p>текст</p>");
  assert.equal(cleanScriptHtml("<marquee>бежит</marquee>"), "бежит");
});

test("картинка через стиль не подтягивается", () => {
  const out = cleanScriptHtml('<p style="background: url(http://чужой/pixel.png)">текст</p>');
  assert.ok(!out.includes("url("));
});

test("выжимка показывает начало без разметки", () => {
  assert.equal(
    scriptPreview("<h3>Warm&nbsp;up</h3><p>Поговорить о выходных</p>"),
    "Warm up Поговорить о выходных",
  );
  assert.equal(scriptPreview("<p>" + "а".repeat(200) + "</p>").length, 91);
});
