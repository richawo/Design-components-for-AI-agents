import { Component, createRef, memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Mask,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  type PathProps,
} from "react-native-svg";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RingKey = "move" | "exercise" | "stand";

export type HealthRing = {
  key: RingKey;
  label: string;
  /** Unit used in the legend and the centre readout ("kcal", "min", "hr"). */
  unit: string;
  goal: number;
  /** First lap gradient, start to end of the lap. */
  colors: [string, string];
  /** Second lap (past 100%) gradient: the same hue, a shade deeper. */
  lapColors: [string, string];
};

export type SleepStages = { deep: number; core: number; rem: number; awake: number };

export type HealthDay = {
  /** One-letter label for the week selector. */
  letter: string;
  /** "Friday, 9 October". */
  dateLabel: string;
  /** Days that haven't happened yet render as empty tracks and can't be picked. */
  future?: boolean;
  /** Ring values in the order of `rings` (move, exercise, stand). */
  values: [number, number, number];
  steps: number;
  distanceKm: number;
  /** Steps per hour from 00:00. A shorter array means "the day so far". */
  hourly: number[];
  restingHr: number;
  hrRange: [number, number];
  /** Minutes in each stage of the night before. */
  sleep: SleepStages;
  bedtime: string;
  wake: string;
};

export type MobileHealthSummaryProps = {
  title?: string;
  /** Initials in the avatar. */
  initials?: string;
  rings?: HealthRing[];
  days?: HealthDay[];
  /** Index into `days` selected on mount. Defaults to the last day that isn't in the future. */
  initialDay?: number;
  /**
   * The one brand colour outside the rings: it marks "now" on the step
   * sparkline and runs the heartbeat. Everything else is greyscale.
   */
  accent?: string;
  onDayChange?: (index: number, day: HealthDay) => void;
  onRingSelect?: (ring: RingKey | null) => void;
};

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_RINGS: HealthRing[] = [
  { key: "move", label: "Move", unit: "kcal", goal: 540, colors: ["#FF3D6E", "#FF8B52"], lapColors: ["#B3123F", "#D4521F"] },
  { key: "exercise", label: "Exercise", unit: "min", goal: 30, colors: ["#7DEB3A", "#D9FF5C"], lapColors: ["#3F9612", "#93C21A"] },
  { key: "stand", label: "Stand", unit: "hr", goal: 12, colors: ["#1FD2F4", "#62A6FF"], lapColors: ["#0B87AE", "#2C64D8"] },
];

const NO_SLEEP: SleepStages = { deep: 0, core: 0, rem: 0, awake: 0 };

const DEFAULT_DAYS: HealthDay[] = [
  {
    letter: "M", dateLabel: "Monday, 5 October", values: [418, 22, 10], steps: 6204, distanceKm: 4.6,
    hourly: [0, 0, 0, 0, 0, 0, 40, 620, 880, 210, 160, 300, 540, 420, 180, 160, 240, 690, 820, 300, 140, 60, 20, 0],
    restingHr: 61, hrRange: [54, 131], sleep: { deep: 64, core: 212, rem: 88, awake: 21 }, bedtime: "23:40", wake: "06:05",
  },
  {
    letter: "T", dateLabel: "Tuesday, 6 October", values: [589, 41, 12], steps: 11873, distanceKm: 8.9,
    hourly: [0, 0, 0, 0, 0, 0, 120, 2400, 1900, 260, 210, 340, 880, 520, 230, 200, 310, 980, 1400, 1250, 480, 260, 90, 0],
    restingHr: 58, hrRange: [51, 162], sleep: { deep: 88, core: 241, rem: 110, awake: 12 }, bedtime: "22:31", wake: "06:02",
  },
  {
    letter: "W", dateLabel: "Wednesday, 7 October", values: [302, 12, 7], steps: 3918, distanceKm: 2.9,
    hourly: [0, 0, 0, 0, 0, 0, 0, 140, 420, 260, 120, 90, 380, 260, 110, 80, 140, 520, 610, 410, 230, 90, 30, 0],
    restingHr: 63, hrRange: [56, 118], sleep: { deep: 41, core: 190, rem: 62, awake: 38 }, bedtime: "00:31", wake: "06:02",
  },
  {
    letter: "T", dateLabel: "Thursday, 8 October", values: [655, 52, 11], steps: 13406, distanceKm: 10.2,
    hourly: [0, 0, 0, 0, 0, 0, 260, 3100, 1500, 300, 240, 420, 960, 610, 300, 260, 480, 1100, 1700, 1260, 520, 240, 80, 0],
    restingHr: 57, hrRange: [50, 171], sleep: { deep: 94, core: 231, rem: 97, awake: 12 }, bedtime: "22:41", wake: "05:55",
  },
  {
    letter: "F", dateLabel: "Friday, 9 October", values: [612, 38, 9], steps: 8412, distanceKm: 6.1,
    hourly: [0, 0, 0, 0, 0, 0, 90, 1900, 1240, 280, 190, 360, 820, 470, 260, 210, 380, 1160, 650],
    restingHr: 59, hrRange: [52, 148], sleep: { deep: 78, core: 238, rem: 96, awake: 22 }, bedtime: "23:27", wake: "06:41",
  },
  {
    letter: "S", dateLabel: "Saturday, 10 October", future: true, values: [0, 0, 0], steps: 0, distanceKm: 0, hourly: [],
    restingHr: 0, hrRange: [0, 0], sleep: NO_SLEEP, bedtime: "", wake: "",
  },
  {
    letter: "S", dateLabel: "Sunday, 11 October", future: true, values: [0, 0, 0], steps: 0, distanceKm: 0, hourly: [],
    restingHr: 0, hrRange: [0, 0], sleep: NO_SLEEP, bedtime: "", wake: "",
  },
];

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/** One true-neutral family: depth comes from luminance, hairlines and grain, never hue. */
const COLOR = {
  bg: ["#0D0D0D", "#0A0A0A", "#060606"] as const,
  ink: "#F5F5F5",
  sub: "rgba(255,255,255,0.56)",
  faint: "rgba(255,255,255,0.34)",
  surface: ["#191919", "#141414", "#111111"] as const,
  edge: "rgba(255,255,255,0.06)",
  edgeTop: "rgba(255,255,255,0.14)",
  grid: "rgba(255,255,255,0.07)",
  avatar: "#1C1C1C",
};
const DEFAULT_ACCENT = "#FF3D6E";

/** Sleep stages as a white ramp: the deeper the sleep, the brighter the bar. */
const SLEEP_STAGES: { key: keyof SleepStages; label: string; tone: string }[] = [
  { key: "deep", label: "Deep", tone: "rgba(255,255,255,0.94)" },
  { key: "core", label: "Core", tone: "rgba(255,255,255,0.6)" },
  { key: "rem", label: "REM", tone: "rgba(255,255,255,0.36)" },
  { key: "awake", label: "Awake", tone: "rgba(255,255,255,0.16)" },
];

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
/** Ease-out with a single small overshoot, for things that pop in last. */
const EASE_POP = Easing.bezier(0.34, 1.45, 0.64, 1);
const SPRING_UI = { stiffness: 500, damping: 40, mass: 1 };

const MOTION = {
  /** Block entrance: fade, rise and a clearing blur veil. */
  reveal: 560,
  rise: 12,
  /** BlurView intensity a veil starts at (expo-blur maps 40 to an 8px blur on the web). */
  veil: 40,
  /** First count from zero, and later counts from the previous value. */
  count: 760,
  recount: 620,
  /** Lines stroking in, bars growing. */
  draw: 640,
  grow: 380,
  /** Reduced motion: every entrance is this short fade instead. */
  fade: 150,
};

