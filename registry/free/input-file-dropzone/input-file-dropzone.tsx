"use client";
import { type CSSProperties, useId, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
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

export type FileDropzoneProps = {
  title?: string;
  hint?: string;
  files?: File[];
  defaultFiles?: File[];
  accept?: string;
  maxBytes?: number;
  maxFiles?: number;
  disabled?: boolean;
  onChange?: (files: File[]) => void;
  theme?: "dark" | "light";
};
function accepts(file: File, accept: string) {
  return (
    !accept.trim() ||
    accept.split(",").some((raw) => {
      const rule = raw.trim().toLowerCase();
      if (!rule) return false;
      return rule.startsWith(".")
        ? file.name.toLowerCase().endsWith(rule)
        : rule.endsWith("/*")
          ? file.type.toLowerCase().startsWith(rule.slice(0, -1))
          : file.type.toLowerCase() === rule;
    })
  );
}
export function FileDropzone({
  title = "Bring your source material.",
  hint = "Drop documents here, or choose them from your device.",
  files,
  defaultFiles = [],
  accept = ".pdf,.md,.txt",
  maxBytes = 10 * 1024 * 1024,
  maxFiles = 5,
  disabled = false,
  onChange,
  theme = "dark",
}: FileDropzoneProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [local, setLocal] = useState(defaultFiles);
  const [error, setError] = useState("");
  const selected = files ?? local;
  const cap = Number.isFinite(maxFiles) ? Math.max(0, Math.floor(maxFiles)) : 5;
  const sizeCap = Number.isFinite(maxBytes)
    ? Math.max(0, maxBytes)
    : 10 * 1024 * 1024;
  function update(next: File[]) {
    setLocal(next);
    onChange?.(next);
  }
  function add(incoming: File[]) {
    if (disabled) return;
    const next = [...selected];
    const rejected: string[] = [];
    for (const f of incoming) {
      if (!accepts(f, accept)) rejected.push(`${f.name}: unsupported type`);
      else if (f.size > sizeCap) rejected.push(`${f.name}: too large`);
      else if (
        next.some(
          (x) =>
            x.name === f.name &&
            x.size === f.size &&
            x.lastModified === f.lastModified,
        )
      )
        rejected.push(`${f.name}: already added`);
      else if (next.length >= cap)
        rejected.push(`${f.name}: file limit reached`);
      else next.push(f);
    }
    if (next.length !== selected.length) update(next);
    setError(rejected.join(". "));
  }
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          add(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-lg border border-dashed p-6 transition-colors ${dragging ? "border-[var(--ink)] bg-[var(--wash)]" : "border-[var(--line)]"}`}
      >
        <Upload size={28} strokeWidth={1.3} aria-hidden="true" />
        <h2
          id={id}
          className="mt-5 font-serif text-3xl leading-tight tracking-[-.03em]"
        >
          {title}
        </h2>
        <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{hint}</p>
        <button
          type="button"
          data-demo="browse-files"
          disabled={disabled || selected.length >= cap}
          onClick={() => input.current?.click()}
          className={`${control} mt-5 border border-[var(--line)]`}
        >
          Choose files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Choose source files"
          className="hidden"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <p className={`mt-3 break-words font-mono text-xs ${muted}`}>
          {accept || "All file types"} · up to{" "}
          {Number((sizeCap / 1048576).toFixed(1))} MB each
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {selected.map((f, i) => (
          <motion.li
            layout={!reduced}
            key={`${f.name}-${f.lastModified}-${i}`}
            className="flex items-center gap-3 rounded-lg bg-[var(--wash)] px-3 py-2"
          >
            <FileText size={20} className="shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{f.name}</p>
              <p className={`mt-1 font-mono text-xs ${muted}`}>
                {(f.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              data-demo={`remove-file-${i}`}
              disabled={disabled}
              aria-label={`Remove ${f.name}`}
              onClick={() => {
                update(selected.filter((_, j) => j !== i));
                setError("");
              }}
              className={`${control} shrink-0 p-0`}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </motion.li>
        ))}
      </ul>
      <p
        role="status"
        className={`mt-4 break-words text-xs leading-relaxed ${muted}`}
      >
        {error || `${selected.length} of ${cap} files selected.`}
      </p>
    </section>
  );
}
export default function FileDropzoneDemo(
  overrides: Partial<FileDropzoneProps> = {},
) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div
      className="flex min-h-[680px] flex-col items-center justify-center gap-4 p-4 sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <FileDropzone files={files} onChange={setFiles} {...overrides} />
      <button
        type="button"
        data-demo="sample-file"
        onClick={() =>
          setFiles([
            new File(
              ["# Product direction\nA focused tool for thoughtful teams."],
              "product-brief.md",
              { type: "text/markdown", lastModified: 0 },
            ),
          ])
        }
        className={`${control} ${overrides.theme === "light" ? "text-neutral-700" : "text-neutral-300"}`}
        style={colors(overrides.theme ?? "dark")}
      >
        Try a sample document
      </button>
    </div>
  );
}
