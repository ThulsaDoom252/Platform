/**
 * Счётные строки словаря: «1 пример», «2 примера», «5 примеров».
 * Форму выбираем по числу; у русского и украинского правило одинаковое,
 * поэтому язык знать не нужно — достаточно того, какие формы заданы.
 */
export type Plural = { one: string; few?: string; many?: string; other: string };

export function plural(forms: Plural, n: number): string {
  // Нет славянских форм — значит английский: одна штука или много.
  if (!forms.few && !forms.many) return n === 1 ? forms.one : forms.other;

  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms.few ?? forms.other;
  }
  return forms.many ?? forms.other;
}