/**
 * The first-view choreography, in ms from mount, in reading order:
 * containers, then text, then figures, then data, then progress.
 */
const CUE = {
  date: 0,
  title: 50,
  week: 100,
  weekRings: 190,
  rings: 150,
  ringDraw: 220,
  legend: 240,
  steps: 300,
  heart: 350,
  sleep: 400,
  /** Offset from a card's cue to its figures and charts, so they start as it lands. */
  figures: 120,
  charts: 180,
  avatar: 480,
  avatarRing: 560,
};
/** Charts redraw this long after a day switch (the lighter replay). */
const SWITCH_DELAY = 60;

const RING_BOX = 264;
const RING_STROKE = 22;
const RING_GAP = 3;
const RING_PAD = 6;
/** Progress is capped just under four laps: the tip's rotation only spans four turns. */
const MAX_LAPS = 3.99;
const ringRadius = (i: number) => RING_BOX / 2 - RING_PAD - RING_STROKE / 2 - i * (RING_STROKE + RING_GAP);

const CARD_RADIUS = 24;
const CARD_PAD = 16;
const CHART_H = 34;
const AVATAR = 42;

const TABULAR = { fontVariant: ["tabular-nums" as const] };
// On the web a mouse drag would otherwise select text.
const noSelect = (Platform.OS === "web" ? { userSelect: "none" } : {}) as ViewStyle;
// Figures settle through a light blur where the platform can draw one; iOS has no `filter: blur`.
const CAN_BLUR_TEXT = Platform.OS !== "ios";

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const whole = (n: number) => String(Math.round(n));
const oneDecimal = (n: number) => n.toFixed(1);
const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, "0")}m`;
/** "1h 18m", or just "22m" under an hour. */
const shortHm = (mins: number) => hm(mins).replace(/^0h /, "");
const sumSleep = (s: SleepStages) => s.deep + s.core + s.rem + s.awake;
const latestPastDay = (days: HealthDay[]) => days.reduce((acc, d, i) => (d.future ? acc : i), 0);

/* ------------------------------------------------------------------ */
/* Motion primitives                                                   */
/* ------------------------------------------------------------------ */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}

type Ease = (t: number) => number;
type CueOptions = { reduce: boolean; duration?: number; easing?: Ease; native?: boolean };

/**
 * A 0→1 value that plays once, `delay` ms after mount, and reports when it
 * has landed so callers can drop styles that only matter in flight. It starts
 * a frame after mount: an animation started in the mounting tick can stall on
 * the web. Reduced motion turns every cue into the same short fade.
 */
function useCue(delay: number, { reduce, duration = MOTION.reveal, easing = EASE_OUT, native = true }: CueOptions) {
  const value = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    const raf = requestAnimationFrame(() => {
      anim = Animated.timing(value, {
        toValue: 1,
        delay: reduce ? 0 : delay,
        duration: reduce ? MOTION.fade : duration,
        easing: reduce ? Easing.linear : easing,
        useNativeDriver: native,
      });
      anim.start(({ finished }) => finished && setLanded(true));
    });
    return () => {
      cancelAnimationFrame(raf);
      anim?.stop();
    };
    // Plays once per mount; a change of `reduce` mid-flight just finishes it as a fade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return [value, landed] as const;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type VeilShape = { radius?: number; bleed?: number };

/**
 * A frosted veil over a block that clears as it lands. It blurs the block
 * itself (the revealing parent's opacity makes the block its only backdrop),
 * so it reads as the block coming into focus on iOS and the web alike.
 * Intensity is not a style, so this one runs on the JS driver.
 */
function Veil({ delay, radius = 0, bleed = 0 }: VeilShape & { delay: number }) {
  const [t] = useCue(delay, { reduce: false, native: false });
  const intensity = useMemo(() => t.interpolate({ inputRange: [0, 1], outputRange: [MOTION.veil, 0] }), [t]);
  return (
    <AnimatedBlurView
      pointerEvents="none"
      tint="systemChromeMaterialDark"
      intensity={intensity}
      style={[styles.veil, { top: -bleed, left: -bleed, right: -bleed, bottom: -bleed, borderRadius: radius }]}
    />
  );
}

type RevealProps = {
  delay: number;
  reduce: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  rise?: number;
  /** Shape of the blur veil, or false for none. */
  veil?: VeilShape | false;
};

/** A block's entrance: it fades in, rises and comes out of a blur, in one ease-out. */
function Reveal({ delay, reduce, children, style, rise = MOTION.rise, veil = {} }: RevealProps) {
  const [t, landed] = useCue(delay, { reduce });
  const motion = useMemo(
    () => ({ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 0 : rise, 0] }) }] }),
    [t, rise, reduce],
  );
  return (
    // At rest the block drops its transform: Chromium stops backdrop blur under a lingering one.
    <Animated.View style={[style, landed ? null : motion]}>
      {children}
      {veil && !reduce && !landed ? <Veil delay={delay} {...veil} /> : null}
    </Animated.View>
  );
}

/** How far a figure's settle drops when it changes value (1 = no settle at all). */
const SETTLE_DIP = 0.55;

/**
 * Counts a figure to `target`: from zero after `delay` the first time, then
 * from wherever it is. Returns the frame's value and a 0→1 "settle" that
 * fades, lifts and un-blurs the figure as it lands.
 */
function useCount(target: number, delay: number, reduce: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const id = value.addListener(({ value: v }) => setShown(v));
    return () => value.removeListener(id);
  }, [value]);
  useEffect(() => {
    if (reduce) {
      value.stopAnimation();
      value.setValue(target);
      settle.setValue(1);
      started.current = true;
      return;
    }
    let anim: Animated.CompositeAnimation | undefined;
    const raf = requestAnimationFrame(() => {
      // Marked here, not before, so React's dev double-mount still gets the intro.
      const intro = !started.current;
      started.current = true;
      if (!intro) settle.setValue(SETTLE_DIP);
      const timing = { delay: intro ? delay : 0, useNativeDriver: false };
      anim = Animated.parallel([
        Animated.timing(value, { ...timing, toValue: target, duration: intro ? MOTION.count : MOTION.recount, easing: intro ? EASE_OUT : EASE_IN_OUT }),
        Animated.timing(settle, { ...timing, toValue: 1, duration: MOTION.recount, easing: EASE_OUT }),
      ]);
      anim.start();
    });
    return () => {
      cancelAnimationFrame(raf);
      anim?.stop();
    };
    // `delay` only shapes the first count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce]);
  const settleStyle = useMemo(
    () => ({
      opacity: settle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 1] }),
      transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
      ...(CAN_BLUR_TEXT ? { filter: settle.interpolate({ inputRange: [0, 1], outputRange: ["blur(4px)", "blur(0px)"] }) } : null),
    }),
    [settle],
  );
  return [shown, settleStyle] as const;
}

type CountUpProps = {
  value: number;
  format?: (n: number) => string;
  delay?: number;
  reduce: boolean;
  style?: StyleProp<TextStyle>;
  /** Text after the figure that doesn't count or settle, e.g. a unit. Sits on the figure's baseline. */
  suffix?: ReactNode;
};

/** A tabular figure that counts up and settles through a light blur. */
function CountUp({ value, format = group, delay = 0, reduce, style, suffix }: CountUpProps) {
  const [shown, settleStyle] = useCount(value, delay, reduce);
  const figure = <Animated.Text style={[style, TABULAR, settleStyle]}>{format(shown)}</Animated.Text>;
  if (!suffix) return figure;
  return (
    <View style={styles.figure}>
      {figure}
      {suffix}
    </View>
  );
}

/** Crossfades content with a 5pt rise when `id` changes, so the eye can follow it. */
function Swap({ id, children, style, reduce }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle>; reduce: boolean }) {
  const [shown, setShown] = useState({ id, children });
  const t = useRef(new Animated.Value(1)).current;
  const latest = useRef(children);
  latest.current = children;
  useEffect(() => {
    if (id === shown.id) {
      setShown((s) => (s.children === children ? s : { id, children }));
      return;
    }
    if (reduce) {
      setShown({ id, children: latest.current });
      return;
    }
    const out = Animated.timing(t, { toValue: 0, duration: 110, easing: EASE_IN, useNativeDriver: true });
    out.start(({ finished }) => {
      if (!finished) return;
      setShown({ id, children: latest.current });
      Animated.timing(t, { toValue: 1, duration: 240, easing: EASE_OUT, useNativeDriver: true }).start();
    });
    return () => out.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, children]);
  const motion = useMemo(() => ({ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }), [t]);
  return <Animated.View style={[style, motion]}>{shown.children}</Animated.View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SquishProps = Omit<PressableProps, "style"> & { to?: number; reduce: boolean; style?: StyleProp<ViewStyle> };

/** A Pressable that springs down while held and back, with a little lift, on release. */
function Squish({ to = 0.97, reduce, style, onPressIn, onPressOut, ...rest }: SquishProps) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduce) Animated.spring(scale, { toValue: to, stiffness: 520, damping: 32, mass: 1, useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, stiffness: 380, damping: 18, mass: 1, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
      style={[style, noSelect, { transform: [{ scale }] }]}
    />
  );
}

/**
 * Path that Animated can drive. It forwards native props to the real Path and
 * drops `collapsable`, which Animated adds and react-native-svg's web build
 * would otherwise write to the DOM.
 */
class DrivablePath extends Component<PathProps & { collapsable?: boolean }> {
  path = createRef<Path>();
  setNativeProps(props: object) {
    (this.path.current as unknown as { setNativeProps?: (p: object) => void } | null)?.setNativeProps?.(props);
  }
  render() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { collapsable, ...rest } = this.props;
    return <Path ref={this.path} {...rest} />;
  }
}
const AnimatedPath = Animated.createAnimatedComponent(DrivablePath);

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

type Point = [number, number];
const fmt = (n: number) => n.toFixed(1);

/** A full circle starting at 12 o'clock, so a dash offset reads as progress. */
const circlePath = (c: number, r: number) => `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r}`;
const rightHalf = (c: number, r: number) => `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r}`;
const leftHalf = (c: number, r: number) => `M ${c} ${c + r} A ${r} ${r} 0 0 1 ${c} ${c - r}`;

/** Length of a Bézier segment, by sampling: close enough to time a stroke draw. */
function bezierLength(points: Point[], samples = 10) {
  const at = (t: number): Point => {
    const n = points.length - 1;
    let x = 0;
    let y = 0;
    points.forEach(([px, py], k) => {
      const b = (n === 2 ? [1, 2, 1] : [1, 3, 3, 1])[k] * (1 - t) ** (n - k) * t ** k;
      x += b * px;
      y += b * py;
    });
    return [x, y];
  };
  let length = 0;
  let prev = points[0];
  for (let k = 1; k <= samples; k++) {
    const p = at(k / samples);
    length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return length;
}

/** Catmull-Rom through the points as cubic Béziers, with its length for the draw-in dash. */
function smoothPath(points: Point[]) {
  if (points.length < 2) return { d: "", length: 0 };
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
    length += bezierLength([p1, c1, c2, p2]);
  }
  return { d, length };
}

/** Heartbeats as a path: flat, a small P wave, the QRS spike, then the T wave. */
function ecgPath(width: number, height: number, beats: number) {
  const mid = height * 0.6;
  const w = width / beats;
  let d = `M 0 ${fmt(mid)}`;
  let length = 0;
  let at: Point = [0, mid];
  const line = (x: number, y: number) => {
    d += ` L ${fmt(x)} ${fmt(y)}`;
    length += Math.hypot(x - at[0], y - at[1]);
    at = [x, y];
  };
  const quad = (qx: number, qy: number, x: number, y: number) => {
    d += ` Q ${fmt(qx)} ${fmt(qy)} ${fmt(x)} ${fmt(y)}`;
    length += bezierLength([at, [qx, qy], [x, y]]);
    at = [x, y];
  };
  for (let b = 0; b < beats; b++) {
    const x = (f: number) => b * w + w * f;
    line(x(0.18), mid);
    quad(x(0.24), mid - height * 0.12, x(0.3), mid);
    line(x(0.38), mid);
    line(x(0.42), mid + height * 0.12);
    line(x(0.48), height * 0.04);
    line(x(0.54), height - 2);
    line(x(0.58), mid);
    line(x(0.68), mid);
    quad(x(0.76), mid - height * 0.2, x(0.84), mid);
    line(x(1), mid);
  }
  return { d, length };
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

function alpha(hex: string, a: number) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

/** The page: a near-black falloff, a faint top light and a fine dither so nothing bands. */
function Backdrop({ uid }: { uid: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={COLOR.bg} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${uid}-light`} cx="50%" cy="0%" rx="80%" ry="42%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.07} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <Pattern id={`${uid}-dither`} width="4" height="4" patternUnits="userSpaceOnUse">
            <Rect x="0" y="0" width="1" height="1" fill="#FFFFFF" fillOpacity={0.045} />
            <Rect x="2" y="2" width="1" height="1" fill="#FFFFFF" fillOpacity={0.025} />
            <Rect x="3" y="0" width="1" height="1" fill="#000000" fillOpacity={0.14} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${uid}-light)`} />
        <Rect width="100%" height="100%" fill={`url(#${uid}-dither)`} />
      </Svg>
    </View>
  );
}

