import { cn } from "@/lib/utils";

/** Стабильный цвет палитры по имени — чтобы аватар не «прыгал» между рендерами. */
function chipFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ["grad-c1", "grad-c2", "grad-c3", "grad-c4"][h % 4];
}

function firstLetter(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

/**
 * Аватар пользователя: фото, если загружено, иначе цветной фон
 * с первой буквой имени.
 */
export function Avatar({
  name,
  src,
  className,
  textClassName,
}: {
  name: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        chipFor(name),
        className,
        textClassName,
      )}
    >
      {firstLetter(name)}
    </span>
  );
}
