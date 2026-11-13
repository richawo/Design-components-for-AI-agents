// Exact example literals also used by the guide snippets. Identifiers,
// passages and transcript words stay in the fixture's source language.
export const traceSpans = [
  { id: "run", name: "Run", from: 0, to: 700 },
  { id: "lookup", name: "Lookup", from: 100, to: 500 },
  { id: "call", name: "Call", from: 200, to: 450 },
  { id: "retry", name: "Retry", from: 500, to: 700 },
] as const;

export const milliseconds = "ms";

export const citation = {
  claim: "The sandbox lasts seven days.",
  source: "Sandbox guide · example.test",
  quote: "The sandbox ends ",
  match: "after seven days",
};

export const attachment = { draft: "Compare the numbers in this draft.", file: "report.pdf" };
export const modelImage = "image.png";
export const voiceTranscript = { heard: "We found…", complete: "We found two records." };
