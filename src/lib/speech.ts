/**
 * Очищает учебную подпись перед передачей системному английскому голосу.
 * Служебные emoji, нумерация и подсказки в скобках остаются на экране,
 * но не должны произноситься вслух.
 */
export function speakableText(text: string): string {
  return text
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
    .replace(/[\u200D\u20E3\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, " ")
    .replace(/\p{N}+/gu, " ")
    .replace(/^\s*[.)\]:;,_-]+\s*/u, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