/** A graphite card: a low-contrast fill, a top edge brighter than the bottom and a deep soft shadow. */
function Surface({ children, style, radius = CARD_RADIUS }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  return (
    <View style={[styles.surface, { borderRadius: radius }, style]}>
      <LinearGradient colors={COLOR.surface} locations={[0, 0.5, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.surfaceEdge, { borderRadius: radius }]} />
    </View>
  );
}

/**
 * Status-bar glass. Content dissolves under a scrim at rest; once it scrolls,
 * real frost fades in over the rings passing beneath, with a hairline below.
 * The BlurView fades itself: a fading ancestor would cut it off from its backdrop on the web.
 */
function StatusGlass({ scrollY }: { scrollY: Animated.Value }) {
  const frost = useMemo(() => scrollY.interpolate({ inputRange: [0, 28], outputRange: [0, 1], extrapolate: "clamp" }), [scrollY]);
  return (
    <>
      <LinearGradient pointerEvents="none" colors={[alpha(COLOR.bg[0], 0.94), alpha(COLOR.bg[0], 0)]} style={styles.scrimTop} />
      <AnimatedBlurView pointerEvents="none" intensity={50} tint="dark" style={[styles.statusGlass, { opacity: frost }]} />
      <Animated.View pointerEvents="none" style={[styles.statusHairline, { opacity: frost }]} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (24 grid, 1.7 stroke, round caps)                              */
/* ------------------------------------------------------------------ */

function StepsIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M8.2 3.5c1.9 0 3 1.9 3 4.6 0 2-1 3.3-1.4 4.7H5.6C5.2 11.4 4.6 10 4.8 8 5 5.3 6.4 3.5 8.2 3.5Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M5.8 15.6h4c.1 2.4-.6 4-2 4s-2.1-1.6-2-4Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M15.8 7.5c1.8 0 3.2 1.8 3.4 4.5.2 2-.4 3.4-.8 4.8h-4.2c-.4-1.4-1.4-2.7-1.4-4.7 0-2.7 1.1-4.6 3-4.6Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

function HeartIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7.5-4.4-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M16.5 4.5v3M15 6h3" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */

/** Greyscale initials that pop in last, then a luminous ring draws around them. */
function Avatar({ uid, initials, reduce }: { uid: string; initials: string; reduce: boolean }) {
  const [pop] = useCue(CUE.avatar, { reduce, easing: EASE_POP, duration: 520 });
  const [ring] = useCue(CUE.avatarRing, { reduce, native: false, duration: 720 });
  const c = AVATAR / 2;
  const r = c - 1;
  const len = 2 * Math.PI * r;
  const anim = useMemo(
    () => ({
      disc: {
        opacity: pop.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
      },
      offset: ring.interpolate({ inputRange: [0, 1], outputRange: [len, 0] }),
    }),
    [pop, ring, len],
  );
  return (
    <Squish to={0.92} reduce={reduce} accessibilityRole="button" accessibilityLabel="Profile" style={styles.avatarWrap}>
      <Animated.View style={[styles.avatar, anim.disc]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </Animated.View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={AVATAR} height={AVATAR}>
          <Defs>
            <SvgLinearGradient id={`${uid}-avatar`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.28} />
            </SvgLinearGradient>
          </Defs>
          <AnimatedPath
            d={circlePath(c, r)}
            stroke={`url(#${uid}-avatar)`}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={anim.offset}
          />
        </Svg>
      </View>
    </Squish>
  );
}

/* ------------------------------------------------------------------ */
/* Week selector                                                        */
/* ------------------------------------------------------------------ */

const MINI = 30;
const MINI_STROKE = 3.4;

/** Three tiny rings that draw themselves in once the bar has landed. */
const MiniRings = memo(function MiniRings({
  rings,
  values,
  future,
  delay,
  reduce,
}: {
  rings: HealthRing[];
  values: number[];
  future?: boolean;
  delay: number;
  reduce: boolean;
}) {
  const [draw] = useCue(delay, { reduce, native: false, duration: MOTION.draw });
  const c = MINI / 2;
  const arcs = useMemo(
    () =>
      rings.map((ring, i) => {
        const r = c - MINI_STROKE / 2 - 0.5 - i * (MINI_STROKE + 1);
        const len = 2 * Math.PI * r;
        const p = future ? 0 : Math.min(values[i] / ring.goal, 1);
        return { ring, r, len, p, offset: draw.interpolate({ inputRange: [0, 1], outputRange: [len, len * (1 - p)] }) };
      }),
    [rings, values, future, draw, c],
  );
  return (
    <Svg width={MINI} height={MINI}>
      {arcs.map(({ ring, r, len, p, offset }) => (
        <G key={ring.key}>
          <Circle cx={c} cy={c} r={r} stroke={ring.colors[0]} strokeOpacity={future ? 0.1 : 0.2} strokeWidth={MINI_STROKE} fill="none" />
          {p > 0 ? (
            <AnimatedPath
              d={circlePath(c, r)}
              stroke={ring.colors[0]}
              strokeWidth={MINI_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${len} ${len}`}
              strokeDashoffset={offset}
            />
          ) : null}
        </G>
      ))}
    </Svg>
  );
});

function WeekSelector({
  days,
  rings,
  selected,
  onPick,
  reduce,
}: {
  days: HealthDay[];
  rings: HealthRing[];
  selected: number;
  onPick: (i: number) => void;
  reduce: boolean;
}) {
  const [width, setWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const itemW = width / days.length;
  const placed = useRef(false);

  useEffect(() => {
    if (!itemW) return;
    // The first placement lands without travelling; later picks glide.
    if (!placed.current || reduce) {
      pillX.setValue(selected * itemW);
      placed.current = true;
      return;
    }
    Animated.spring(pillX, { ...SPRING_UI, toValue: selected * itemW, useNativeDriver: true }).start();
  }, [selected, itemW, pillX, reduce]);

  const pillMotion = useMemo(() => ({ transform: [{ translateX: Animated.add(pillX, 2) }] }), [pillX]);

  return (
    <Surface radius={22}>
      <View style={styles.weekInner} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {itemW > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.pill, { width: itemW - 4 }, pillMotion]}>
            <LinearGradient colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.06)"]} style={StyleSheet.absoluteFill} />
          </Animated.View>
        ) : null}
        {days.map((d, i) => {
          const isSelected = i === selected;
          return (
            <Squish
              key={d.dateLabel}
              to={0.9}
              reduce={reduce}
              disabled={d.future}
              onPress={() => onPick(i)}
              accessibilityRole="tab"
              accessibilityLabel={d.dateLabel}
              accessibilityState={{ selected: isSelected, disabled: !!d.future }}
              style={[styles.dayItem, d.future ? styles.dayFuture : null]}
            >
              <Text style={[styles.dayLetter, { color: isSelected ? COLOR.ink : COLOR.sub }]}>{d.letter}</Text>
              <MiniRings rings={rings} values={d.values} future={d.future} delay={CUE.weekRings + i * 40} reduce={reduce} />
            </Squish>
          );
        })}
      </View>
    </Surface>
  );
}

/* ------------------------------------------------------------------ */
/* Rings                                                                */
/* ------------------------------------------------------------------ */

/**
 * One lap of a ring. SVG has no conic gradient, so each half of the circle
 * gets a vertical gradient (top→bottom on the right, bottom→top on the left),
 * which reads as a sweep. A dashed copy of the circle masks it to progress.
 */
function RingLap({ uid, index, colors, progress, lap }: { uid: string; index: number; colors: [string, string]; progress: Animated.Value; lap: 0 | 1 }) {
  const c = RING_BOX / 2;
  const r = ringRadius(index);
  const len = 2 * Math.PI * r;
  const mid = mix(colors[0], colors[1], 0.5);
  const id = `${uid}-r${index}-l${lap}`;
  const offset = useMemo(
    () => progress.interpolate({ inputRange: [lap, lap + 1], outputRange: [len, 0], extrapolate: "clamp" }),
    [progress, lap, len],
  );
  return (
    <>
      <Defs>
        <SvgLinearGradient id={`${id}-a`} x1={c} y1={c - r} x2={c} y2={c + r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={mid} />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${id}-b`} x1={c} y1={c + r} x2={c} y2={c - r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={mid} />
          <Stop offset="1" stopColor={colors[1]} />
        </SvgLinearGradient>
        <Mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width={RING_BOX} height={RING_BOX}>
          <AnimatedPath
            d={circlePath(c, r)}
            stroke="#FFFFFF"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={offset}
          />
        </Mask>
      </Defs>
      <G mask={`url(#${id}-m)`}>
        <Path d={rightHalf(c, r)} stroke={`url(#${id}-a)`} strokeWidth={RING_STROKE + 1} fill="none" />
        <Path d={leftHalf(c, r)} stroke={`url(#${id}-b)`} strokeWidth={RING_STROKE + 1} fill="none" />
        {/* the start cap sits left of 12 o'clock; paint it the start colour */}
        <Circle cx={c} cy={c - r} r={RING_STROKE / 2} fill={colors[0]} />
      </G>
    </>
  );
}

/** The colour of a lap's two-half gradient at a given progress (0..1), matching RingLap exactly. */
function lapColourAt(colors: [string, string], p: number) {
  const mid = mix(colors[0], colors[1], 0.5);
  const cos = Math.cos(p * Math.PI * 2);
  return p <= 0.5 ? mix(colors[0], mid, (1 - cos) / 2) : mix(mid, colors[1], (1 + cos) / 2);
}

/** Samples a lap's gradient so the tip's colour can follow progress exactly. */
const TIP_SAMPLES = 24;
function tipColour(progress: Animated.Value, colors: [string, string], lap: number) {
  const inputRange = Array.from({ length: TIP_SAMPLES + 1 }, (_, k) => lap + k / TIP_SAMPLES);
  return progress.interpolate({
    inputRange,
    outputRange: inputRange.map((_, k) => lapColourAt(colors, k / TIP_SAMPLES)),
    extrapolate: "clamp",
  });
}

/** Tip shadows fall forward along the arc; past 100% the shadow deepens so lap two reads as lying over lap one. */
const TIP_SHADOW = { first: "2px 0 6px rgba(0,0,0,0.3)", second: "3px 0 7px rgba(0,0,0,0.6)" };

/** The end cap: a dot riding the tip in the arc's own colour, casting a soft shadow forward onto lap one. */
function RingTip({ index, ring, progress }: { index: number; ring: HealthRing; progress: Animated.Value }) {
  const r = ringRadius(index);
  const anim = useMemo(
    () => ({
      rotate: progress.interpolate({ inputRange: [0, 4], outputRange: ["0deg", "1440deg"] }),
      first: progress.interpolate({ inputRange: [0, 0.015, 0.999, 1.001], outputRange: [0, 1, 1, 0], extrapolate: "clamp" }),
      second: progress.interpolate({ inputRange: [0.999, 1.001], outputRange: [0, 1], extrapolate: "clamp" }),
      firstColour: tipColour(progress, ring.colors, 0),
      secondColour: tipColour(progress, ring.lapColors, 1),
    }),
    [progress, ring],
  );
  const dot: ViewStyle = {
    position: "absolute",
    left: RING_BOX / 2 - RING_STROKE / 2,
    top: RING_BOX / 2 - r - RING_STROKE / 2,
    width: RING_STROKE,
    height: RING_STROKE,
    borderRadius: RING_STROKE / 2,
  };
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate: anim.rotate }] }]}>
      <Animated.View
        style={[dot, { opacity: anim.first, backgroundColor: anim.firstColour, boxShadow: TIP_SHADOW.first }]}
      />
      <Animated.View
        style={[dot, { opacity: anim.second, backgroundColor: anim.secondColour, boxShadow: TIP_SHADOW.second }]}
      />
    </Animated.View>
  );
}

const RingLayer = memo(function RingLayer({
  uid,
  index,
  ring,
  progress,
  dim,
}: {
  uid: string;
  index: number;
  ring: HealthRing;
  progress: Animated.Value;
  dim: Animated.Value;
}) {
  const c = RING_BOX / 2;
  const anim = useMemo(
    () => ({
      layer: {
        opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.1] }),
        transform: [{ scale: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }],
      },
      // Hides the arc's round caps until it has length.
      visible: progress.interpolate({ inputRange: [0, 0.004], outputRange: [0, 1], extrapolate: "clamp" }),
    }),
    [dim, progress],
  );
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, anim.layer]}>
      <Svg width={RING_BOX} height={RING_BOX} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={ringRadius(index)} stroke={ring.colors[0]} strokeOpacity={0.16} strokeWidth={RING_STROKE} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim.visible }]}>
        <Svg width={RING_BOX} height={RING_BOX} style={StyleSheet.absoluteFill}>
          <RingLap uid={uid} index={index} colors={ring.colors} progress={progress} lap={0} />
          <RingLap uid={uid} index={index} colors={ring.lapColors} progress={progress} lap={1} />
        </Svg>
        <RingTip index={index} ring={ring} progress={progress} />
      </Animated.View>
    </Animated.View>
  );
});

