"use client";
import { type CSSProperties, useId, useState } from "react";
import { Folder, FileCode, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type ExplorerNode = {
  id: string;
  name: string;
  kind: "file" | "folder";
  children?: ExplorerNode[];
  detail?: string;
};
export type FileExplorerProps = {
  title?: string;
  nodes?: ExplorerNode[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelect?: (file: ExplorerNode) => void;
  theme?: "dark" | "light";
};
const defaults: ExplorerNode[] = [
  {
    id: "src",
    name: "src",
    kind: "folder",
    children: [
      {
        id: "components",
        name: "components",
        kind: "folder",
        children: [
          {
            id: "button",
            name: "button.tsx",
            kind: "file",
            detail: "A small, accessible action with honest loading feedback.",
          },
          {
            id: "panel",
            name: "panel.tsx",
            kind: "file",
            detail: "A responsive surface with an intentional hierarchy.",
          },
        ],
      },
      {
        id: "tokens",
        name: "tokens.css",
        kind: "file",
        detail: "Colour, spacing and motion values for the interface.",
      },
    ],
  },
  {
    id: "readme",
    name: "README.md",
    kind: "file",
    detail:
      "Start here. Installation, examples and the decisions behind the system.",
  },
  {
    id: "package",
    name: "package.json",
    kind: "file",
    detail: "Project dependencies and useful development commands.",
  },
];
export function FileExplorer({
  title = "studio-kit",
  nodes = defaults,
  selectedId,
  defaultSelectedId = "readme",
  onSelect,
  theme = "dark",
}: FileExplorerProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(defaultSelectedId);
  const selected = selectedId ?? local;
  const [closed, setClosed] = useState<string[]>([]);
  const files: ExplorerNode[] = [];
  function collect(items: ExplorerNode[], depth = 0) {
    if (depth > 24) return;
    for (const n of items) {
      if (n.kind === "file") files.push(n);
      else collect(n.children ?? [], depth + 1);
    }
  }
  collect(nodes);
  const file = files.find((f) => f.id === selected);
  function branch(
    items: ExplorerNode[],
    path: string,
    depth = 0,
  ): React.ReactNode {
    if (depth > 24)
      return (
        <li className={`py-3 text-xs ${muted}`}>Folder depth limit reached.</li>
      );
    return items.map((node, i) => {
      const branchId = `${id}-${path}-${i}`;
      const expanded = !closed.includes(node.id);
      return (
        <li key={`${node.id}-${i}`} className="min-w-0">
          <button
            type="button"
            data-demo={`node-${node.id}`}
            title={node.name}
            aria-expanded={node.kind === "folder" ? expanded : undefined}
            aria-controls={node.kind === "folder" ? branchId : undefined}
            aria-pressed={
              node.kind === "file" ? selected === node.id : undefined
            }
            onClick={() => {
              if (node.kind === "folder")
                setClosed(
                  expanded
                    ? [...closed, node.id]
                    : closed.filter((x) => x !== node.id),
                );
              else {
                setLocal(node.id);
                onSelect?.(node);
              }
            }}
            className={`${control} w-full min-w-0 justify-start! gap-2 px-2 font-mono text-xs ${selected === node.id ? "bg-[var(--wash)]" : ""}`}
          >
            {node.kind === "folder" ? (
              <>
                <ChevronRight
                  size={13}
                  aria-hidden="true"
                  className={`shrink-0 ${expanded ? "rotate-90" : ""}`}
                />
                <Folder size={16} aria-hidden="true" className="shrink-0" />
              </>
            ) : (
              <FileCode
                size={16}
                aria-hidden="true"
                className="ml-5 shrink-0"
              />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {node.kind === "folder" && (
            <ul
              id={branchId}
              hidden={!expanded}
              className="ml-4 border-l border-[var(--line)] pl-2"
            >
              {node.children?.length ? (
                branch(node.children, `${path}-${i}`, depth + 1)
              ) : (
                <li className={`px-3 py-3 text-xs ${muted}`}>Empty folder</li>
              )}
            </ul>
          )}
        </li>
      );
    });
  }
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      <h2
        id={id}
        className="border-b border-[var(--line)] px-5 py-4 font-mono text-sm"
      >
        {title}
      </h2>
      <div className="grid @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <nav aria-label={`${title} files`} className="min-w-0 p-3">
          <ul>{branch(nodes, "root")}</ul>
          {!nodes.length && (
            <p className={`p-4 text-sm ${muted}`}>No files in this project.</p>
          )}
        </nav>
        <motion.div
          key={file?.id}
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 border-t border-[var(--line)] p-6 @xl:border-l @xl:border-t-0"
        >
          <FileCode
            size={28}
            strokeWidth={1.2}
            className={muted}
            aria-hidden="true"
          />
          <p className="mt-5 break-words font-mono text-sm font-medium">
            {file?.name ?? "Select a file"}
          </p>
          <p className={`mt-3 text-sm leading-relaxed ${muted}`}>
            {file?.detail ?? "File details appear here."}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default function FileExplorerDemo(
  overrides: Partial<FileExplorerProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <FileExplorer {...overrides} />
    </div>
  );
}
