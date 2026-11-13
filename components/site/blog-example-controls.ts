"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const enabled = () => true;
const disabled = () => false;

// Use the same state on the server and on the first hydration render.
export function useBlogExampleControls() {
  return useSyncExternalStore(subscribe, enabled, disabled);
}