const HALO = RING_BOX + 120;

/**
 * A neutral ring of light that brightens around the rings while one is
 * isolated: focus reads through luminance, never a coloured glow on the page.
 */
function FocusHalo({ uid, opacity }: { uid: string; opacity: Animated.Value }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.halo, { opacity }]}>
      <Svg width={HALO} height={HALO}>
        <Defs>
          <RadialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.68" stopColor="#FFFFFF" stopOpacity={0.07} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${uid}-halo)`} />
      </Svg>
    </Animated.View>
  );
}

/** A neutral pool of light under the rings, so they sit on something rather than float. */
function RingLight({ uid }: { uid: string }) {
  return (
    <View pointerEvents="none" style={styles.halo}>
      <Svg width={HALO} height={HALO}>
        <Defs>
          <RadialGradient id={`${uid}-pool`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.06} />
            <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.015} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${uid}-pool)`} />
      </Svg>
    </View>
  );
}

type RingStageProps = {
  uid: string;
  rings: HealthRing[];
  values: HealthDay["values"];
  dayName: string;
  focus: number | null;
  onFocus: (i: number | null) => void;
  /** True until the first day switch: the rings draw in from zero rather than easing between days. */
  intro: boolean;
  reduce: boolean;
};

function RingStage({ uid, rings, values, dayName, focus, onFocus, intro, reduce }: RingStageProps) {
  const progress = useRef(rings.map(() => new Animated.Value(0))).current;
  const dims = useRef(rings.map(() => new Animated.Value(0))).current;
  const halo = useRef(new Animated.Value(0)).current;

  // Draw in on first view; afterwards ease from wherever the rings are to the new day, never from zero.
  useEffect(() => {
    const targets = rings.map((ring, i) => Math.min(values[i] / ring.goal, MAX_LAPS));
    if (reduce) {
      progress.forEach((p, i) => p.setValue(targets[i]));
      return;
    }
    const anim = Animated.stagger(
      intro ? 70 : 60,
      progress.map((p, i) =>
        Animated.timing(p, {
          toValue: targets[i],
          duration: intro ? 720 + targets[i] * 160 : 820,
          easing: intro ? EASE_OUT : EASE_IN_OUT,
          useNativeDriver: false,
        }),
      ),
    );
    const timer = setTimeout(() => anim.start(), intro ? CUE.ringDraw : 0);
    return () => {
      clearTimeout(timer);
      anim.stop();
    };
  }, [values, rings, progress, intro, reduce]);

  // Isolating a ring dims the others and brightens a neutral halo around the stage.
  useEffect(() => {
    const lit = focus === null ? 0 : 1;
    if (reduce) halo.setValue(lit);
    else Animated.timing(halo, { toValue: lit, duration: 420, easing: EASE_OUT, useNativeDriver: true }).start();
    rings.forEach((_, i) => {
      const dim = focus === null || focus === i ? 0 : 1;
      if (reduce) dims[i].setValue(dim);
      else Animated.spring(dims[i], { toValue: dim, stiffness: 300, damping: 34, mass: 1, useNativeDriver: true }).start();
    });
  }, [focus, rings, dims, halo, reduce]);

  // Read the touch point on press-in: by the time onPress fires, react-native-web
  // can no longer resolve it relative to the ring box.
  const touchPoint = useRef<{ x: number; y: number } | null>(null);
  const onPressIn = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    touchPoint.current = Number.isFinite(locationX) && Number.isFinite(locationY) ? { x: locationX, y: locationY } : null;
  };
  const onPress = () => {
    const pt = touchPoint.current;
    touchPoint.current = null;
    if (!pt) {
      // keyboard or assistive activation: step through the rings
      onFocus(focus === null ? 0 : focus + 1 < rings.length ? focus + 1 : null);
      return;
    }
    const dist = Math.hypot(pt.x - RING_BOX / 2, pt.y - RING_BOX / 2);
    const hit = rings.findIndex((_, i) => Math.abs(dist - ringRadius(i)) <= (RING_STROKE + RING_GAP) / 2);
    onFocus(hit === -1 ? null : hit);
  };

  const focused = focus === null ? null : rings[focus];
  const closed = rings.filter((ring, i) => values[i] >= ring.goal).length;
  const readout = focus === null ? closed : (values[focus] / rings[focus].goal) * 100;
  const sub = (() => {
    if (!focused || focus === null) return closed === rings.length ? "all rings closed" : "rings closed";
    const diff = values[focus] - focused.goal;
    return diff >= 0 ? `+${group(diff)} ${focused.unit} over` : `${group(-diff)} ${focused.unit} to go`;
  })();

  return (
    <View style={styles.ringStage}>
      <RingLight uid={uid} />
      <FocusHalo uid={uid} opacity={halo} />
      <Pressable
        onPressIn={onPressIn}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Activity rings. ${rings.map((r, i) => `${r.label} ${values[i]} of ${r.goal} ${r.unit}`).join(". ")}`}
        accessibilityHint="Tap a ring to focus it"
        style={[styles.ringBox, noSelect]}
      >
        {rings.map((ring, i) => (
          <RingLayer key={ring.key} uid={uid} index={i} ring={ring} progress={progress[i]} dim={dims[i]} />
        ))}
        <View pointerEvents="none" style={styles.centre}>
          <Swap id={focused ? focused.key : dayName} reduce={reduce} style={styles.centreSwap}>
            <Text style={[styles.centreLabel, { color: focused ? focused.colors[1] : COLOR.sub }]}>{focused ? focused.label.toUpperCase() : dayName}</Text>
          </Swap>
          <CountUp
            value={readout}
            format={whole}
            delay={CUE.ringDraw + 160}
            reduce={reduce}
            style={styles.centreValue}
            suffix={<Text style={styles.centreSuffix}>{focused ? "%" : `/${rings.length}`}</Text>}
          />
          <Swap id={`${focused?.key ?? "all"}-${sub}`} reduce={reduce}>
            <Text style={styles.centreSub}>{sub}</Text>
          </Swap>
        </View>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Legend: doubles as accessible ring controls                          */
