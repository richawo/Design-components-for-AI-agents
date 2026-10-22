"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/lib/site";
import { CopyButton } from "./copy-button";

/**
 * One place to connect any agent. Every route signs in through the browser
 * (OAuth at /mcp/pro), so nothing secret is pasted into a config file, chat or
 * install link. With a licence key (the account page), key-based routes for
 * the CLI and headless setups are offered too, filled in and ready to copy.
 */

export const MCP_URL = `${site.url}/mcp/pro`;
export const MCP_NAME = "design-for-ai";

export const cursorInstallUrl = (url = MCP_URL) =>
  `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_NAME}&config=${btoa(JSON.stringify({ url }))}`;
export const vscodeInstallUrl = (url = MCP_URL) =>
  `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: MCP_NAME, type: "http", url }))}`;
export const setupPrompt = (url = MCP_URL) =>
  `Connect the Design for AI MCP server to this agent. Add a remote (Streamable HTTP) MCP server named ${MCP_NAME} with the URL ${url}, using this tool's own MCP command or configuration file. It signs me in through my browser with OAuth, so don't add an API key or Authorization header. Then start the sign-in (for example /mcp in Claude Code, or codex mcp login ${MCP_NAME} in Codex), and confirm the design-for-ai tools are available.`;

type Client = { id: string; label: string; body: ReactNode };

function Code({ text, label = "Copy" }: { text: string; label?: string }) {
  return <div className="mt-3 flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.08] bg-black/30 p-3">
    <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[12px] leading-relaxed text-site-fg"><code>{text}</code></pre>
    <CopyButton text={text} label={label} className="shrink-0" />
  </div>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return <li className="flex gap-3"><span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10px] text-site-fg-3">{n}</span><div className="min-w-0 flex-1 text-[15px] leading-relaxed text-site-fg-2">{children}</div></li>;
}

function InstallLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="site-btn site-btn-primary mt-3 inline-flex h-11 items-center gap-2 px-5 text-sm">{children}<ArrowUpRight aria-hidden="true" className="size-4" /></a>;
}

function clients(url: string): Client[] {
  return [
    { id: "claude-code", label: "Claude Code", body: <ol className="space-y-5">
      <Step n={1}>Add the server:<Code text={`claude mcp add --transport http ${MCP_NAME} ${url}`} /></Step>
      <Step n={2}>In Claude Code, run <code className="font-mono text-site-fg">/mcp</code>, choose <span className="text-site-fg">design-for-ai</span> and select Authenticate. Approve in the browser window that opens.</Step>
    </ol> },
    { id: "claude", label: "Claude app", body: <ol className="space-y-5">
      <Step n={1}>In Claude on the web or desktop, open Settings, then Connectors, and select Add custom connector.</Step>
      <Step n={2}>Name it Design for AI and paste this URL:<Code text={url} label="Copy URL" /></Step>
      <Step n={3}>Select Connect and approve in the browser. On Team and Enterprise plans, an owner adds the connector for the organization first.</Step>
    </ol> },
    { id: "chatgpt", label: "ChatGPT", body: <ol className="space-y-5">
      <Step n={1}>In ChatGPT settings, open Apps and Connectors, then Advanced settings, and turn on Developer mode. Menu names vary by plan.</Step>
      <Step n={2}>Create a connector, paste this URL and choose OAuth authentication:<Code text={url} label="Copy URL" /></Step>
      <Step n={3}>Approve in the browser. ChatGPT can't send a licence key header, so signing in is how it gets Pro.</Step>
    </ol> },
    { id: "cursor", label: "Cursor", body: <ol className="space-y-5">
      <Step n={1}>Add the server to Cursor in one click:<div><InstallLink href={cursorInstallUrl(url)}>Add to Cursor</InstallLink></div></Step>
      <Step n={2}>In Cursor settings, under MCP, the server shows Needs login. Select it and approve in the browser.</Step>
      <Step n={3}>Prefer a file? Put this in <code className="font-mono text-site-fg">~/.cursor/mcp.json</code> or the project&apos;s <code className="font-mono text-site-fg">.cursor/mcp.json</code>:<Code text={JSON.stringify({ mcpServers: { [MCP_NAME]: { url } } }, null, 2)} /></Step>
    </ol> },
    { id: "vscode", label: "VS Code", body: <ol className="space-y-5">
      <Step n={1}>Add the server to VS Code in one click:<div><InstallLink href={vscodeInstallUrl(url)}>Add to VS Code</InstallLink></div></Step>
      <Step n={2}>Start the server when VS Code asks, then allow it to sign in and approve in the browser.</Step>
      <Step n={3}>Prefer a file? Put this in <code className="font-mono text-site-fg">.vscode/mcp.json</code>:<Code text={JSON.stringify({ servers: { [MCP_NAME]: { type: "http", url } } }, null, 2)} /></Step>
    </ol> },
    { id: "codex", label: "Codex", body: <ol className="space-y-5">
      <Step n={1}>Add the server:<Code text={`codex mcp add ${MCP_NAME} --url ${url}`} /></Step>
      <Step n={2}>Sign in. Codex opens the browser to approve:<Code text={`codex mcp login ${MCP_NAME}`} /></Step>
    </ol> },
    { id: "prompt", label: "Any agent", body: <ol className="space-y-5">
      <Step n={1}>Paste this prompt into a coding agent that can change its own settings, such as Claude Code, Codex or Cursor&apos;s agent. It contains no secret.<Code text={setupPrompt(url)} label="Copy prompt" /></Step>
      <Step n={2}>Approve the sign-in when your browser opens. For any other MCP client, add <span className="break-all font-mono text-site-fg">{url}</span> as a remote server and choose OAuth sign-in.</Step>
    </ol> },
  ];
}

