"use client";
import { type CSSProperties, useId, useState } from "react";
import { Clock, Globe, Check } from "lucide-react";
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

export type BookingDay = {
  id: string;
  weekday: string;
  day: string;
  month: string;
  slots: { id: string; label: string; available?: boolean }[];
};
export type BookingSelection = { dayId: string; slotId: string };
export type BookingSlotsProps = {
  title?: string;
  duration?: string;
  timezone?: string;
  days?: BookingDay[];
  value?: BookingSelection | null;
  onChange?: (selection: BookingSelection) => void;
  theme?: "dark" | "light";
};
const defaults: BookingDay[] = [
  {
    id: "2026-10-12",
    weekday: "Mon",
    day: "12",
    month: "October",
    slots: [
      { id: "0900", label: "09:00" },
      { id: "1030", label: "10:30" },
      { id: "1400", label: "14:00", available: false },
      { id: "1530", label: "15:30" },
    ],
  },
  {
    id: "2026-10-13",
    weekday: "Tue",
    day: "13",
    month: "October",
    slots: [
      { id: "1000", label: "10:00" },
      { id: "1300", label: "13:00" },
      { id: "1600", label: "16:00" },
    ],
  },
  { id: "2026-10-14", weekday: "Wed", day: "14", month: "October", slots: [] },
];
export function BookingSlots({
  title = "Find a moment to talk.",
  duration = "30 minutes",
  timezone = "Europe/London",
  days = defaults,
  value,
  onChange,
  theme = "dark",
}: BookingSlotsProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [local, setLocal] = useState<BookingSelection | null>(null);
  const selected = value === undefined ? local : value;
  const day = days.find((d) => d.id === dayId) ?? days[0];
  const selectedDay = days.find((d) => d.id === selected?.dayId);
  const selectedSlot = selectedDay?.slots.find(
    (s) => s.id === selected?.slotId && s.available !== false,
  );
  return (
    <section
      style={colors(theme)}
      aria-labelledby={id}
      className="@container w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <h2 id={id} className="font-serif text-3xl tracking-[-.03em]">
        {title}
      </h2>
      <div className={`mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs ${muted}`}>
        <span className="inline-flex items-center gap-2">
          <Clock size={14} aria-hidden="true" />
          {duration}
        </span>
        <span className="inline-flex items-center gap-2 break-all">
          <Globe size={14} aria-hidden="true" />
          {timezone}
        </span>
      </div>
      <div
        role="group"
        aria-label="Available days"
        className="my-6 flex flex-wrap gap-2"
      >
        {days.map((d, i) => (
          <button
            type="button"
            data-demo={`day-${i}`}
            key={`${d.id}-${i}`}
            aria-pressed={d.id === day?.id}
            onClick={() => setDayId(d.id)}
            className={`${control} min-w-16 flex-1 flex-col gap-1 border py-3 ${d.id === day?.id ? "border-[var(--ink)] bg-[var(--wash)]" : "border-[var(--line)]"}`}
          >
            <span className={`text-xs ${muted}`}>{d.weekday}</span>
            <span className="font-display text-3xl tabular-nums">{d.day}</span>
            <span className={`text-[11px] ${muted}`}>{d.month}</span>
          </button>
        ))}
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-medium">
          {day
            ? `${day.weekday}, ${day.day} ${day.month}`
            : "No dates available"}
        </legend>
        <motion.div
          key={day?.id}
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.24 }}
          className="grid grid-cols-2 gap-2"
        >
          {day?.slots.map((slot, i) => (
            <label
              key={`${slot.id}-${i}`}
              className={`relative flex min-h-12 cursor-pointer items-center justify-center rounded-lg border font-mono text-sm transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${slot.available === false ? "cursor-not-allowed opacity-40" : "hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.98] motion-reduce:transform-none"} ${selected?.dayId === day.id && selectedSlot?.id === slot.id ? "border-[var(--ink)]" : "border-[var(--line)]"}`}
            >
              <input
                type="radio"
                name={id}
                data-demo={`slot-${i}`}
                className="peer sr-only"
                checked={
                  selected?.dayId === day.id && selectedSlot?.id === slot.id
                }
                disabled={slot.available === false}
                onChange={() => {
                  const next = { dayId: day.id, slotId: slot.id };
                  setLocal(next);
                  onChange?.(next);
                }}
              />
              <span className="absolute inset-[-3px] rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--ink)]" />
              {slot.label}
              {slot.available === false && (
                <span className="sr-only">, unavailable</span>
              )}
            </label>
          ))}
        </motion.div>
        {!day?.slots.length && (
          <p className={`py-6 text-sm ${muted}`}>
            No times are available for this day.
          </p>
        )}
      </fieldset>
      <p
        role="status"
        className={`mt-6 flex min-h-12 items-center gap-2 border-t border-[var(--line)] pt-4 text-sm ${muted}`}
      >
        {selectedSlot ? (
          <>
            <Check size={16} className="shrink-0" aria-hidden="true" />
            {selectedDay?.weekday} {selectedDay?.day}, {selectedSlot.label}{" "}
            selected
          </>
        ) : (
          "Choose an available time to continue."
        )}
      </p>
    </section>
  );
}

export default function BookingSlotsDemo(
  overrides: Partial<BookingSlotsProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <BookingSlots {...overrides} />
    </div>
  );
}