/* ------------------------------------------------------------------ */

function Legend({ rings, values, focus, onFocus, reduce }: { rings: HealthRing[]; values: HealthDay["values"]; focus: number | null; onFocus: (i: number) => void; reduce: boolean }) {
  return (
    <View style={styles.legend}>
      {rings.map((ring, i) => {
        const active = focus === null || focus === i;
        const delay = CUE.legend + i * 50;
        return (
          <Reveal key={ring.key} delay={delay} reduce={reduce} style={styles.legendCell} veil={{ bleed: 6 }}>
            <Squish
              to={0.95}
              reduce={reduce}
              onPress={() => onFocus(i)}
              accessibilityRole="button"
              accessibilityLabel={`${ring.label}: ${values[i]} of ${ring.goal} ${ring.unit}`}
              accessibilityState={{ selected: focus === i }}
              style={[styles.legendItem, { opacity: active ? 1 : 0.38 }]}
            >
              <View style={styles.legendHead}>
                <LinearGradient colors={ring.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.legendSwatch} />
                <Text style={styles.legendLabel}>{ring.label}</Text>
              </View>
              <CountUp
                value={values[i]}
                delay={delay + CUE.figures}
                reduce={reduce}
                style={styles.legendValue}
                suffix={<Text style={styles.legendGoal}>{`/${ring.goal} ${ring.unit.toUpperCase()}`}</Text>}
              />
            </Squish>
          </Reveal>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Metric cards                                                         */
/* ------------------------------------------------------------------ */

function CardLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.cardLabel}>
      {icon}
      <Text style={styles.cardLabelText}>{label}</Text>
    </View>
  );
}

/** Measures a card's inner width so its chart can fill it. */
function useInnerWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(0, e.nativeEvent.layout.width - CARD_PAD * 2));
  return [width, onLayout] as const;
}

/** Hourly steps, drawn left to right; the fill and a "now" dot in the accent arrive as it finishes. */
const Sparkline = memo(function Sparkline({
  uid,
  hourly,
  width,
  accent,
  delay,
  reduce,
}: {
  uid: string;
  hourly: number[];
  width: number;
  accent: string;
  delay: number;
  reduce: boolean;
}) {
  const h = CHART_H;
  const draw = useRef(new Animated.Value(0)).current;
  const { d, area, length, last } = useMemo(() => {
    const max = Math.max(1200, ...hourly);
    // Square-root scale so the quiet hours still have shape.
    const pts = hourly.map((v, i) => [3 + (i / 23) * (width - 6), h - 3 - Math.sqrt(v / max) * (h - 8)] as Point);
    const line = smoothPath(pts);
    const end = pts[pts.length - 1];
    return {
      ...line,
      last: end,
      area: end ? `${line.d} L ${fmt(end[0])} ${h} L ${fmt(pts[0][0])} ${h} Z` : "",
    };
  }, [hourly, width, h]);

  useEffect(() => {
    if (reduce) {
      draw.setValue(1);
      return;
    }
    draw.setValue(0);
    const anim = Animated.timing(draw, { toValue: 1, duration: MOTION.draw + 200, delay, easing: EASE_OUT, useNativeDriver: false });
    // A frame late: an animation started in the mounting tick can stall on the web.
    const raf = requestAnimationFrame(() => anim.start());
    return () => {
      cancelAnimationFrame(raf);
      anim.stop();
    };
    // Redraws per day; `delay` is chosen by the caller for that run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourly, reduce, draw]);

  const anim = useMemo(
    () => ({
      offset: draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] }),
      fill: draw.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }),
      dot: draw.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0, 0, 1] }),
      dotScale: draw.interpolate({ inputRange: [0.9, 1], outputRange: [0.4, 1], extrapolate: "clamp" }),
    }),
    [draw, length],
  );

  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={`${uid}-spark-fill`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${uid}-spark-line`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
          </SvgLinearGradient>
        </Defs>
        {[0.33, 0.66].map((f) => (
          <Path key={f} d={`M 0 ${h * f} H ${width}`} stroke={COLOR.grid} strokeWidth={1} strokeDasharray="2 3" />
        ))}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim.fill }]}>
        <Svg width={width} height={h}>
          <Path d={area} fill={`url(#${uid}-spark-fill)`} />
        </Svg>
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={h}>
          <AnimatedPath
            d={d}
            stroke={`url(#${uid}-spark-line)`}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${length} ${length}`}
            strokeDashoffset={anim.offset}
          />
        </Svg>
      </View>
      {last ? (
        <Animated.View
          style={[
            styles.nowDot,
            {
              left: last[0] - 4,
              top: last[1] - 4,
              backgroundColor: accent,
              opacity: anim.dot,
              transform: [{ scale: anim.dotScale }],
              boxShadow: `0 0 0 3px ${alpha(accent, 0.22)}, 0 0 12px ${alpha(accent, 0.7)}`,
            },
          ]}
        />
      ) : null}
    </View>
  );
});

const BEATS = 2;
const COMET = 46;

/**
 * An ECG trace that strokes in, then a short comet in the accent runs along it
 * at the resting rate: the component's one ambient loop.
 */
const BeatLine = memo(function BeatLine({
  width,
  bpm,
  accent,
  delay,
  drawKey,
  reduce,
}: {
  width: number;
  bpm: number;
  accent: string;
  delay: number;
  /** Changes when the trace should redraw (a new day). */
  drawKey: string;
  reduce: boolean;
}) {
  const h = CHART_H - 4;
  const draw = useRef(new Animated.Value(0)).current;
  const run = useRef(new Animated.Value(0)).current;
  const { d, length } = useMemo(() => ecgPath(width, h, BEATS), [width, h]);

  useEffect(() => {
    if (reduce) {
      draw.setValue(1);
      return;
    }
    draw.setValue(0);
    const anim = Animated.timing(draw, { toValue: 1, duration: MOTION.draw, delay, easing: EASE_OUT, useNativeDriver: false });
    const raf = requestAnimationFrame(() => anim.start());
    return () => {
      cancelAnimationFrame(raf);
      anim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey, reduce, draw]);

  useEffect(() => {
    if (reduce || bpm <= 0) return;
    run.setValue(0);
    const loop = Animated.loop(Animated.timing(run, { toValue: 1, duration: (60000 / bpm) * BEATS, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [bpm, reduce, run]);

  const anim = useMemo(
    () => ({
      trace: draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] }),
      comet: run.interpolate({ inputRange: [0, 1], outputRange: [COMET, -length] }),
      // The comet waits for the trace to finish drawing.
      cometIn: draw.interpolate({ inputRange: [0.85, 1], outputRange: [0, 1], extrapolate: "clamp" }),
    }),
    [draw, run, length],
  );

  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <AnimatedPath
          d={d}
          stroke="#FFFFFF"
          strokeOpacity={0.2}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={anim.trace}
        />
      </Svg>
      {reduce ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim.cometIn }]}>
          <Svg width={width} height={h}>
            <AnimatedPath
              d={d}
              stroke={accent}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${COMET} ${length + COMET}`}
              strokeDashoffset={anim.comet}
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
});

