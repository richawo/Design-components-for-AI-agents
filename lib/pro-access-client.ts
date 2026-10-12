"use client";

let pending: Promise<boolean> | null = null;

/** Read entitlement without downloading a component's source. Coalesce only concurrent checks. */
export function fetchProAccess(): Promise<boolean> {
  if (pending) return pending;
  const request = fetch("/api/license/me", {
    credentials: "same-origin",
    cache: "no-store",
  }).then(async (response) => {
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) throw new Error("Pro access could not be checked.");
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("active" in data) ||
      typeof data.active !== "boolean"
    )
      throw new Error("Pro access could not be checked.");
    return data.active;
  });
  pending = request;
  const clear = () => {
    if (pending === request) pending = null;
  };
  request.then(clear, clear);
  return request;
}
