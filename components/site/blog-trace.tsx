"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { milliseconds, traceSpans as spans } from "@/lib/blog/example-fixtures";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useBlogExampleControls } from "./blog-example-controls";

const duration = spans[0].to;
const total = spans.slice(1).reduce((sum, { from, to }) => sum + to - from, 0);
const pct = (time: number) => `${100 * time / duration}%`;
const ticks = [0, 100, 200, 300, 400, 500, 600, 700];

export type TraceLabels = {
  timeline: string;
  elapsed: string;
  total: string;
  play: string;
  pause: string;
  replay: string;
  failed: string;
  completed: string;
  running: string;
  pending: string;
};

export function BlogTrace({ labels }: { labels: TraceLabels }) {
  const [time, setTime] = useState<number>(duration);
  const [playing, setPlaying] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = useRef<number>(duration);
  const reduced = useReducedMotion();
  const controls = useBlogExampleControls();

  useEffect(() => {
    const element = root.current;
    if (!playing || reduced || !element) return;
    const from = current.current;
    const started = performance.now();
    let frame = 0;
    function advance(now: number) {
      const next = Math.min(duration, from + Math.floor((now - started) / 6));
      current.current = next;
      setTime(next);
      if (next < duration) frame = requestAnimationFrame(advance);
      else setPlaying(false);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setPlaying(false);
    });
    const stopInBackground = () => { if (document.hidden) setPlaying(false); };
    observer.observe(element);
    document.addEventListener("visibilitychange", stopInBackground);
    frame = requestAnimationFrame(advance);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", stopInBackground);
    };
  }, [playing, reduced]);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);

  const seek = (at: number) => {
    current.current = at;
    setTime(at);
  };

  return (
    <div ref={root} className="blog-trace" data-time={time}>
      <div className="blog-trace-metrics">
        <div><span>{labels.elapsed}</span><strong dir="ltr">{time} <small>{milliseconds}</small></strong></div>
        <div><span>{labels.total}</span><strong dir="ltr">{total} <small>{milliseconds}</small></strong></div>
      </div>
      <div className="blog-trace-board" style={{ "--trace-position": pct(time) } as CSSProperties}>
        <div className="blog-trace-axis" aria-hidden="true">
          <div>{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>
        </div>
        <ul>
          {spans.map(({ id, name, from, to }) => {
            const phase = time < from ? "pending" : time < to ? "running" : id === "call" ? "failed" : "completed";
            return (
              <li className="blog-trace-row" key={id} data-span={id} data-phase={phase}>
                <span className="blog-trace-name" lang="en">{name}</span>
                <div className="blog-trace-lane">
                  <span
                    className="blog-trace-span"
                    style={{ "--span-start": pct(from), "--span-width": pct(to - from), "--span-fill": `${Math.max(0, Math.min(1, (time - from) / (to - from))) * 100}%` } as CSSProperties}
                    aria-hidden="true"
                  />
                  <span className="sr-only">{from}–{to} {milliseconds}</span>
                </div>
                <span className="blog-trace-status" dir="auto">{labels[phase]}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="blog-trace-controls" hidden={!controls}>
        <input
          type="range"
          dir="ltr"
          aria-label={labels.timeline}
          aria-valuetext={`${time} ${milliseconds}`}
          min={0}
          max={duration}
          value={time}
          onChange={(event) => {
            setPlaying(false);
            seek(event.currentTarget.valueAsNumber);
          }}
        />
        <button type="button" className="blog-example-button blog-trace-play" hidden={reduced} onClick={() => {
          if (!playing && current.current === duration) seek(0);
          setPlaying(!playing);
        }}>
          {playing ? <Pause size={15} aria-hidden="true" /> : time === duration ? <RotateCcw size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {playing ? labels.pause : time === duration ? labels.replay : labels.play}
        </button>
      </div>
    </div>
  );
}
