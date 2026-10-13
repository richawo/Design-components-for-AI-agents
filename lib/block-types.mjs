/** Classify a composed page by its purpose, rather than the shell it reuses. */
export const BLOCK_LABELS = {
  dashboard: "Dashboards",
  collaboration: "Collaboration apps",
  media: "Media apps",
  workspace: "Project workspaces",
  report: "Reports",
  settings: "Settings",
  "landing-page": "Landing pages",
};

export const BLOCK_DESCRIPTIONS = {
  dashboard: "Metrics, operational overviews and the decisions behind them.",
  collaboration: "Team conversations, meeting rooms and shared notes.",
  media: "Listening, discovery, libraries and playback queues.",
  workspace: "Focused environments for managing a project or matter.",
  report: "Documents that connect readable evidence with useful analysis.",
  settings: "Account preferences, access policies and working save flows.",
  "landing-page": "Complete product stories, from the first impression to the next step.",
};

export const BLOCK_TYPES = Object.keys(BLOCK_LABELS);