/** Keeps zero-minute stages from collapsing the flex maths. */
const MIN_FLEX = 0.0001;

/** One stage of the night: its width tweens between days, and its fill grows in from the left on first view. */
function SleepSegment({ grow, tone, delay, gap, reduce }: { grow: Animated.Value; tone: string; delay: number; gap: number; reduce: boolean }) {
  const [t] = useCue(delay, { reduce, duration: MOTION.grow });
  return (
    <Animated.View style={{ flexGrow: grow, flexBasis: 0, marginRight: gap }}>
      <Animated.View style={[styles.sleepFill, { backgroundColor: tone }, reduce ? { opacity: t } : { transform: [{ scaleX: t }] }]} />
    </Animated.View>
  );
}

function SleepBar({ sleep, delay, reduce }: { sleep: SleepStages; delay: number; reduce: boolean }) {
  const grow = useRef(SLEEP_STAGES.map((s) => new Animated.Value(sleep[s.key] || MIN_FLEX))).current;
  useEffect(() => {
    SLEEP_STAGES.forEach((s, i) => {
      const to = sleep[s.key] || MIN_FLEX;
      if (reduce) grow[i].setValue(to);
      else Animated.timing(grow[i], { toValue: to, duration: MOTION.recount, easing: EASE_IN_OUT, useNativeDriver: false }).start();
    });
  }, [sleep, grow, reduce]);
  return (
    <View style={styles.sleepBar} accessible accessibilityLabel={SLEEP_STAGES.map((s) => `${s.label} ${hm(sleep[s.key])}`).join(", ")}>
      {SLEEP_STAGES.map((s, i) => (
        <SleepSegment key={s.key} grow={grow[i]} tone={s.tone} delay={delay + i * 70} gap={i < SLEEP_STAGES.length - 1 ? 2 : 0} reduce={reduce} />
      ))}
    </View>
  );
}

