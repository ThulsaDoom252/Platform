/** Sending a navigation command must not wait behind a lesson's autosave/upload. */
export async function sendClassSummons(studentId: string): Promise<{ error?: string; commandId?: string; expiresAt?: string }> {
  const response = await fetch("/api/class/summons/send", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }), signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (typeof result?.error === "string") return { error: result.error };
  if (!response.ok) throw new Error("Class command unavailable");
  return result;
}
