"use client";

import { useSearchParams } from "next/navigation";
import { AccountPanel } from "./account-panel";

/** URL options affect presentation; authenticated data is fetched by AccountPanel. */
export function AccountRoutePanel() {
  const query = useSearchParams();
  const single = (key: string) => {
    const values = query.getAll(key);
    return values.length === 1 ? values[0] : undefined;
  };
  return <AccountPanel welcome={single("welcome") === "1"} pending={single("pending") === "1"} plan={single("plan")} />;
}