type CardProps = { uid: string; day: HealthDay; accent: string; intro: boolean; reduce: boolean };

function StepsCard({ uid, day, accent, intro, reduce }: CardProps) {
  const [width, onLayout] = useInnerWidth();
  return (
    <Reveal delay={CUE.steps} reduce={reduce} style={styles.stepsCell} veil={{ radius: CARD_RADIUS }}>
      <Surface style={styles.fill}>
        <View style={styles.card} onLayout={onLayout}>
          <CardLabel icon={<StepsIcon color={COLOR.sub} />} label="Steps" />
          <CountUp value={day.steps} delay={CUE.steps + CUE.figures} reduce={reduce} style={styles.cardValue} />
          <View style={styles.cardSubRow}>
            <CountUp value={day.distanceKm} format={oneDecimal} delay={CUE.steps + CUE.figures + 60} reduce={reduce} style={styles.cardSub} />
            <Text style={styles.cardSub}> km · goal 10,000</Text>
          </View>
          {/* On a day switch the old chart fades out before the new one draws, rather than vanishing. */}
          <Swap id={day.dateLabel} reduce={reduce} style={styles.chartSpace}>
            {width > 0 ? (
              <Sparkline uid={uid} hourly={day.hourly} width={width} accent={accent} delay={intro ? CUE.steps + CUE.charts : SWITCH_DELAY} reduce={reduce} />
            ) : null}
          </Swap>
        </View>
      </Surface>
    </Reveal>
  );
}

function HeartCard({ day, accent, intro, reduce }: Omit<CardProps, "uid">) {
  const [width, onLayout] = useInnerWidth();
  const figures = CUE.heart + CUE.figures;
  return (
    <Reveal delay={CUE.heart} reduce={reduce} style={styles.heartCell} veil={{ radius: CARD_RADIUS }}>
      <Surface style={styles.fill}>
        <View style={styles.card} onLayout={onLayout}>
          <CardLabel icon={<HeartIcon color={COLOR.sub} />} label="Heart" />
          <CountUp value={day.restingHr} delay={figures} reduce={reduce} style={styles.cardValue} suffix={<Text style={styles.cardUnit}>bpm</Text>} />
          <View style={styles.cardSubRow}>
            <Text style={styles.cardSub}>resting · </Text>
            <CountUp value={day.hrRange[0]} delay={figures + 60} reduce={reduce} style={styles.cardSub} />
            <Text style={styles.cardSub}>–</Text>
            <CountUp value={day.hrRange[1]} delay={figures + 60} reduce={reduce} style={styles.cardSub} />
          </View>
          <Swap id={day.dateLabel} reduce={reduce} style={styles.chartSpace}>
            {width > 0 ? (
              <BeatLine width={width} bpm={day.restingHr} accent={accent} delay={intro ? CUE.heart + CUE.charts : SWITCH_DELAY} drawKey={day.dateLabel} reduce={reduce} />
            ) : null}
          </Swap>
        </View>
      </Surface>
    </Reveal>
  );
}

