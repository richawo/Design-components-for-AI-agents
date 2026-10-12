"use client";
import { type CSSProperties, useId, useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
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

export type AgendaEvent = {
  id: string;
  start: string;
  end: string;
  title: string;
  location: string;
  notes: string;
};
export type AgendaDay = {
  id: string;
  label: string;
  date: string;
  events: AgendaEvent[];
};
export type WeekAgendaProps = {
  title?: string;
  timezone?: string;
  days?: AgendaDay[];
  defaultDay?: string;
  onEventSelect?: (event: AgendaEvent) => void;
  theme?: "dark" | "light";
};
const defaults: AgendaDay[] = [
  {
    id: "mon",
    label: "Mon",
    date: "12 October",
    events: [
      {
        id: "crit",
        start: "09:30",
        end: "10:15",
        title: "Design critique",
        location: "Studio room",
        notes:
          "Bring the three navigation directions and the mobile prototype.",
      },
      {
        id: "work",
        start: "11:00",
        end: "12:30",
        title: "Protected focus",
        location: "At your desk",
        notes: "Finish the interaction notes. Notifications can wait.",
      },
      {
        id: "review",
        start: "15:00",
        end: "15:30",
        title: "Client review",
        location: "Video call",
        notes: "Walk through the revised type scale and answer open questions.",
      },
    ],
  },
  {
    id: "tue",
    label: "Tue",
    date: "13 October",
    events: [
      {
        id: "research",
        start: "10:00",
        end: "11:00",
        title: "Research playback",
        location: "Library room",
        notes: "Five interviews, three patterns and one decision to make.",
      },
    ],
  },
  { id: "wed", label: "Wed", date: "14 October", events: [] },
  { id: "thu", label: "Thu", date: "15 October", events: [] },
  { id: "fri", label: "Fri", date: "16 October", events: [] },
];
export function WeekAgenda({
  title = "This week",
  timezone = "London time",
  days = defaults,
  defaultDay = "mon",
  onEventSelect,
  theme = "dark",
}: WeekAgendaProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [dayId, setDayId] = useState(defaultDay);
  const [open, setOpen] = useState<string | null>(null);
  const day = days.find((d) => d.id === dayId) ?? days[0];
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      <div className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={id} className="text-xl font-medium tracking-tight">
            {title}
          </h2>
          <span className={`text-xs ${muted}`}>{timezone}</span>
        </div>
        <div
          role="group"
          aria-label="Agenda day"
          className="mt-5 flex flex-wrap gap-1"
        >
          {days.map((d, i) => (
            <button
              type="button"
              data-demo={`agenda-day-${i}`}
              key={`${d.id}-${i}`}
              aria-pressed={day?.id === d.id}
              onClick={() => {
                setDayId(d.id);
                setOpen(null);
              }}
              className={`${control} relative flex-1 px-1!`}
            >
              {d.id === day?.id && (
                <motion.span
                  layoutId={`${id}-day`}
                  transition={{ duration: reduced ? 0 : 0.22 }}
                  className="absolute inset-0 rounded-lg bg-[var(--ink)]"
                />
              )}
              <span
                className="relative"
                style={{ color: d.id === day?.id ? "var(--panel)" : undefined }}
              >
                {d.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--line)] px-6 py-5">
        <p className="mb-6 font-serif text-3xl tracking-[-.03em]">
          {day?.date ?? "No dates scheduled"}
        </p>
        <motion.ol
          key={day?.id}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.25 }}
          className="space-y-3"
        >
          {day?.events.map((event, i) => (
            <li
              key={`${event.id}-${i}`}
              className="grid grid-cols-[48px_minmax(0,1fr)] gap-3"
            >
              <span className={`pt-4 font-mono text-xs tabular-nums ${muted}`}>
                {event.start}
              </span>
              <div className="min-w-0 rounded-lg border border-[var(--line)]">
                <button
                  type="button"
                  data-demo={`event-${i}`}
                  aria-expanded={open === event.id}
                  aria-controls={`${id}-event-${i}`}
                  onClick={() => {
                    setOpen(open === event.id ? null : event.id);
                    onEventSelect?.(event);
                  }}
                  className={`${control} w-full justify-between! px-3 py-3 text-left`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm">{event.title}</span>
                    <span
                      className={`mt-1 block font-mono text-[11px] ${muted}`}
                    >
                      {event.start}–{event.end}
                    </span>
                  </span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`shrink-0 transition-transform motion-reduce:transition-none ${open === event.id ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  id={`${id}-event-${i}`}
                  hidden={open !== event.id}
                  className="border-t border-[var(--line)] px-3 pb-4 pt-3"
                >
                  <p className={`flex items-center gap-2 text-xs ${muted}`}>
                    <MapPin size={13} aria-hidden="true" />
                    {event.location}
                  </p>
                  <p className={`mt-3 text-sm leading-relaxed ${muted}`}>
                    {event.notes}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </motion.ol>
        {!day?.events.length && (
          <div className="py-10">
            <p className="text-lg">A little breathing room.</p>
            <p className={`mt-2 text-sm ${muted}`}>
              There are no events scheduled for this day.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function WeekAgendaDemo(
  overrides: Partial<WeekAgendaProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <WeekAgenda {...overrides} />
    </div>
  );
}
