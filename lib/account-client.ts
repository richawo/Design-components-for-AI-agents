export class AccountRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function accountPost(path: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new AccountRequestError("Couldn't connect. Check your connection and try again.", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new AccountRequestError(typeof data?.error === "string" ? data.error : "That request couldn't be completed. Please try again.", response.status);
  }
  return data;
}

/** Accept a copied code with spaces or a hyphen, without truncating its last digit. */
export function codeDigits(value: string) { return value.replace(/\D/g, "").slice(0, 6); }

export function pasteCode(current: string, pasted: string, start: number, end: number) {
  const digits = codeDigits(pasted);
  if (!digits) return current;
  return digits.length === 6 ? digits : (current.slice(0, start) + digits + current.slice(end)).slice(0, 6);
}