function SleepCard({ day, intro, reduce }: Omit<CardProps, "uid" | "accent">) {
  const figures = CUE.sleep + CUE.figures;
  return (
    <Reveal delay={CUE.sleep} reduce={reduce} style={styles.sleepCell} veil={{ radius: CARD_RADIUS }}>
      <Surface>
        <View style={styles.card}>
          <View style={styles.sleepTop}>
            <View>
              <CardLabel icon={<MoonIcon color={COLOR.sub} />} label="Sleep" />
              <CountUp value={sumSleep(day.sleep) - day.sleep.awake} format={hm} delay={figures} reduce={reduce} style={styles.cardValue} />
            </View>
            <View style={styles.sleepTimesCol}>
              <Text style={styles.sleepTimesLabel}>IN BED</Text>
              <Swap id={day.dateLabel} reduce={reduce}>
                <Text style={[styles.sleepTimes, TABULAR]}>
                  {day.bedtime} – {day.wake}
                </Text>
              </Swap>
            </View>
          </View>
          {/* the bar grows in after the card lands; later days re-flex it instead */}
          <SleepBar sleep={day.sleep} delay={intro ? CUE.sleep + CUE.charts : 0} reduce={reduce} />
          <View style={styles.sleepLegend}>
            {SLEEP_STAGES.map((s, i) => (
              <View key={s.key} style={styles.sleepKey}>
                <View style={styles.sleepKeyHead}>
                  <View style={[styles.sleepDot, { backgroundColor: s.tone }]} />
                  <Text style={styles.sleepKeyLabel}>{s.label}</Text>
                </View>
                <CountUp value={day.sleep[s.key]} format={shortHm} delay={CUE.sleep + CUE.charts + i * 70} reduce={reduce} style={styles.sleepKeyValue} />
              </View>
            ))}
          </View>
        </View>
      </Surface>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function MobileHealthSummary({
  title = "Summary",
  initials = "NA",
  rings = DEFAULT_RINGS,
  days = DEFAULT_DAYS,
  initialDay,
  accent = DEFAULT_ACCENT,
  onDayChange,
  onRingSelect,
}: MobileHealthSummaryProps) {
  const reduce = useReducedMotion();
  // SVG ids must be unique per instance; useId's colons aren't valid inside url(#…).
  const uid = `mhs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [dayIndex, setDayIndex] = useState(() => initialDay ?? latestPastDay(days));
  const [focus, setFocus] = useState<number | null>(null);
  // The first view choreographs everything; after a day switch only the data replays.
  const [intro, setIntro] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const day = days[dayIndex];

  const pickDay = (i: number) => {
    if (days[i].future || i === dayIndex) return;
    setIntro(false);
    setDayIndex(i);
    onDayChange?.(i, days[i]);
  };

  const focusRing = (i: number | null) => {
    const next = i === focus ? null : i;
    setFocus(next);
    onRingSelect?.(next === null ? null : rings[next].key);
  };

  const dayName = dayIndex === latestPastDay(days) ? "TODAY" : day.dateLabel.split(",")[0].toUpperCase();
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }), [scrollY]);

  return (
    <View style={styles.root}>
      <Backdrop uid={uid} />
      <Animated.ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Reveal delay={CUE.date} reduce={reduce} rise={8} veil={{ bleed: 6 }}>
              <Swap id={day.dateLabel} reduce={reduce}>
                <Text style={styles.date}>{day.dateLabel.toUpperCase()}</Text>
              </Swap>
            </Reveal>
            <Reveal delay={CUE.title} reduce={reduce} veil={{ bleed: 8 }}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            </Reveal>
          </View>
          <Avatar uid={uid} initials={initials} reduce={reduce} />
        </View>

        <Reveal delay={CUE.week} reduce={reduce} veil={{ radius: 22 }}>
          <WeekSelector days={days} rings={rings} selected={dayIndex} onPick={pickDay} reduce={reduce} />
        </Reveal>

        <Reveal delay={CUE.rings} reduce={reduce} rise={16} veil={false}>
          <RingStage uid={uid} rings={rings} values={day.values} dayName={dayName} focus={focus} onFocus={focusRing} intro={intro} reduce={reduce} />
        </Reveal>

        <Legend rings={rings} values={day.values} focus={focus} onFocus={focusRing} reduce={reduce} />

        <View style={styles.row}>
          <StepsCard uid={uid} day={day} accent={accent} intro={intro} reduce={reduce} />
          <HeartCard day={day} accent={accent} intro={intro} reduce={reduce} />
        </View>
        <SleepCard day={day} intro={intro} reduce={reduce} />
      </Animated.ScrollView>
      <StatusGlass scrollY={scrollY} />
      <LinearGradient pointerEvents="none" colors={[alpha(COLOR.bg[2], 0), alpha(COLOR.bg[2], 0.9)]} style={styles.scrimBottom} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg[1], overflow: "hidden" },
  scroll: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40 },
  fill: { flex: 1 },
  veil: { position: "absolute" },
  figure: { flexDirection: "row", alignItems: "baseline" },

  /* chrome */
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },
  statusGlass: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },
  statusHairline: { position: "absolute", top: 50, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.08)" },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 36 },
  surface: { overflow: "hidden", boxShadow: "0 18px 40px -18px rgba(0,0,0,0.85)" },
  surfaceEdge: { borderWidth: 1, borderColor: COLOR.edge, borderTopColor: COLOR.edgeTop },

  /* header */
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4, marginBottom: 14 },
  headerText: { flex: 1 },
  date: { color: COLOR.sub, fontSize: 12, fontWeight: "600", letterSpacing: 1.1, marginBottom: 4 },
  title: { color: COLOR.ink, fontSize: 34, fontWeight: "700", letterSpacing: -1.1, lineHeight: 38 },
  avatarWrap: { width: AVATAR, height: AVATAR, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  avatar: {
    width: AVATAR - 8,
    height: AVATAR - 8,
    borderRadius: (AVATAR - 8) / 2,
    backgroundColor: COLOR.avatar,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  avatarText: { color: COLOR.ink, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },

  /* week */
  weekInner: { flexDirection: "row", paddingVertical: 4 },
  pill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderTopColor: "rgba(255,255,255,0.2)",
    boxShadow: "0 6px 16px -6px rgba(0,0,0,0.7)",
  },
  dayItem: { flex: 1, alignItems: "center", paddingTop: 7, paddingBottom: 7, gap: 4, minHeight: 60 },
  dayFuture: { opacity: 0.4 },
  dayLetter: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },

  /* rings */
  ringStage: { alignItems: "center", justifyContent: "center", marginTop: 14, height: RING_BOX },
  halo: { position: "absolute", width: HALO, height: HALO },
  ringBox: { width: RING_BOX, height: RING_BOX },
  centre: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  centreSwap: { alignItems: "center" },
  centreLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4 },
  centreValue: { color: COLOR.ink, fontSize: 34, fontWeight: "700", letterSpacing: -1.2, lineHeight: 38, marginTop: 1 },
  centreSuffix: { color: COLOR.faint, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  centreSub: { color: COLOR.sub, fontSize: 11, fontWeight: "500", marginTop: 1 },

  /* legend */
  legend: { flexDirection: "row", marginTop: 12, marginBottom: 12, paddingHorizontal: 4 },
  legendCell: { flex: 1 },
  legendItem: { paddingVertical: 4, minHeight: 44 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 4, borderRadius: 2 },
  legendLabel: { color: COLOR.sub, fontSize: 12, fontWeight: "600" },
  legendValue: { color: COLOR.ink, fontSize: 19, fontWeight: "700", letterSpacing: -0.5, marginTop: 3 },
  legendGoal: { color: COLOR.faint, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },

  /* cards */
  row: { flexDirection: "row", gap: 10 },
  stepsCell: { flex: 1.18 },
  heartCell: { flex: 1 },
  sleepCell: { marginTop: 10 },
  card: { paddingHorizontal: CARD_PAD, paddingTop: 14, paddingBottom: 14 },
  cardLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardLabelText: { color: COLOR.sub, fontSize: 13, fontWeight: "600" },
  cardValue: { color: COLOR.ink, fontSize: 26, fontWeight: "700", letterSpacing: -0.9, marginTop: 6, lineHeight: 30 },
  cardUnit: { color: COLOR.faint, fontSize: 14, fontWeight: "600", marginLeft: 4 },
  cardSubRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2, marginBottom: 8 },
  cardSub: { color: COLOR.sub, fontSize: 11.5, fontWeight: "500", fontVariant: ["tabular-nums"] },
  chartSpace: { height: CHART_H, justifyContent: "center" },
  nowDot: { position: "absolute", width: 8, height: 8, borderRadius: 4 },

  /* sleep */
  sleepTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sleepTimesCol: { alignItems: "flex-end" },
  sleepTimesLabel: { color: COLOR.faint, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  sleepTimes: { color: COLOR.ink, fontSize: 14, fontWeight: "600", marginTop: 3, marginBottom: 3 },
  sleepBar: { flexDirection: "row", marginTop: 12 },
  sleepFill: { height: 10, borderRadius: 3, transformOrigin: "left", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" },
  sleepLegend: { flexDirection: "row", marginTop: 10 },
  sleepKey: { flex: 1 },
  sleepKeyHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  sleepDot: { width: 6, height: 6, borderRadius: 3 },
  sleepKeyLabel: { color: COLOR.sub, fontSize: 11, fontWeight: "600" },
  sleepKeyValue: { color: COLOR.ink, fontSize: 13, fontWeight: "600", marginTop: 1 },
});

export default function MobileHealthSummaryDemo() {
  return <MobileHealthSummary />;
}
