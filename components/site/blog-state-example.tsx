"use client";

import { FileText, Image, MicOff, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { attachment, citation, modelImage, voiceTranscript } from "@/lib/blog/example-fixtures";
import { useBlogExampleControls } from "./blog-example-controls";

type Example =
  | { kind: "citations"; labels: { sources: string; unavailable: string } }
  | { kind: "model"; labels: { model: string; text: string; image: string; supported: string; unsupported: string } }
  | { kind: "attachments"; labels: { selected: string; uploading: string; ready: string; removed: string; upload: string; remove: string; retry: string } }
  | { kind: "voice"; labels: { transcript: string; stop: string; replay: string; stopped: string } };

export function BlogStateExample({ example }: { example: Example }) {
  switch (example.kind) {
    case "citations": return <CitationExample labels={example.labels} />;
    case "model": return <ModelExample labels={example.labels} />;
    case "attachments": return <AttachmentExample labels={example.labels} />;
    case "voice": return <VoiceExample labels={example.labels} />;
  }
}

function CitationExample({ labels }: { labels: Extract<Example, { kind: "citations" }>["labels"] }) {
  const [source, setSource] = useState(1);
  const passageId = useId();
  const controls = useBlogExampleControls();
  return (
    <div className="blog-example-grid">
      <p className="blog-example-claim" lang="en" dir="ltr">
        {citation.claim}{" "}
        <button className="blog-citation" type="button" hidden={!controls} aria-label={`${labels.sources} 1`} aria-controls={passageId} aria-pressed={source === 1} onClick={() => setSource(1)}>1</button>
        {" "}
        <button className="blog-citation" type="button" hidden={!controls} aria-label={`${labels.sources} 2`} aria-controls={passageId} aria-pressed={source === 2} onClick={() => setSource(2)}>2</button>
      </p>
      <div className="blog-example-inset" id={passageId} role="status">
        {source === 1
          ? <div lang="en" dir="ltr"><span className="blog-example-kicker">{citation.source}</span><blockquote>{citation.quote}<mark>{citation.match}</mark>.</blockquote></div>
          : <p className="blog-example-warning">{labels.unavailable}</p>}
      </div>
    </div>
  );
}

function ModelExample({ labels }: { labels: Extract<Example, { kind: "model" }>["labels"] }) {
  const [model, setModel] = useState<"text" | "image">("text");
  const supported = model === "image";
  const group = useId();
  const controls = useBlogExampleControls();
  return (
    <div className="blog-example-grid">
      <fieldset className="blog-model-choices">
        <legend className="blog-example-kicker">{labels.model}</legend>
        {(["text", "image"] as const).map((id) => (
          <label key={id}>
            <input type="radio" name={group} checked={model === id} disabled={!controls} onChange={() => setModel(id)} />
            <span>{labels[id]}</span><code dir="ltr">{id === "text" ? "tools" : "vision"}</code>
          </label>
        ))}
      </fieldset>
      <div className="blog-example-inset blog-example-file" role="status">
        <Image size={22} aria-hidden="true" />
        <div>
          <bdi className="blog-example-filename">{modelImage}</bdi>
          <p className={supported ? "blog-example-success" : "blog-example-warning"}>{supported ? labels.supported : labels.unsupported}</p>
        </div>
      </div>
    </div>
  );
}

function AttachmentExample({ labels }: { labels: Extract<Example, { kind: "attachments" }>["labels"] }) {
  const [state, setState] = useState<"selected" | "uploading" | "ready" | "removed">("selected");
  const controls = useBlogExampleControls();
  const attempt = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const activeTimers = timers.current;
    return () => { for (const timer of activeTimers) clearTimeout(timer); };
  }, []);

  const start = () => {
    const id = ++attempt.current;
    setState("uploading");
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      if (attempt.current === id) setState("ready");
    }, 2200);
    timers.current.add(timer);
  };

  return (
    <div className="blog-example-grid">
      <p className="blog-example-claim" lang="en" dir="ltr">{attachment.draft}</p>
      <div className="blog-example-inset blog-example-file">
        <FileText size={22} aria-hidden="true" />
        <div>
          <bdi className="blog-example-filename">{attachment.file}</bdi>
          <p role="status" className={state === "ready" ? "blog-example-success" : ""}>{labels[state]}</p>
        </div>
        <button type="button" className="blog-example-button" hidden={!controls} onClick={() => {
          if (state === "selected" || state === "removed") {
            start();
          } else {
            attempt.current++;
            setState("removed");
          }
        }}>{state === "selected" ? labels.upload : state === "removed" ? labels.retry : labels.remove}</button>
      </div>
    </div>
  );
}

const wave = [12, 22, 34, 20, 48, 32, 54, 38, 23, 14, 28, 43, 58, 39, 20, 32, 24, 10, 19, 35, 51, 31, 42, 15, 28, 43, 28, 55, 40, 22, 30, 16];

function VoiceExample({ labels }: { labels: Extract<Example, { kind: "voice" }>["labels"] }) {
  const [cut, setCut] = useState(false);
  const controls = useBlogExampleControls();
  return (
    <div className="blog-voice">
      <div className="blog-waveform" data-cut={cut} aria-hidden="true" dir="ltr">
        {wave.map((height, index) => <span key={index} style={{ height }} />)}
      </div>
      <div className="blog-voice-transcript">
        <div role="status">
          <span className="blog-example-kicker">{labels.transcript}</span>
          <p className="blog-example-claim" lang="en" dir="ltr">{cut ? voiceTranscript.heard : voiceTranscript.complete}</p>
          {cut && <p className="blog-example-warning">{labels.stopped}</p>}
        </div>
        <button className="blog-example-button" type="button" hidden={!controls} onClick={() => setCut(!cut)}>
          {cut ? <RotateCcw size={16} aria-hidden="true" /> : <MicOff size={16} aria-hidden="true" />}
          {cut ? labels.replay : labels.stop}
        </button>
      </div>
    </div>
  );
}

export type BlogStateFixture = Example;
