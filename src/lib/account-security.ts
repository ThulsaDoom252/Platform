export type SecurityErrorCode =
  | "AUTH_REQUIRED"
  | "CURRENT_PASSWORD_REQUIRED"
  | "WRONG_PASSWORD"
  | "LOGIN_INVALID"
  | "LOGIN_SAME"
  | "LOGIN_TAKEN"
  | "PASSWORD_INVALID"
  | "PASSWORD_MISMATCH"
  | "PASSWORD_SAME"
  | "UNKNOWN";

export type SecurityActionState = {
  success?: "LOGIN" | "PASSWORD";
  error?: SecurityErrorCode;
};

/** Logins stay case-sensitive, just like they are at sign-in. */
export function normalizeTeacherLogin(value: unknown) {
  return String(value ?? "").trim();
}

export function validateTeacherLogin(login: string): SecurityErrorCode | null {
  if (login.length < 3 || login.length > 80 || /\s|[\u0000-\u001f\u007f]/u.test(login)) {
    return "LOGIN_INVALID";
  }
  return null;
}

export function validateTeacherPassword(
  password: string,
  confirmation: string,
): SecurityErrorCode | null {
  if (password.length < 8 || password.length > 128) return "PASSWORD_INVALID";
  if (password !== confirmation) return "PASSWORD_MISMATCH";
  return null;
}