export function AgentConnect({ licenceKey }: { licenceKey?: string | null }) {
  const { localize } = useSiteI18n();
  const id = useId();
  const list = clients(MCP_URL);
  const [active, setActive] = useState(list[0].id);
  const index = list.findIndex((client) => client.id === active);
  const current = list[index];

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: list.length - 1 - index }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = list[(index + step + list.length) % list.length];
    setActive(next.id);
    document.getElementById(`${id}-${next.id}-tab`)?.focus();
  }

  return localize(<section aria-labelledby={`${id}-title`} className="site-surface min-w-0 rounded-[24px] p-5 sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={`${id}-title`} className="text-xl font-semibold tracking-[-0.03em]">Connect your agent</h2>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-site-fg-2">Sign in once in the browser. No key to copy, and you can disconnect from your account at any time.</p>
      </div>
    </div>
    <div role="tablist" aria-label="Agent" onKeyDown={onKey} className="-mx-1 mt-5 flex gap-1 overflow-x-auto px-1 pb-1">
      {list.map((client) => <button key={client.id} id={`${id}-${client.id}-tab`} type="button" role="tab" aria-selected={client.id === active} aria-controls={`${id}-panel`} tabIndex={client.id === active ? 0 : -1} onClick={() => setActive(client.id)}
        className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${client.id === active ? "border-white/25 bg-white/[0.09] text-site-fg" : "border-transparent text-site-fg-2 hover:bg-white/[0.04] hover:text-site-fg"}`}>{client.label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${current.id}-tab`} className="mt-5 min-w-0">{current.body}</div>
    <p className="mt-6 border-t border-white/[0.08] pt-4 text-[13px] leading-relaxed text-site-fg-3">Without Pro, the same connection gives your agent every free component. For free components with no sign-in at all, use <span className="break-words font-mono text-site-fg-2">{site.url}/mcp</span>.</p>
    {licenceKey && <KeyRoutes licenceKey={licenceKey} />}
  </section>);
}

/** Key-based routes for the CLI, CI and clients without browser sign-in. The key is filled in but not displayed. */
function KeyRoutes({ licenceKey }: { licenceKey: string }) {
  const { localize } = useSiteI18n();
  const masked = "dfa_••••••••";
  const routes = [
    { title: "CLI", shown: `npx ${site.url}/cli.tgz login ${masked}`, copy: `npx ${site.url}/cli.tgz login ${licenceKey}`, note: `Then add any component with npx ${site.url}/cli.tgz add <slug>.` },
    { title: "Claude Code with a key", shown: `claude mcp add --transport http ${MCP_NAME} ${site.url}/mcp --header "Authorization: Bearer ${masked}"`, copy: `claude mcp add --transport http ${MCP_NAME} ${site.url}/mcp --header "Authorization: Bearer ${licenceKey}"`, note: "For headless machines. The key is saved in your Claude Code settings, so keep them private." },
    { title: "shadcn registry", shown: `npx shadcn@latest add @design-for-ai-pro/<slug>`, copy: `npx shadcn@latest add @design-for-ai-pro/<slug>`, note: "Add the Pro registry to components.json first. The installation guide has the full example." },
  ];
  return localize(<details className="site-disclosure mt-5 border-t border-white/[0.08] pt-4">
    <summary className="min-h-11 cursor-pointer text-sm leading-[44px] text-site-fg-2">Use your licence key instead</summary>
    <div className="mt-3 grid gap-4">
      {routes.map((route) => <div key={route.title} className="min-w-0">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{route.title}</h3>
        <div className="mt-2 flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.08] bg-black/30 p-3">
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[12px] leading-relaxed text-site-fg"><code>{route.shown}</code></pre>
          <CopyButton text={route.copy} label="Copy" className="shrink-0" />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-site-fg-3">{route.note}</p>
      </div>)}
    </div>
  </details>);
}
