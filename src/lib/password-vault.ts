import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

function secretKey(secretOverride?: string) {
  const secret =
    secretOverride ??
    (process.env.PASSWORD_VAULT_SECRET || process.env.SESSION_SECRET);

  if (!secret) {
    throw new Error("PASSWORD_VAULT_SECRET or SESSION_SECRET is required");
  }

  // Отдельный контекст не позволяет использовать ключ сейфа как ключ
  // сессии, даже когда оба получены из одной переменной окружения.
  return createHash("sha256")
    .update(`lingora:student-password-vault:${secret}`)
    .digest();
}

/**
 * Обратимая копия нужна только учителю. AES-GCM одновременно шифрует
 * пароль и защищает запись от незаметной подмены. studentId привязан как
 * AAD: переставить шифротекст от одного ученика другому не получится.
 */
export function encryptStudentPassword(
  password: string,
  studentId: string,
  secretOverride?: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(secretOverride), iv);
  cipher.setAAD(Buffer.from(studentId, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptStudentPassword(
  value: string,
  studentId: string,
  secretOverride?: string,
): string | null {
  try {
    const [version, ivPart, tagPart, encryptedPart, extra] = value.split(".");
    if (version !== VERSION || !ivPart || !tagPart || !encryptedPart || extra) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      secretKey(secretOverride),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAAD(Buffer.from(studentId, "utf8"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Повреждённую запись или запись от другого пользователя не раскрываем.
    return null;
  }
}
