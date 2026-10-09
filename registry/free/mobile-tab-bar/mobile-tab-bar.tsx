import {
  Component,
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
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
  LinearGradient as SvgGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  type CircleProps,
  type PathProps,
} from "react-native-svg";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TabKey = "today" | "routes" | "club" | "you";

export type TabItem = {
  key: TabKey;
  label: string;
  /** Unread count shown as a badge. Club's count clears when the tab is opened. */
  badge?: number;
};

export type QuickActionIcon = "run" | "intervals" | "log";

export type QuickAction = {
  key: string;
  label: string;
  icon: QuickActionIcon;
  /** Toast title and detail shown after the action is picked. */
  toast: string;
  detail: string;
  /** Kilometres the action adds to the week (a logged treadmill run, say). */
  addKm?: number;
};

export type WeekDay = { day: string; km: number; state: "done" | "today" | "planned" };

export type MobileTabBarProps = {
  tabs?: TabItem[];
  initialTab?: TabKey;
  runnerName?: string;
  dateLine?: string;
  goalKm?: number;
  week?: WeekDay[];
  actions?: QuickAction[];
  /** The one colour: centre action, selected tab and the week's ring. */
  accent?: string;
  onTabChange?: (key: TabKey) => void;
  onAction?: (key: string) => void;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/** True neutrals: every surface is a grey, the accent is the only hue. */
const INK = {
  bg: "#0A0A0A",
  text: "#F5F5F5",
  sub: "rgba(245,245,245,0.64)",
  faint: "rgba(245,245,245,0.5)",
  hairline: "rgba(255,255,255,0.08)",
  track: "rgba(255,255,255,0.08)",
  black: "#0A0A0A",
};

const CARD_FILL = ["#1A1A1A", "#141414", "#101010"] as const;
const HERO_FILL = ["#202020", "#171717", "#111111"] as const;
const MILK = ["#FFFFFF", "#EDEDED", "#D6D6D6"] as const;

const DEFAULT_ACCENT = "#FF6B3D";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Bar geometry. */
const BAR_SIDE = 14;
const BAR_BOTTOM = 26;
const BAR_H = 68;
const LENS_INSET = 5;
const FAB = 60;
const FAB_RISE = 18; // how far the centre action stands above the bar
const FAB_CENTRE = BAR_BOTTOM + BAR_H + FAB_RISE - FAB / 2; // from the bottom of the screen
const ARC_RADIUS = 118;

/**
 * Entrance choreography, shared by every view. Blocks arrive in reading
 * order; their figures count, draw and fill once the block has landed.
 */
const T = {
  stagger: 55, // between blocks
  rowStagger: 45, // between rows inside a block
  reveal: 520, // a block's rise and unblur
  rise: 12, // pt
  blur: 8, // px of blur that clears
  dataLag: 150, // figures start this long after their block
  count: 680,
  draw: 680,
  barLag: 180,
  barStagger: 30,
  bar: 460,
  fillLag: 300, // progress waits for its block to land
  fill: 520,
  change: 640, // later changes (a logged run) tween at this pace
  exit: 130, // the old view leaves
  reduced: 150, // reduced motion: a short fade, nothing else
};

const at = (step: number) => step * T.stagger;

/**
 * CSS `filter: blur()` renders on the web and on Android (RN 0.76+). iOS
 * ignores it, so there entrances run on the native driver and use a 0.98
 * scale for the settle instead of blur.
 */
const CAN_BLUR = Platform.OS !== "ios";

/** Room left past each end of a dashed stroke so its round cap hides. */
const DASH_PAD = 12;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_TABS: TabItem[] = [
  { key: "today", label: "Today" },
  { key: "routes", label: "Routes" },
  { key: "club", label: "Club", badge: 3 },
  { key: "you", label: "You" },
];

const DEFAULT_WEEK: WeekDay[] = [
  { day: "M", km: 6.2, state: "done" },
  { day: "T", km: 12.0, state: "done" },
  { day: "W", km: 6.1, state: "done" },
  { day: "T", km: 8.1, state: "today" },
  { day: "F", km: 0, state: "planned" },
  { day: "S", km: 0, state: "planned" },
  { day: "S", km: 0, state: "planned" },
];

const DEFAULT_ACTIONS: QuickAction[] = [
  { key: "run", label: "Outdoor run", icon: "run", toast: "GPS locked", detail: "11 satellites · tap Start when ready" },
  { key: "intervals", label: "Intervals", icon: "intervals", toast: "6 × 800 m loaded", detail: "90 s jog recoveries · warm-up first" },
  { key: "log", label: "Log treadmill", icon: "log", toast: "Treadmill run logged", detail: "5.0 km · 26:40 added to week 41", addKm: 5 },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

/** "#RRGGBB" → "rgba(r,g,b,a)" so shadows can carry the accent. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(pts: Pt[]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = round1(p1[0] + (p2[0] - p0[0]) / 6);
    const c1y = round1(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = round1(p2[0] - (p3[0] - p1[0]) / 6);
    const c2y = round1(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Length of the polyline, padded: the smooth curve is a little longer than its chords. */
function strokeLength(pts: Pt[]) {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum * 1.08;
}

/** A circle as a path that starts at 12 o'clock and runs clockwise. */
function ringPath(cx: number, cy: number, r: number) {
  return `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}`;
}

/** Values → points across a box, top-padded so peaks never touch the edge. */
function chartPoints(values: number[], width: number, height: number, pad = 3): Pt[] {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  return values.map((v, i) => [
    round1(pad + (i / (values.length - 1)) * (width - pad * 2)),
    round1(pad + (1 - (v - min) / span) * (height - pad * 2)),
  ]);
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const grouped = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Seconds → "4:52" or "1:41:30". */
function clock(totalSeconds: number) {
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Starts an animation on the next frame and returns a cleanup that stops it. */
function startNextFrame(build: () => Animated.CompositeAnimation, onDone?: () => void) {
  let anim: Animated.CompositeAnimation | undefined;
  // react-native-web can stall an animation started in the tick a view mounts.
  const frame = requestAnimationFrame(() => {
    anim = build();
    anim.start(({ finished }) => finished && onDone?.());
  });
  return () => {
    cancelAnimationFrame(frame);
    anim?.stop();
  };
}

/* ------------------------------------------------------------------ */
/* Motion context and hooks                                            */
/* ------------------------------------------------------------------ */

const ReducedMotion = createContext(false);
/** The start time (ms) of the block a figure sits in, so it can wait for it to land. */
const BlockClock = createContext(0);
const Accent = createContext(DEFAULT_ACCENT);

const useReduce = () => useContext(ReducedMotion);

function useReducedMotionSetting() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

/**
 * An Animated.Value that follows `target`. The first run is the entrance: it
 * starts at `from` after `delay`. Later changes tween from wherever it is.
 */
function useFollow(target: number, delay: number, duration: number, from = 0) {
  const reduce = useReduce();
  const value = useRef(new Animated.Value(reduce ? target : from)).current;
  const ran = useRef(false);
  useEffect(() => {
    if (reduce) {
      value.setValue(target);
      return;
    }
    const first = !ran.current;
    return startNextFrame(() => {
      // Marked here, not above: StrictMode's rehearsal run is cancelled before
      // this frame, and must not use up the entrance.
      ran.current = true;
      return Animated.timing(value, {
        toValue: target,
        duration: first ? duration : T.change,
        delay: first ? delay : 0,
        easing: first ? EASE_OUT : EASE_IN_OUT,
        useNativeDriver: false,
      });
    });
    // The entrance timing is fixed at mount; only the target re-runs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce]);
  return value;
}

function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, "");
}

/* ------------------------------------------------------------------ */
/* Animatable SVG shapes                                               */
/* ------------------------------------------------------------------ */

type NativeNode = { setNativeProps?: (props: object) => void } | null;

/**
 * Wraps a react-native-svg shape so Animated can drive it: setNativeProps
 * reaches the real node (no React render per frame), and the `collapsable`
 * prop Animated adds is dropped before the web build writes it to the DOM.
 */
function drivable<P extends object>(Shape: ComponentType<P>) {
  const Inner = Shape as unknown as ComponentType<P & { ref?: Ref<NativeNode> }>;
  class Drivable extends Component<P & { collapsable?: boolean }> {
    node: NativeNode = null;
    attach = (node: NativeNode) => {
      this.node = node;
    };
    setNativeProps(props: object) {
      this.node?.setNativeProps?.(props);
    }
    render() {
      const { collapsable, ...rest } = this.props;
      void collapsable;
      return <Inner {...(rest as P)} ref={this.attach} />;
    }
  }
  return Animated.createAnimatedComponent(Drivable);
}

const AnimatedPath = drivable<PathProps>(Path);
const AnimatedCircle = drivable<CircleProps>(Circle);

/* ------------------------------------------------------------------ */
/* Choreography primitives                                             */
/* ------------------------------------------------------------------ */

/**
 * A block that arrives: it fades, rises 12pt and its blur clears. Children
 * read its start time from BlockClock. At rest it drops the transform and
 * filter so nothing keeps a compositing layer it doesn't need.
 */
function Reveal({ delay, children, style }: { delay: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduce();
  const progress = useRef(new Animated.Value(0)).current;
  const [settled, setSettled] = useState(false);

  useEffect(
    () =>
      startNextFrame(
        () =>
          Animated.timing(progress, {
            toValue: 1,
            duration: reduce ? T.reduced : T.reveal,
            delay: reduce ? 0 : delay,
            easing: EASE_OUT,
            useNativeDriver: !CAN_BLUR,
          }),
        () => setSettled(true),
      ),
    [progress, delay, reduce],
  );

  const look = useMemo(() => {
    if (reduce) return { opacity: progress };
    const opacity = progress.interpolate({ inputRange: [0, 0.55], outputRange: [0, 1], extrapolate: "clamp" });
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [T.rise, 0] });
    if (CAN_BLUR) {
      const filter = progress.interpolate({ inputRange: [0, 1], outputRange: [`blur(${T.blur}px)`, "blur(0px)"] });
      return { opacity, filter, transform: [{ translateY }] };
    }
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
    return { opacity, transform: [{ translateY }, { scale }] };
  }, [progress, reduce]);

  return (
    <BlockClock.Provider value={delay}>
      <Animated.View style={[style, !settled && look]}>{children}</Animated.View>
    </BlockClock.Provider>
  );
}

/**
 * A number that counts to its value: from zero on arrival, from its previous
 * value on change. Its blur clears and its opacity settles as it lands.
 */
function CountUp({
  value,
  format,
  style,
  lag = T.dataLag,
}: {
  value: number;
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
  lag?: number;
}) {
  const reduce = useReduce();
  const blockStart = useContext(BlockClock);
  const count = useRef(new Animated.Value(reduce ? value : 0)).current;
  const settle = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const [shown, setShown] = useState(reduce ? value : 0);
  const [landed, setLanded] = useState(reduce);
  const ran = useRef(false);

  useEffect(() => {
    const id = count.addListener(({ value: v }) => setShown(v));
    return () => count.removeListener(id);
  }, [count]);

  useEffect(() => {
    if (reduce) {
      count.setValue(value);
      settle.setValue(1);
      setLanded(true);
      return;
    }
    const first = !ran.current;
    setLanded(false);
    // A change only half-blurs: the number is already there, it just moves.
    settle.setValue(first ? 0 : 0.5);
    const timing = {
      duration: first ? T.count : T.change,
      delay: first ? blockStart + lag : 0,
      easing: EASE_OUT,
      useNativeDriver: false,
    };
    return startNextFrame(
      () => {
        ran.current = true; // see useFollow: only a run that starts counts
        return Animated.parallel([Animated.timing(count, { toValue: value, ...timing }), Animated.timing(settle, { toValue: 1, ...timing })]);
      },
      () => setLanded(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  const look = useMemo(() => {
    const opacity = settle.interpolate({ inputRange: [0, 0.3], outputRange: [0.2, 1], extrapolate: "clamp" });
    if (!CAN_BLUR) return { opacity };
    return { opacity, filter: settle.interpolate({ inputRange: [0, 1], outputRange: ["blur(5px)", "blur(0px)"] }) };
  }, [settle]);

  return <Animated.Text style={[style, !landed && look]}>{format(shown)}</Animated.Text>;
}

/** A stroke that draws along its path to `progress` (0–1), then follows changes. */
function Stroke({
  d,
  length,
  progress = 1,
  lag = T.dataLag,
  duration = T.draw,
  ...path
}: Omit<PathProps, "strokeDasharray" | "strokeDashoffset"> & { d: string; length: number; progress?: number; lag?: number; duration?: number }) {
  const blockStart = useContext(BlockClock);
  const drawn = useFollow(progress, blockStart + lag, duration);
  const offset = useMemo(
    () => drawn.interpolate({ inputRange: [0, 1], outputRange: [length + DASH_PAD, 0], extrapolate: "clamp" }),
    [drawn, length],
  );
  return <AnimatedPath d={d} fill="none" strokeDasharray={`${length} ${length + DASH_PAD * 2}`} strokeDashoffset={offset} {...path} />;
}

/** A progress bar that fills once its block has landed. */
function Fill({ pct, color, height = 4 }: { pct: number; color: string; height?: number }) {
  const blockStart = useContext(BlockClock);
  const filled = useFollow(Math.min(Math.max(pct, 0), 1), blockStart + T.fillLag, T.fill);
  const width = useMemo(() => filled.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), [filled]);
  return (
    <View style={[s.fillTrack, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[s.fillBar, { width, borderRadius: height / 2, backgroundColor: color }]} />
    </View>
  );
}

/** Small things (avatars, pins, badges) arrive last, with one small overshoot. */
function Pop({ lag, children, style }: { lag: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduce();
  const blockStart = useContext(BlockClock);
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    // Damping ratio ≈ 0.7: one visible overshoot of a few percent, then still.
    return startNextFrame(() => Animated.spring(v, { toValue: 1, stiffness: 400, damping: 28, delay: blockStart + lag, useNativeDriver: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const look = useMemo(
    () => ({
      opacity: v.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
    }),
    [v],
  );
  return <Animated.View style={[style, look]}>{children}</Animated.View>;
}

/* ------------------------------------------------------------------ */
/* Press: a Pressable whose surface springs down while held            */
/* ------------------------------------------------------------------ */

type PressProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  label: string;
  hint?: string;
};

function Press({ children, onPress, style, scaleTo = 0.97, label, hint }: PressProps) {
  const reduce = useReduce();
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue: number, held: boolean) =>
    Animated.spring(scale, { toValue, stiffness: held ? 700 : 420, damping: held ? 40 : 22, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduce && springTo(scaleTo, true)}
      onPressOut={() => springTo(1, false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (24pt grid, 1.7 stroke, round caps)                           */
/* ------------------------------------------------------------------ */

const STROKE = { strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

const TAB_ICON: Record<TabKey, { outline: (c: string) => ReactNode; filled: (f: string) => ReactNode }> = {
  today: {
    outline: (c) => (
      <Path
        d="M4.5 10.4 12 4.6l7.5 5.8v8.4a1.7 1.7 0 0 1-1.7 1.7H15v-5.1a1.2 1.2 0 0 0-1.2-1.2h-3.6A1.2 1.2 0 0 0 9 15.4v5.1H6.2a1.7 1.7 0 0 1-1.7-1.7z"
        stroke={c}
        {...STROKE}
      />
    ),
    filled: (f) => (
      <Path
        d="M12.9 3.9a1.5 1.5 0 0 0-1.8 0L4.2 9.2a1.9 1.9 0 0 0-.7 1.5v8.1a2.7 2.7 0 0 0 2.7 2.7h3.3v-5.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5.6h3.3a2.7 2.7 0 0 0 2.7-2.7v-8.1a1.9 1.9 0 0 0-.7-1.5z"
        fill={f}
      />
    ),
  },
  routes: {
    outline: (c) => (
      <G>
        <Path d="M9 4.8 4.2 6.7a1.2 1.2 0 0 0-.7 1.1v11a.8.8 0 0 0 1.1.7L9 17.7l6 2.5 4.8-1.9a1.2 1.2 0 0 0 .7-1.1v-11a.8.8 0 0 0-1.1-.7L15 7.3z" stroke={c} {...STROKE} />
        <Path d="M9 4.8v12.9M15 7.3v12.9" stroke={c} {...STROKE} />
      </G>
    ),
    filled: (f) => (
      <G>
        <Path d="M8.2 4.9 4.2 6.5a1.4 1.4 0 0 0-.9 1.3v11.1a.9.9 0 0 0 1.2.8l3.7-1.5z" fill={f} />
        <Path d="M9.8 4.9v12.9l4.4 1.8V7.1z" fill={f} opacity={0.62} />
        <Path d="M15.8 7.1v12.6l4-1.6a1.4 1.4 0 0 0 .9-1.3V5.7a.9.9 0 0 0-1.2-.8z" fill={f} />
      </G>
    ),
  },
  club: {
    outline: (c) => (
      <G>
        <Circle cx={9} cy={8.6} r={3.3} stroke={c} {...STROKE} />
        <Path d="M3.4 19.6c.5-3.1 2.8-5 5.6-5s5.1 1.9 5.6 5" stroke={c} {...STROKE} />
        <Path d="M15.6 5.6a3 3 0 1 1 .9 5.8M17.4 14.8c2 .4 3.2 2 3.5 4.3" stroke={c} {...STROKE} />
      </G>
    ),
    filled: (f) => (
      <G>
        <Circle cx={9} cy={8.4} r={3.6} fill={f} />
        <Path d="M2.9 19.4c.5-3.4 3-5.5 6.1-5.5s5.6 2.1 6.1 5.5a1 1 0 0 1-1 1.1H3.9a1 1 0 0 1-1-1.1z" fill={f} />
        <Circle cx={16.6} cy={8.9} r={2.9} fill={f} opacity={0.62} />
        <Path d="M17 14.3c2.6.2 4.2 2.1 4.5 4.8a1 1 0 0 1-1 1.1h-3.3c.1-2.4-.6-4.4-2-5.6.6-.2 1.2-.3 1.8-.3z" fill={f} opacity={0.62} />
      </G>
    ),
  },
  you: {
    outline: (c) => (
      <G>
        <Circle cx={12} cy={8.2} r={3.7} stroke={c} {...STROKE} />
        <Path d="M5 20c.7-3.8 3.6-6 7-6s6.3 2.2 7 6" stroke={c} {...STROKE} />
      </G>
    ),
    filled: (f) => (
      <G>
        <Circle cx={12} cy={8} r={4.1} fill={f} />
        <Path d="M4.4 19.6c.8-4 3.9-6.3 7.6-6.3s6.8 2.3 7.6 6.3a1.1 1.1 0 0 1-1.1 1.3H5.5a1.1 1.1 0 0 1-1.1-1.3z" fill={f} />
      </G>
    ),
  },
};

function ActionGlyph({ icon, color, size = 24 }: { icon: QuickActionIcon; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {icon === "run" && <Path d="M12 3.6 18.6 19.4a.6.6 0 0 1-.8.8L12 17.3l-5.8 2.9a.6.6 0 0 1-.8-.8z" stroke={color} {...STROKE} />}
        {icon === "intervals" && (
          <G>
            <Circle cx={12} cy={13.6} r={6.9} stroke={color} {...STROKE} />
            <Path d="M12 13.6V10.1M10 3.6h4M12 3.6v3.1M17.6 7.6l1.3-1.3" stroke={color} {...STROKE} />
          </G>
        )}
        {icon === "log" && (
          <G>
            <Path d="M5 19h3.6L18.8 8.8a2.1 2.1 0 0 0-3-3L5.6 16z" stroke={color} {...STROKE} />
            <Path d="M14.4 7.2l2.9 2.9M13 19h6" stroke={color} {...STROKE} />
          </G>
        )}
      </Svg>
    </View>
  );
}

function Chevron({ color = INK.faint }: { color?: string }) {
  return (
    <View style={s.chevron}>
      <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
        <Path d="M9 5.5 15.5 12 9 18.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

/** Dither: a 4pt grid of faint dots that keeps gradients from banding. */
function Grain({ opacity = 0.05 }: { opacity?: number }) {
  const id = useSvgId("grain");
  return (
    <View style={s.overlay}>
      <Svg width="100%" height="100%" aria-hidden>
        <Defs>
          <Pattern id={id} width={4} height={4} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={0.55} fill="#FFFFFF" opacity={opacity} />
            <Circle cx={3} cy={3} r={0.45} fill="#000000" opacity={opacity * 1.4} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** A soft radial light, for stage glows and the hero's lift. */
function Glow({ cx, cy, r, color, opacity }: { cx: string; cy: string; r: string; color: string; opacity: number }) {
  const id = useSvgId("glow");
  return (
    <View style={s.overlay}>
      <Svg width="100%" height="100%" aria-hidden>
        <Defs>
          <RadialGradient id={id} cx={cx} cy={cy} r={r}>
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function Card({ children, style, pad = 18 }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  return (
    <View style={[s.card, { padding: pad }, style]}>
      <LinearGradient colors={CARD_FILL} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Grain opacity={0.025} />
      {children}
    </View>
  );
}

function Eyebrow({ children, color = INK.faint }: { children: ReactNode; color?: string }) {
  return <Text style={[s.eyebrow, { color }]}>{children}</Text>;
}

function ScreenHeader({ kicker, title, delay = 0, right }: { kicker: string; title: string; delay?: number; right?: ReactNode }) {
  return (
    <Reveal delay={delay} style={s.header}>
      <View style={s.flex}>
        <Text style={s.kicker}>{kicker}</Text>
        <Text style={s.h1}>{title}</Text>
      </View>
      {right}
    </Reveal>
  );
}

/** Greyscale initials avatars; "you" is inverted so your own face reads first. */
type AvatarTone = "you" | "light" | "mid" | "dark";
const AVATAR_TONES: Record<AvatarTone, { fill: readonly [string, string]; ink: string }> = {
  you: { fill: ["#FFFFFF", "#D4D4D4"], ink: INK.black },
  light: { fill: ["#8C8C8C", "#4E4E4E"], ink: "#FFFFFF" },
  mid: { fill: ["#616161", "#363636"], ink: "#FFFFFF" },
  dark: { fill: ["#3D3D3D", "#232323"], ink: "rgba(255,255,255,0.86)" },
};

function Avatar({ initials, tone, size = 26, ring = INK.black }: { initials: string; tone: AvatarTone; size?: number; ring?: string }) {
  const { fill, ink } = AVATAR_TONES[tone];
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]}>
      <LinearGradient colors={fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={[s.avatarText, { fontSize: size * 0.38, color: ink }]}>{initials}</Text>
    </View>
  );
}

/** How much of each stacked avatar the next one covers: enough to group, never the initials. */
const STACK_OVERLAP = 0.2;

/** Overlapping avatars that pop in one after another, ringed in the card colour to cut them apart. */
function AvatarStack({ people, lag, size = 26 }: { people: { initials: string; tone: AvatarTone }[]; lag: number; size?: number }) {
  return (
    <View style={s.row}>
      {people.map((p, i) => (
        <Pop key={p.initials} lag={lag + i * T.rowStagger} style={i > 0 && { marginLeft: -Math.round(size * STACK_OVERLAP) }}>
          <Avatar initials={p.initials} tone={p.tone} size={size} ring={CARD_FILL[1]} />
        </Pop>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

type SparklineProps = {
  values: number[];
  height?: number;
  /** Fixed width; omit to fill the parent (measured). */
  width?: number;
  lag?: number;
  /** Mark the latest value with a dot that pops as the line arrives. */
  dot?: boolean;
  strokeWidth?: number;
};

/** A line that draws left to right, its area fading up behind it as it goes. */
function Sparkline({ values, height = 36, width: fixedWidth, lag = T.dataLag, dot = true, strokeWidth = 1.8 }: SparklineProps) {
  const [measured, setMeasured] = useState(0);
  const width = fixedWidth ?? measured;
  const area = useSvgId("spark");
  const blockStart = useContext(BlockClock);
  // The area trails the stroke, so it never shows ahead of the line.
  const shade = useFollow(1, blockStart + lag + T.draw * 0.45, T.draw * 0.7);
  const chart = useMemo(() => {
    if (!width) return null;
    const pts = chartPoints(values, width, height, 4);
    const line = smoothPath(pts);
    const end = pts[pts.length - 1];
    return { line, end, length: strokeLength(pts), area: `${line} L${end[0]} ${height} L${pts[0][0]} ${height} Z` };
  }, [values, width, height]);
  return (
    <View style={{ height, width: fixedWidth }} onLayout={fixedWidth ? undefined : (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width)}>
      {chart && (
        <Svg width={width} height={height} aria-hidden>
          <Defs>
            <SvgGradient id={area} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </SvgGradient>
          </Defs>
          <AnimatedPath d={chart.area} fill={`url(#${area})`} opacity={shade} />
          <Stroke d={chart.line} length={chart.length} lag={lag} stroke="rgba(255,255,255,0.9)" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          {dot && <EndDot x={chart.end[0]} y={chart.end[1]} lag={lag + T.draw * 0.85} />}
        </Svg>
      )}
    </View>
  );
}

/** A dot that marks where a line ends, popping in as the line arrives. */
function EndDot({ x, y, lag, r = 3.2 }: { x: number; y: number; lag: number; r?: number }) {
  const blockStart = useContext(BlockClock);
  const reduce = useReduce();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    return startNextFrame(() => Animated.spring(v, { toValue: 1, stiffness: 400, damping: 28, delay: blockStart + lag, useNativeDriver: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const halo = useMemo(() => v.interpolate({ inputRange: [0, 1], outputRange: [0, r + 3] }), [v, r]);
  const core = useMemo(() => v.interpolate({ inputRange: [0, 1], outputRange: [0, r] }), [v, r]);
  return (
    <G>
      <AnimatedCircle cx={x} cy={y} r={halo} fill="#FFFFFF" opacity={0.16} />
      <AnimatedCircle cx={x} cy={y} r={core} fill="#FFFFFF" stroke={INK.black} strokeWidth={1.4} />
    </G>
  );
}

/** A column that grows from the baseline, and re-grows when its value changes. */
function GrowBar({ height, lag, style }: { height: number; lag: number; style: StyleProp<ViewStyle> }) {
  const blockStart = useContext(BlockClock);
  const h = useFollow(height, blockStart + lag, T.bar);
  return <Animated.View style={[style, { height: h }]} />;
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

const MAP_W = 360;
const MAP_H = 172;

type MapLayout = "lea" | "marshes";

const PARKS: Record<MapLayout, [string, string]> = {
  lea: ["M188 18c40-14 96-10 128 12s30 64-6 82-92 14-118-8-44-72-4-86z", "M214 40c28-8 62-4 80 10s14 40-10 50-60 6-74-8-20-46 4-52z"],
  marshes: ["M30 92c30-22 92-26 120-4s20 70-20 78-96 2-110-24-14-34 10-50z", "M54 110c22-12 58-12 74 2s8 40-18 44-56-4-62-20 0-20 6-26z"],
};
const RIVER = "M-10 150C60 120 90 140 150 118S250 70 300 92s60-8 80-20";
/** Map units within which a route's end counts as back at its start. */
const LOOP_CLOSE = 16;

/** A drawn greyscale street map; the run is a white line that draws itself on. */
function RunMap({ route, height = MAP_H, layout = "lea" }: { route: Pt[]; height?: number; layout?: MapLayout }) {
  const land = useSvgId("land");
  const d = useMemo(() => smoothPath(route), [route]);
  const length = useMemo(() => strokeLength(route), [route]);
  const [start, end] = [route[0], route[route.length - 1]];
  // A loop finishes where it began: one marker, not two stacked dots.
  const isLoop = Math.hypot(end[0] - start[0], end[1] - start[1]) < LOOP_CLOSE;
  const [park, parkInner] = PARKS[layout];
  return (
    <View style={{ height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Defs>
          <RadialGradient id={land} cx="65%" cy="35%" r="75%">
            <Stop offset="0" stopColor="#1F1F1F" />
            <Stop offset="1" stopColor="#121212" />
          </RadialGradient>
        </Defs>
        <Rect width={MAP_W} height={MAP_H} fill={`url(#${land})`} />
        <Path d={park} fill="#1C1C1C" />
        <Path d={parkInner} fill="#222222" />
        <Path d={RIVER} stroke="#0B0B0B" strokeWidth={16} fill="none" strokeLinecap="round" />
        <Path d={RIVER} stroke="rgba(255,255,255,0.05)" strokeWidth={4} fill="none" strokeLinecap="round" />
        <G stroke="rgba(255,255,255,0.06)" strokeWidth={1.4} fill="none">
          <Path d="M0 40h360M0 76h140M40 0v172M96 0v120M150 0l40 172M250 0v60M300 120v52M0 112l120-20M200 140h160" />
        </G>
        <G stroke="rgba(255,255,255,0.11)" strokeWidth={3} fill="none" strokeLinecap="round">
          <Path d="M-4 58C80 54 140 70 210 50S330 30 364 36M120 -4C126 60 108 120 118 176" />
        </G>
        <Stroke d={d} length={length} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        <Stroke d={d} length={length} stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        {!isLoop && <EndDot x={start[0]} y={start[1]} lag={T.dataLag} r={4} />}
        <EndDot x={end[0]} y={end[1]} lag={T.dataLag + T.draw * 0.9} r={4} />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

const RING = 92;
const RING_R = 38;
const BAR_TRACK = 40;
const BAR_MIN = 6;

function WeekHero({ km, goal, week }: { km: number; goal: number; week: WeekDay[] }) {
  const accent = useContext(Accent);
  const pct = Math.min(km / goal, 1);
  const left = Math.max(goal - km, 0);
  const base = week.reduce((sum, d) => sum + d.km, 0);
  const extra = km - base; // what a logged run added today
  const dayKm = (d: WeekDay) => d.km + (d.state === "today" ? Math.max(extra, 0) : 0);
  const max = Math.max(...week.map(dayKm), 10);

  return (
    <View style={s.hero}>
      <LinearGradient colors={HERO_FILL} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Glow cx="10%" cy="0%" r="70%" color="#FFFFFF" opacity={0.08} />
      <Glow cx="84%" cy="34%" r="42%" color={accent} opacity={0.14} />
      <Grain opacity={0.035} />

      <View style={s.heroTop}>
        <View style={s.flex}>
          <Eyebrow>THIS WEEK</Eyebrow>
          <View style={s.heroNumRow}>
            <CountUp value={km} format={(v) => v.toFixed(1)} style={s.heroNum} />
            <Text style={s.heroUnit}>km</Text>
          </View>
          <View style={s.row}>
            <Text style={s.heroSub}>of {goal} km · </Text>
            <CountUp value={left} format={(v) => (v > 0.05 ? `${v.toFixed(1)} to go` : "goal reached")} style={s.heroSub} />
          </View>
        </View>
        <View style={s.ringWrap}>
          <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden>
            <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={INK.track} strokeWidth={9} fill="none" />
            <Stroke
              d={ringPath(RING / 2, RING / 2, RING_R)}
              length={2 * Math.PI * RING_R}
              progress={pct}
              stroke={accent}
              strokeWidth={9}
              strokeLinecap="round"
              duration={T.draw + 80}
            />
          </Svg>
          <View style={[StyleSheet.absoluteFill, s.center]}>
            <CountUp value={pct * 100} format={(v) => `${Math.round(v)}%`} style={s.ringPct} />
          </View>
        </View>
      </View>

      <View style={s.days} accessibilityLabel={`Daily distance: ${week.map((d) => `${d.day} ${dayKm(d)} km`).join(", ")}`}>
        {week.map((d, i) => (
          <View key={i} style={s.dayCol}>
            <View style={s.dayTrack}>
              {d.state === "planned" ? (
                <View style={[s.dayBar, s.dayPlanned]} />
              ) : (
                <GrowBar
                  height={Math.max(BAR_MIN, (dayKm(d) / max) * BAR_TRACK)}
                  lag={T.barLag + i * T.barStagger}
                  style={[s.dayBar, d.state === "today" ? { backgroundColor: accent, boxShadow: `0 0 14px ${withAlpha(accent, 0.45)}` } : s.dayDone]}
                />
              )}
            </View>
            <Text style={[s.dayLabel, d.state === "today" && s.dayLabelToday]}>{d.day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const PACE_TREND = [5.12, 5.08, 5.1, 5.01, 4.98, 5.0, 4.94, 4.9, 4.93, 4.87];

function PaceTile() {
  return (
    <Card style={s.flex} pad={16}>
      <Eyebrow>AVG PACE</Eyebrow>
      <View style={s.tileNumRow}>
        <CountUp value={292} format={clock} style={s.tileNum} />
        <Text style={s.tileUnit}>/km</Text>
      </View>
      {/* Pace improves as it falls, so the line is drawn rising toward today. */}
      <Sparkline values={PACE_TREND.map((p) => -p)} />
      <Text style={s.tileFoot}>6 s faster than Sept</Text>
    </Card>
  );
}

const STREAK_SLOTS = 14;
const STREAK_BAR = 26;

function StreakTile({ days }: { days: number }) {
  const firstOn = STREAK_SLOTS - days;
  return (
    <Card style={s.flex} pad={16}>
      <Eyebrow>STREAK</Eyebrow>
      <View style={s.tileNumRow}>
        <CountUp value={days} format={(v) => String(Math.round(v))} style={s.tileNum} />
        <Text style={s.tileUnit}>days</Text>
      </View>
      <View style={s.streakRow} accessibilityLabel={`Ran on each of the last ${days} days`}>
        {Array.from({ length: STREAK_SLOTS }, (_, i) => {
          const on = i >= firstOn;
          const today = i === STREAK_SLOTS - 1;
          // Older days are dimmer; the meter brightens toward today.
          const lum = 0.22 + ((i - firstOn) / Math.max(days - 1, 1)) * 0.5;
          return (
            <View key={i} style={s.streakSlot}>
              {on && (
                <GrowBar
                  height={STREAK_BAR}
                  lag={T.dataLag + (i - firstOn) * 28}
                  style={[s.streakBar, today ? s.streakNow : { backgroundColor: `rgba(255,255,255,${lum})` }]}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={s.tileFoot}>Longest since May</Text>
    </Card>
  );
}

const TEMPO_ROUTE: Pt[] = [
  [44, 132], [68, 104], [96, 86], [130, 74], [156, 54], [190, 36], [228, 34],
  [262, 46], [288, 68], [290, 96], [266, 120], [228, 126], [186, 132],
];

function LastRun() {
  const stats: { value: number; format: (n: number) => string; label: string }[] = [
    { value: 12, format: (n) => n.toFixed(1), label: "km" },
    { value: 3504, format: clock, label: "time" },
    { value: 292, format: clock, label: "/km" },
    { value: 64, format: (n) => `+${Math.round(n)}`, label: "m climb" },
  ];
  return (
    <Press label="Last run: Tuesday tempo, 12 kilometres in 58 minutes 24" style={s.pressCard} scaleTo={0.98}>
      <Card pad={0}>
        <View style={s.cardBody}>
          <View style={s.rowBetween}>
            <Eyebrow>LAST RUN · TUE 7 OCT</Eyebrow>
            <Chevron />
          </View>
          <Text style={s.cardTitle}>Tuesday tempo</Text>
          <View style={s.statRow}>
            {stats.map((st) => (
              <View key={st.label}>
                <CountUp value={st.value} format={st.format} style={s.statVal} />
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s.mapWrap}>
          <RunMap route={TEMPO_ROUTE} />
        </View>
      </Card>
    </Press>
  );
}

function UpNext() {
  return (
    <Press label="Up next: Saturday long run along the Lea, 18 kilometres" style={s.pressCard} scaleTo={0.98}>
      <Card>
        <View style={s.rowBetween}>
          <Eyebrow>UP NEXT · SAT 07:00</Eyebrow>
          <Chevron />
        </View>
        <Text style={s.cardTitle}>Long run along the Lea</Text>
        <View style={[s.rowBetween, s.mt10]}>
          <Text style={s.cardSub}>18 km easy · 5:30 /km</Text>
          <AvatarStack
            lag={T.fillLag}
            people={[
              { initials: "IO", tone: "light" },
              { initials: "TR", tone: "mid" },
              { initials: "+4", tone: "dark" },
            ]}
          />
        </View>
      </Card>
    </Press>
  );
}

function TodayScreen({ name, initials, dateLine, km, goal, week }: { name: string; initials: string; dateLine: string; km: number; goal: number; week: WeekDay[] }) {
  return (
    <>
      <ScreenHeader
        kicker={dateLine}
        title={`Morning, ${name}`}
        right={
          <Pop lag={T.dataLag}>
            <Avatar initials={initials} tone="you" size={40} ring="rgba(255,255,255,0.16)" />
          </Pop>
        }
      />
      <Reveal delay={at(1)}>
        <WeekHero km={km} goal={goal} week={week} />
      </Reveal>
      <View style={s.tiles}>
        <Reveal delay={at(2)} style={s.flex}>
          <PaceTile />
        </Reveal>
        <Reveal delay={at(3)} style={s.flex}>
          <StreakTile days={12} />
        </Reveal>
      </View>
      <Reveal delay={at(4)}>
        <LastRun />
      </Reveal>
      <Reveal delay={at(5)}>
        <UpNext />
      </Reveal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

type SavedRoute = { name: string; km: number; climb: number; terrain: string; shape: Pt[]; elevation: number[] };

const SAVED_ROUTES: SavedRoute[] = [
  {
    name: "Canal to Victoria Park",
    km: 8.4,
    climb: 42,
    terrain: "Towpath",
    shape: [[4, 30], [12, 24], [16, 14], [26, 10], [34, 4]],
    elevation: [12, 14, 13, 18, 16, 21, 19, 24, 20, 22],
  },
  {
    name: "Hackney Marshes loop",
    km: 10.2,
    climb: 18,
    terrain: "Flat",
    shape: [[18, 32], [6, 24], [8, 10], [20, 4], [32, 12], [30, 26], [18, 32]],
    elevation: [10, 11, 10, 12, 11, 12, 10, 11, 12, 11],
  },
  {
    name: "Lea Valley out-and-back",
    km: 16.0,
    climb: 71,
    terrain: "Gravel",
    shape: [[6, 32], [10, 22], [18, 18], [22, 10], [32, 4]],
    elevation: [8, 12, 20, 26, 22, 30, 24, 18, 12, 9],
  },
  {
    name: "Clapton hill reps",
    km: 5.6,
    climb: 118,
    terrain: "Hills",
    shape: [[6, 30], [14, 8], [20, 28], [26, 8], [32, 28]],
    elevation: [6, 26, 8, 27, 7, 26, 8, 27, 7, 18],
  },
];

const MARSHES_LOOP: Pt[] = [
  [70, 100], [58, 72], [88, 54], [124, 44], [156, 26], [200, 14], [248, 16],
  [282, 40], [276, 74], [240, 90], [180, 100], [130, 108], [96, 110], [74, 104],
];

function FeaturedRoute() {
  const stats: { value: number; format: (n: number) => string; label: string }[] = [
    { value: 10.2, format: (n) => n.toFixed(1), label: "km" },
    { value: 18, format: (n) => String(Math.round(n)), label: "m climb" },
    { value: 52, format: (n) => `~${Math.round(n)}`, label: "min at 5:05" },
  ];
  return (
    <Press label="Featured route: Hackney Marshes loop, 10.2 kilometres, flat" style={s.pressCard} scaleTo={0.98}>
      <Card pad={0}>
        <RunMap route={MARSHES_LOOP} height={196} layout="marshes" />
        <LinearGradient colors={["rgba(16,16,16,0)", "rgba(16,16,16,0.8)", "#101010"]} locations={[0, 0.55, 1]} style={s.mapFade} />
        <View style={s.featuredBody}>
          <Eyebrow color={INK.sub}>FEATURED · RIVERSIDE · LIT AFTER DARK</Eyebrow>
          <Text style={s.cardTitle}>Hackney Marshes loop</Text>
          <View style={s.featuredStats}>
            {stats.map((st) => (
              <View key={st.label}>
                <CountUp value={st.value} format={st.format} style={s.statVal} />
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>
    </Press>
  );
}

const THUMB = 40;
const ELEV_W = 76;
const ELEV_W_NARROW = 52; // below 380pt the chart gives the route name room
const NARROW = 380;
const ELEV_H = 28;

function RouteRow({ route, first }: { route: SavedRoute; first: boolean }) {
  const { width } = useWindowDimensions();
  const shape = useMemo(() => ({ d: smoothPath(route.shape), length: strokeLength(route.shape) }), [route.shape]);
  return (
    <Press label={`${route.name}, ${route.km} kilometres, ${route.climb} metres climb`} style={[s.listRow, !first && s.listDivider]} scaleTo={0.985}>
      <View style={s.thumb}>
        <Svg width={THUMB} height={THUMB} viewBox="0 0 36 36" aria-hidden>
          <Stroke d={shape.d} length={shape.length} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={s.flex}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {route.name}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {route.km.toFixed(1)} km · {route.climb} m climb · {route.terrain}
        </Text>
      </View>
      <Sparkline values={route.elevation} width={width < NARROW ? ELEV_W_NARROW : ELEV_W} height={ELEV_H} lag={T.dataLag + 60} dot={false} strokeWidth={1.5} />
    </Press>
  );
}

function RoutesScreen() {
  return (
    <>
      <ScreenHeader kicker="NEAR HACKNEY · 14 SAVED" title="Routes" />
      <Reveal delay={at(1)}>
        <FeaturedRoute />
      </Reveal>
      <Reveal delay={at(2)} style={s.sectionLabel}>
        <Eyebrow>SAVED NEARBY</Eyebrow>
      </Reveal>
      {/* The list's card arrives first, then its rows follow it in. */}
      <Reveal delay={at(3)}>
        <Card pad={0}>
          {SAVED_ROUTES.map((r, i) => (
            <Reveal key={r.name} delay={at(3) + (i + 1) * T.rowStagger}>
              <RouteRow route={r} first={i === 0} />
            </Reveal>
          ))}
        </Card>
      </Reveal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Club                                                                */
/* ------------------------------------------------------------------ */

type Runner = { name: string; initials: string; km: number; tone: AvatarTone; you?: boolean };

const LEADERS: Runner[] = [
  { name: "Tomás Reyes", initials: "TR", km: 48.2, tone: "mid" },
  { name: "Ife Okonjo", initials: "IO", km: 41.0, tone: "light" },
  { name: "You", initials: "AD", km: 32.4, tone: "you", you: true },
  { name: "Mira Kowalczyk", initials: "MK", km: 29.7, tone: "dark" },
  { name: "Jonah Pratt", initials: "JP", km: 24.1, tone: "mid" },
];
const LEADER_SCALE = 50; // km at a full bar

function ClubGoal() {
  const done = 1846;
  const goal = 2500;
  return (
    <Card>
      <View style={s.rowBetween}>
        <Eyebrow>OCTOBER CLUB GOAL</Eyebrow>
        <Text style={s.statLabel}>22 days left</Text>
      </View>
      <View style={s.tileNumRow}>
        <CountUp value={done} format={grouped} style={s.bigNum} />
        <Text style={s.tileUnit}>/ {grouped(goal)} km</Text>
      </View>
      <Fill pct={done / goal} color="#FFFFFF" height={6} />
      <Text style={[s.cardSub, s.mt10]}>38 Harriers chipping in. Another 15 km each gets us there.</Text>
    </Card>
  );
}

function Kudos() {
  return (
    <Card>
      <View style={s.rowBetween}>
        <Eyebrow>NEW KUDOS</Eyebrow>
        <AvatarStack
          lag={T.dataLag}
          people={[
            { initials: "IO", tone: "light" },
            { initials: "MK", tone: "dark" },
            { initials: "JP", tone: "mid" },
          ]}
        />
      </View>
      <Text style={[s.cardTitle, s.mt8]}>Ife and 2 others liked your tempo</Text>
      <Text style={[s.cardSub, s.mt6]}>“4:52s in that wind? Sharp.” — Ife</Text>
    </Card>
  );
}

function LeaderRow({ runner, rank }: { runner: Runner; rank: number }) {
  return (
    <View style={[s.leadRow, runner.you && s.leadYou]} accessibilityLabel={`${rank}. ${runner.name}, ${runner.km.toFixed(1)} kilometres`}>
      <Text style={[s.leadRank, runner.you && s.textStrong]}>{rank}</Text>
      <Avatar initials={runner.initials} tone={runner.tone} size={30} ring="rgba(255,255,255,0.1)" />
      <View style={s.leadBody}>
        <Text style={[s.rowTitle, runner.you && s.textStrong]}>{runner.name}</Text>
        <View style={s.mt6}>
          <Fill pct={runner.km / LEADER_SCALE} color={runner.you ? "#FFFFFF" : "rgba(255,255,255,0.3)"} />
        </View>
      </View>
      <CountUp value={runner.km} format={(v) => v.toFixed(1)} style={s.leadKm} />
    </View>
  );
}

function ClubScreen({ youKm, initials }: { youKm: number; initials: string }) {
  const rows = LEADERS.map((l) => (l.you ? { ...l, km: youKm, initials } : l)).sort((a, b) => b.km - a.km);
  return (
    <>
      <ScreenHeader kicker="HACKNEY HARRIERS · WEEK 41" title="Club" />
      <Reveal delay={at(1)}>
        <ClubGoal />
      </Reveal>
      <Reveal delay={at(2)}>
        <Kudos />
      </Reveal>
      <Reveal delay={at(3)}>
        <Card pad={0}>
          <View style={s.boardHead}>
            <Eyebrow>THIS WEEK’S DISTANCE</Eyebrow>
          </View>
          {rows.map((r, i) => (
            <Reveal key={r.name} delay={at(3) + (i + 1) * T.rowStagger}>
              <LeaderRow runner={r} rank={i + 1} />
            </Reveal>
          ))}
          <View style={s.boardFoot} />
        </Card>
      </Reveal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* You                                                                 */
/* ------------------------------------------------------------------ */

const YOU_RING = 84;
const YOU_RING_R = 39;

function ProfileHeader({ name, initials, yearKm, yearGoal }: { name: string; initials: string; yearKm: number; yearGoal: number }) {
  const accent = useContext(Accent);
  const pct = Math.min(yearKm / yearGoal, 1);
  return (
    <View style={s.profile}>
      <View style={s.youRing}>
        <View style={StyleSheet.absoluteFill}>
          <Svg width={YOU_RING} height={YOU_RING} aria-hidden>
            <Circle cx={YOU_RING / 2} cy={YOU_RING / 2} r={YOU_RING_R} stroke={INK.track} strokeWidth={3} fill="none" />
            <Stroke
              d={ringPath(YOU_RING / 2, YOU_RING / 2, YOU_RING_R)}
              length={2 * Math.PI * YOU_RING_R}
              progress={pct}
              stroke={accent}
              strokeWidth={3}
              strokeLinecap="round"
              duration={T.draw + 120}
            />
          </Svg>
        </View>
        <Avatar initials={initials} tone="you" size={66} ring="transparent" />
        <Pop lag={T.dataLag + T.draw} style={s.youBadge}>
          <Text style={s.youBadgeText}>{Math.round(pct * 100)}%</Text>
        </Pop>
      </View>
      <View style={s.profileText}>
        <Text style={s.h2}>{name}</Text>
        <Text style={s.cardSub}>
          {grouped(yearKm)} of {grouped(yearGoal)} km this year
        </Text>
        <Text style={[s.statLabel, s.mt4]}>Running since March 2024</Text>
      </View>
    </View>
  );
}

function YearStats() {
  const stats: { value: number; format: (n: number) => string; label: string }[] = [
    { value: 1284, format: grouped, label: "km" },
    { value: 142, format: (n) => String(Math.round(n)), label: "runs" },
    { value: 118, format: (n) => `${Math.round(n)} h`, label: "moving" },
  ];
  return (
    <Card pad={0} style={s.yearStats}>
      {stats.map((st, i) => (
        <View key={st.label} style={[s.yearStat, i > 0 && s.yearStatDivider]}>
          <CountUp value={st.value} format={st.format} style={s.tileNum} />
          <Text style={s.statLabel}>{st.label}</Text>
        </View>
      ))}
    </Card>
  );
}

type PersonalBest = { distance: string; seconds?: number; when: string };

const RECORDS: PersonalBest[] = [
  { distance: "5K", seconds: 1308, when: "Mar 2026" },
  { distance: "10K", seconds: 2712, when: "Jun 2026" },
  { distance: "Half", seconds: 6090, when: "Sep 2026" },
  { distance: "Marathon", when: "Brighton, April?" },
];

function RecordTile({ record }: { record: PersonalBest }) {
  return (
    <Card style={s.prTile} pad={16}>
      <Eyebrow>{record.distance.toUpperCase()}</Eyebrow>
      {record.seconds ? (
        <CountUp value={record.seconds} format={clock} style={[s.tileNum, s.mt8]} />
      ) : (
        <Text style={[s.tileNum, s.mt8, s.textFaint]}>—</Text>
      )}
      <Text style={s.tileFoot}>{record.when}</Text>
    </Card>
  );
}

function Shoes() {
  const worn = 412;
  const life = 650;
  return (
    <Card>
      <View style={s.rowBetween}>
        <Eyebrow>SHOES · FIELD TRAINER 3</Eyebrow>
        <View style={s.row}>
          <CountUp value={worn} format={(v) => String(Math.round(v))} style={s.statLabel} />
          <Text style={s.statLabel}> / {life} km</Text>
        </View>
      </View>
      <View style={s.mt14}>
        <Fill pct={worn / life} color="#FFFFFF" height={8} />
      </View>
      <Text style={[s.cardSub, s.mt10]}>Good for about six more weeks. We’ll nag you.</Text>
    </Card>
  );
}

function YouScreen({ name, initials }: { name: string; initials: string }) {
  return (
    <>
      <Reveal delay={0}>
        <ProfileHeader name={name} initials={initials} yearKm={1284} yearGoal={1500} />
      </Reveal>
      <Reveal delay={at(1)}>
        <YearStats />
      </Reveal>
      <Reveal delay={at(2)} style={s.sectionLabel}>
        <Eyebrow>PERSONAL BESTS</Eyebrow>
      </Reveal>
      <View style={s.prGrid}>
        {RECORDS.map((r, i) => (
          <Reveal key={r.distance} delay={at(2) + (i + 1) * T.rowStagger} style={s.prCell}>
            <RecordTile record={r} />
          </Reveal>
        ))}
      </View>
      <Reveal delay={at(5)}>
        <Shoes />
      </Reveal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Badge: digits roll, one tick of overshoot on arrival                 */
/* ------------------------------------------------------------------ */

const BADGE_ROLL = 11;

function Badge({ count }: { count: number }) {
  const reduce = useReduce();
  const [pair, setPair] = useState({ prev: count, curr: count });
  const roll = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const last = useRef(count);

  useEffect(() => {
    const prev = last.current;
    if (prev === count) return;
    last.current = count;
    setPair({ prev, curr: count });
    if (reduce) {
      roll.setValue(1);
      scale.setValue(count > 0 ? 1 : 0);
      return;
    }
    roll.setValue(0);
    const pop =
      count === 0
        ? Animated.timing(scale, { toValue: 0, duration: 200, easing: EASE_IN, useNativeDriver: true })
        : prev === 0
          ? Animated.spring(scale, { toValue: 1, stiffness: 520, damping: 22, useNativeDriver: true })
          : Animated.sequence([
              Animated.timing(scale, { toValue: 1.22, duration: 110, easing: EASE_OUT, useNativeDriver: true }),
              Animated.spring(scale, { toValue: 1, stiffness: 520, damping: 26, useNativeDriver: true }),
            ]);
    Animated.parallel([Animated.timing(roll, { toValue: 1, duration: 280, easing: EASE_OUT, useNativeDriver: true }), pop]).start();
  }, [count, reduce, roll, scale]);

  const dir = pair.curr >= pair.prev ? 1 : -1;
  const rolling = pair.curr > 0 && pair.prev > 0 && pair.prev !== pair.curr;
  const motion = useMemo(
    () => ({
      outOpacity: roll.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" }),
      outY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -BADGE_ROLL * dir] }),
      inY: roll.interpolate({ inputRange: [0, 1], outputRange: [BADGE_ROLL * dir, 0] }),
    }),
    [roll, dir],
  );
  const fmt = (n: number) => (n > 9 ? "9+" : String(n));

  return (
    <Animated.View style={[s.badge, s.inert, { transform: [{ scale }] }]}>
      <LinearGradient colors={["#FFFFFF", "#E2E2E2"]} style={StyleSheet.absoluteFill} />
      <View style={s.badgeClip}>
        {rolling && (
          <Animated.Text style={[s.badgeText, s.badgeAbs, { opacity: motion.outOpacity, transform: [{ translateY: motion.outY }] }]}>{fmt(pair.prev)}</Animated.Text>
        )}
        <Animated.Text style={[s.badgeText, rolling && { opacity: roll, transform: [{ translateY: motion.inY }] }]}>
          {fmt(pair.curr > 0 ? pair.curr : pair.prev)}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Tab button: outline icon morphs into a filled one                   */
/* ------------------------------------------------------------------ */

const ICON = 26;

function TabButton({ tab, selected, badge, onPress }: { tab: TabItem; selected: boolean; badge: number; onPress: () => void }) {
  const reduce = useReduce();
  const accent = useContext(Accent);
  const sel = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const sheen = useSvgId("tabSheen");

  useEffect(() => {
    if (reduce) {
      Animated.timing(sel, { toValue: selected ? 1 : 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    // Selecting pops once (a single overshoot); deselecting settles flat.
    Animated.spring(sel, {
      toValue: selected ? 1 : 0,
      stiffness: selected ? 360 : 500,
      damping: selected ? 18 : 44,
      useNativeDriver: true,
    }).start();
  }, [selected, reduce, sel]);

  const springPress = (toValue: number, held: boolean) =>
    Animated.spring(press, { toValue, stiffness: held ? 700 : 420, damping: held ? 40 : 20, useNativeDriver: true }).start();

  const morph = useMemo(
    () => ({
      outline: {
        opacity: sel.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" }),
        transform: [{ scale: sel.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) }],
      },
      filled: {
        opacity: sel.interpolate({ inputRange: [0.15, 0.7], outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ scale: sel.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
      },
      lift: sel.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }),
    }),
    [sel],
  );

  const icon = TAB_ICON[tab.key];
  const label = badge > 0 ? `${tab.label}, ${badge} new` : tab.label;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduce && springPress(0.9, true)}
      onPressOut={() => springPress(1, false)}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={s.tab}
    >
      <Animated.View style={[s.tabInner, { transform: [{ scale: press }, { translateY: morph.lift }] }]}>
        <View style={s.iconBox}>
          <Animated.View style={[StyleSheet.absoluteFill, morph.outline]}>
            <Svg width={ICON} height={ICON} viewBox="0 0 24 24" aria-hidden>
              {icon.outline("rgba(245,245,245,0.66)")}
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, morph.filled]}>
            <Svg width={ICON} height={ICON} viewBox="0 0 24 24" aria-hidden>
              <Defs>
                <SvgGradient id={sheen} x1="0.2" y1="0" x2="0.6" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
                  <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
                </SvgGradient>
              </Defs>
              {icon.filled(accent)}
              {icon.filled(`url(#${sheen})`)}
            </Svg>
          </Animated.View>
          <Badge count={badge} />
        </View>
        <View style={s.labelBox}>
          <Animated.Text style={[s.tabLabel, { opacity: morph.outline.opacity }]}>{tab.label}</Animated.Text>
          <Animated.Text style={[s.tabLabel, s.tabLabelOn, { opacity: morph.filled.opacity }]}>{tab.label}</Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* The glass bar and its lens                                          */
/* ------------------------------------------------------------------ */

/** Tabs fill slots 0, 1, 3 and 4; slot 2 belongs to the centre action. */
const slotOf = (tabs: TabItem[], key: TabKey) => {
  const i = tabs.findIndex((t) => t.key === key);
  return i < 2 ? i : i + 1;
};

function GlassBar({
  tabs,
  active,
  badges,
  rise,
  onSelect,
}: {
  tabs: TabItem[];
  active: TabKey;
  badges: Record<string, number>;
  rise: Animated.Value;
  onSelect: (key: TabKey) => void;
}) {
  const reduce = useReduce();
  const [barW, setBarW] = useState(0);
  const lensL = useRef(new Animated.Value(0)).current;
  const lensR = useRef(new Animated.Value(0)).current;
  const prevSlot = useRef(slotOf(tabs, active));
  const placed = useRef(false);
  const slot = barW / 5;

  useEffect(() => {
    if (!barW) return;
    const to = slotOf(tabs, active);
    const l = to * slot + LENS_INSET;
    const r = (to + 1) * slot - LENS_INSET;
    if (!placed.current || reduce) {
      placed.current = true;
      prevSlot.current = to;
      lensL.setValue(l);
      lensR.setValue(r);
      return;
    }
    const goingRight = to > prevSlot.current;
    prevSlot.current = to;
    // The leading edge is stiff, the trailing edge lags: the lens stretches toward
    // where it is going, then catches up. Both are critically damped, so no wobble.
    const lead = { stiffness: 520, damping: 46 };
    const trail = { stiffness: 210, damping: 29 };
    Animated.parallel([
      Animated.spring(lensL, { toValue: l, ...(goingRight ? trail : lead), useNativeDriver: false }),
      Animated.spring(lensR, { toValue: r, ...(goingRight ? lead : trail), useNativeDriver: false }),
    ]).start();
  }, [active, barW, slot, reduce, tabs, lensL, lensR]);

  const lens = useMemo(() => {
    const base = Math.max(slot - LENS_INSET * 2, 1);
    const width = Animated.subtract(lensR, lensL);
    const squash = width.interpolate({ inputRange: [base, base * 2.5], outputRange: [1, 0.86], extrapolate: "clamp" });
    return { width, squash };
  }, [lensL, lensR, slot]);

  const button = (t: TabItem) => <TabButton key={t.key} tab={t} selected={active === t.key} badge={badges[t.key] ?? 0} onPress={() => onSelect(t.key)} />;

  return (
    <Animated.View style={[s.barShadow, { transform: [{ translateY: rise }] }]} accessibilityRole="tablist">
      <View style={s.bar} onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}>
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Grain opacity={0.05} />
        {/* hairline: bright on top, fading down the sides */}
        <View style={s.hairline} />

        {barW > 0 && (
          <Animated.View style={[s.lens, { left: lensL, width: lens.width, transform: [{ scaleY: lens.squash }] }]}>
            <LinearGradient colors={["rgba(255,255,255,0.17)", "rgba(255,255,255,0.07)"]} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}

        <View style={s.tabsRow}>
          {tabs.slice(0, 2).map(button)}
          <View style={s.tab} />
          {tabs.slice(2, 4).map(button)}
        </View>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Centre action and its arc of quick actions                          */
/* ------------------------------------------------------------------ */

function CentreAction({ open, menu, rise, onToggle }: { open: boolean; menu: Animated.Value; rise: Animated.Value; onToggle: () => void }) {
  const reduce = useReduce();
  const accent = useContext(Accent);
  const press = useRef(new Animated.Value(0)).current;
  const springPress = (toValue: number, held: boolean) =>
    Animated.spring(press, { toValue, stiffness: held ? 700 : 420, damping: held ? 40 : 18, useNativeDriver: true }).start();

  const motion = useMemo(
    () => ({
      glow: {
        opacity: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
        transform: [
          { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
          { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
        ],
      },
      disc: {
        transform: [
          { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 2.5] }) },
          { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
        ],
      },
      plus: { transform: [{ rotate: menu.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "135deg"] }) }] },
      whitePlus: { opacity: menu.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: "clamp" }) },
    }),
    [press, menu],
  );

  return (
    <Animated.View style={[s.fabWrap, { transform: [{ translateY: rise }] }]}>
      <Animated.View
        style={[s.fabGlow, { boxShadow: `0 14px 30px ${withAlpha(accent, 0.5)}, 0 8px 16px rgba(0,0,0,0.35)` }, motion.glow]}
      />
      <Pressable
        onPress={onToggle}
        onPressIn={() => !reduce && springPress(1, true)}
        onPressOut={() => springPress(0, false)}
        accessibilityRole="button"
        accessibilityLabel={open ? "Close quick actions" : "Start an activity"}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <Animated.View style={[s.fab, { backgroundColor: accent }, motion.disc]}>
          {/* One accent, given depth by light: a top sheen and a shaded base. */}
          <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0)", "rgba(0,0,0,0.18)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: menu }]}>
            <LinearGradient colors={MILK} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Glow cx="50%" cy="8%" r="50%" color="#FFFFFF" opacity={0.4} />
          <Animated.View style={motion.plus}>
            <PlusGlyph color={INK.black} />
            <Animated.View style={[StyleSheet.absoluteFill, motion.whitePlus]}>
              <PlusGlyph color="#FFFFFF" />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function PlusGlyph({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function ArcMenu({ actions, items, open, onPick }: { actions: QuickAction[]; items: Animated.Value[]; open: boolean; onPick: (a: QuickAction) => void }) {
  const reduce = useReduce();
  const placed = useMemo(() => {
    // Fan the actions across the upper arc, from 150° on the left to 30° on the right.
    const angles = actions.length === 1 ? [90] : actions.map((_, i) => 150 - (i * 120) / (actions.length - 1));
    return actions.map((a, i) => {
      const rad = (angles[i] * Math.PI) / 180;
      const x = Math.cos(rad) * ARC_RADIUS;
      const y = -Math.sin(rad) * ARC_RADIUS;
      const v = items[i];
      return {
        action: a,
        style: {
          opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
          transform: [
            // Reduced motion: the items appear in place, opacity only.
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? x : 0, x] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? y : 0, y] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 1 : 0.35, 1] }) },
          ],
        },
      };
    });
  }, [actions, items, reduce]);

  return (
    <View style={[s.arc, { bottom: FAB_CENTRE }]}>
      {placed.map(({ action, style }) => (
        <Animated.View key={action.key} style={[s.arcItem, style, !open && s.inert]}>
          <Press label={action.label} onPress={() => onPick(action)} scaleTo={0.9} style={s.arcBtn}>
            <LinearGradient colors={MILK} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <ActionGlyph icon={action.icon} color={INK.black} />
          </Press>
          <Text style={s.arcLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

function Toast({ action, y }: { action: QuickAction | null; y: Animated.Value }) {
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[s.toastWrap, { transform: [{ translateY: y }] }]}>
      <View style={s.toast}>
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(40,40,40,0.55)", "rgba(22,22,22,0.7)"]} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0)"]} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
        <View style={s.toastIcon}>
          <LinearGradient colors={MILK} style={StyleSheet.absoluteFill} />
          {action && <ActionGlyph icon={action.icon} color={INK.black} size={17} />}
        </View>
        <View style={s.flex}>
          <Text style={s.toastTitle}>{action?.toast}</Text>
          <Text style={s.toastDetail} numberOfLines={1}>
            {action?.detail}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const KUDOS_EVERY = 6500; // ms between ambient kudos
const KUDOS_MAX = 3;
const CLUB_READ_AFTER = 650; // ms on Club before its badge clears
const TOAST_HIDDEN = -140;
const TOAST_FOR = 2800;

export function MobileTabBar({
  tabs = DEFAULT_TABS,
  initialTab = "today",
  runnerName = "Adaeze Okafor",
  dateLine = "THU 9 OCT · WEEK 41",
  goalKm = 40,
  week = DEFAULT_WEEK,
  actions = DEFAULT_ACTIONS,
  accent = DEFAULT_ACCENT,
  onTabChange,
  onAction,
}: MobileTabBarProps) {
  const reduce = useReducedMotionSetting();
  const firstName = runnerName.split(" ")[0];
  const initials = initialsOf(runnerName);

  const [active, setActive] = useState<TabKey>(initialTab);
  // `visit` re-keys the view, so even a quick there-and-back replays its entrance.
  const [view, setView] = useState({ tab: initialTab, visit: 0 });
  const [leaving, setLeaving] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>(() => Object.fromEntries(tabs.map((t) => [t.key, t.badge ?? 0])));
  const [km, setKm] = useState(() => week.reduce((sum, d) => sum + d.km, 0));
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<QuickAction | null>(null);

  const exit = useRef(new Animated.Value(1)).current;
  const pending = useRef<TabKey>(initialTab);
  const rise = useRef(new Animated.Value(36)).current;
  const menu = useRef(new Animated.Value(0)).current;
  const items = useRef(actions.map(() => new Animated.Value(0))).current;
  const toastY = useRef(new Animated.Value(TOAST_HIDDEN)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  /* entrance: the bar and its action rise into place */
  useEffect(() => {
    if (reduce) {
      rise.setValue(0);
      return;
    }
    return startNextFrame(() => Animated.spring(rise, { toValue: 0, stiffness: 260, damping: 28, delay: 120, useNativeDriver: true }));
  }, [rise, reduce]);

  /* ambient: a kudo arrives now and then while you're elsewhere */
  useEffect(() => {
    if (reduce) return;
    let sent = 0;
    const id = setInterval(() => {
      if (sent >= KUDOS_MAX || activeRef.current === "club") return;
      sent += 1;
      setBadges((b) => ({ ...b, club: Math.min((b.club ?? 0) + 1, 99) }));
    }, KUDOS_EVERY);
    return () => clearInterval(id);
  }, [reduce]);

  /* opening Club reads the kudos */
  useEffect(() => {
    if (active !== "club" || !badges.club) return;
    const t = setTimeout(() => setBadges((b) => ({ ...b, club: 0 })), CLUB_READ_AFTER);
    return () => clearTimeout(t);
  }, [active, badges.club]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const toggleMenu = (next: boolean) => {
    setOpen(next);
    if (reduce) {
      [menu, ...items].forEach((v) => Animated.timing(v, { toValue: next ? 1 : 0, duration: 120, useNativeDriver: true }).start());
      return;
    }
    if (next) {
      Animated.spring(menu, { toValue: 1, stiffness: 380, damping: 26, useNativeDriver: true }).start();
      Animated.stagger(50, items.map((v) => Animated.spring(v, { toValue: 1, stiffness: 400, damping: 25, useNativeDriver: true }))).start();
    } else {
      Animated.timing(menu, { toValue: 0, duration: 260, easing: EASE_IN_OUT, useNativeDriver: true }).start();
      Animated.stagger(30, [...items].reverse().map((v) => Animated.timing(v, { toValue: 0, duration: 170, easing: EASE_IN, useNativeDriver: true }))).start();
    }
  };

  /**
   * The old view leaves quickly (fade, lift, a little blur); the new one
   * mounts and its blocks choreograph themselves in. A second tap mid-exit
   * just retargets `pending`, so rapid switching never stacks animations.
   */
  const select = (key: TabKey) => {
    if (open) toggleMenu(false);
    if (key === active) return;
    setActive(key);
    onTabChange?.(key);
    pending.current = key;
    setLeaving(true);
    Animated.timing(exit, { toValue: 0, duration: reduce ? 60 : T.exit, easing: EASE_IN, useNativeDriver: !CAN_BLUR }).start(({ finished }) => {
      if (!finished) return;
      setView((v) => ({ tab: pending.current, visit: v.visit + 1 }));
      setLeaving(false);
      exit.setValue(1);
    });
  };

  const runAction = (a: QuickAction) => {
    toggleMenu(false);
    onAction?.(a.key);
    if (a.addKm) setKm((k) => k + (a.addKm ?? 0));
    setToast(a);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastY.stopAnimation();
    Animated.spring(toastY, { toValue: 0, stiffness: 340, damping: 30, delay: 120, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastY, { toValue: TOAST_HIDDEN, duration: 240, easing: EASE_IN, useNativeDriver: true }).start();
    }, TOAST_FOR);
  };

  const motion = useMemo(
    () => ({
      recede: { transform: [{ scale: menu.interpolate({ inputRange: [0, 1], outputRange: [1, reduce ? 1 : 0.965] }) }] },
      leave: {
        opacity: exit,
        transform: [{ translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 0 : -6, 0] }) }],
        ...(CAN_BLUR && !reduce ? { filter: exit.interpolate({ inputRange: [0, 1], outputRange: ["blur(4px)", "blur(0px)"] }) } : null),
      },
    }),
    [menu, exit, reduce],
  );

  const screen = (() => {
    switch (view.tab) {
      case "routes":
        return <RoutesScreen />;
      case "club":
        return <ClubScreen youKm={km} initials={initials} />;
      case "you":
        return <YouScreen name={runnerName} initials={initials} />;
      default:
        return <TodayScreen name={firstName} initials={initials} dateLine={dateLine} km={km} goal={goalKm} week={week} />;
    }
  })();

  return (
    <ReducedMotion.Provider value={reduce}>
      <Accent.Provider value={accent}>
        <View style={s.root}>
          {/* a faint neutral light at the top of the stage */}
          <View style={s.stageGlow}>
            <Glow cx="85%" cy="0%" r="70%" color="#FFFFFF" opacity={0.06} />
          </View>

          <Animated.View style={[StyleSheet.absoluteFill, motion.recede]}>
            <Animated.View style={[StyleSheet.absoluteFill, leaving && motion.leave]}>
              <ScrollView key={`${view.tab}-${view.visit}`} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {screen}
              </ScrollView>
            </Animated.View>
          </Animated.View>

          <GlassBar tabs={tabs} active={active} badges={badges} rise={rise} onSelect={select} />

          {/* scrim: darkens the content and lets a little of the accent bloom from the button */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: menu }, !open && s.inert]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleMenu(false)} accessibilityRole="button" accessibilityLabel="Close quick actions">
              <LinearGradient colors={["rgba(10,10,10,0.42)", "rgba(10,10,10,0.78)", "rgba(10,10,10,0.94)"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
              <View style={s.scrimGlow}>
                <Glow cx="50%" cy="100%" r="60%" color={accent} opacity={0.16} />
              </View>
            </Pressable>
          </Animated.View>

          <ArcMenu actions={actions} items={items} open={open} onPick={runAction} />
          <CentreAction open={open} menu={menu} rise={rise} onToggle={() => toggleMenu(!open)} />
          <Toast action={toast} y={toastY} />
        </View>
      </Accent.Provider>
    </ReducedMotion.Provider>
  );
}

export default function MobileTabBarDemo() {
  return <MobileTabBar />;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK.bg, overflow: "hidden" },
  /** Decoration and motion layers never take touches. */
  inert: { pointerEvents: "none" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none" },
  stageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 360, pointerEvents: "none" },
  scroll: { paddingTop: 58, paddingHorizontal: 16, paddingBottom: 150, gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  textStrong: { color: INK.text, fontWeight: "700" },
  textFaint: { color: INK.faint },

  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4, marginBottom: 6 },
  kicker: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, color: INK.faint, marginBottom: 6 },
  h1: { fontSize: 32, fontWeight: "700", letterSpacing: -1, color: INK.text },
  h2: { fontSize: 26, fontWeight: "700", letterSpacing: -0.8, color: INK.text },
  sectionLabel: { paddingHorizontal: 4, marginTop: 8, marginBottom: -2 },

  eyebrow: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.3, fontWeight: "600" },

  card: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 30px rgba(0,0,0,0.4)",
  },
  cardBody: { padding: 18, paddingBottom: 14 },
  pressCard: { borderRadius: 24 },
  cardTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: INK.text, marginTop: 6 },
  cardSub: { fontSize: 14, color: INK.sub, letterSpacing: -0.1 },
  chevron: { width: 16, height: 16 },

  hero: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 20,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroNumRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  heroNum: { fontSize: 58, fontWeight: "700", letterSpacing: -2.4, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  heroUnit: { fontSize: 20, fontWeight: "600", color: INK.sub, marginLeft: 6 },
  heroSub: { fontSize: 14, color: INK.sub, marginTop: 2, fontVariant: ["tabular-nums"] },
  ringWrap: { width: RING, height: RING },
  ringPct: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", fontVariant: ["tabular-nums"], letterSpacing: -0.4 },
  days: { flexDirection: "row", marginTop: 18, gap: 8 },
  dayCol: { flex: 1, alignItems: "center" },
  dayTrack: { height: BAR_TRACK, width: "100%", justifyContent: "flex-end" },
  dayBar: { width: "64%", alignSelf: "center", borderRadius: 5 },
  dayDone: { backgroundColor: "rgba(255,255,255,0.3)" },
  dayPlanned: { height: BAR_MIN, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderStyle: "dashed" },
  dayLabel: { fontFamily: MONO, fontSize: 10.5, color: INK.faint, marginTop: 6, fontWeight: "600" },
  dayLabelToday: { color: "#FFFFFF", fontWeight: "800" },

  tiles: { flexDirection: "row", gap: 12 },
  tileNumRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8, marginBottom: 8 },
  tileNum: { fontSize: 28, fontWeight: "700", letterSpacing: -1, color: INK.text, fontVariant: ["tabular-nums"] },
  bigNum: { fontSize: 34, fontWeight: "700", letterSpacing: -1.2, color: INK.text, fontVariant: ["tabular-nums"] },
  tileUnit: { fontSize: 13, color: INK.sub, marginLeft: 4, fontWeight: "600" },
  tileFoot: { fontSize: 12, color: INK.faint, marginTop: 8 },
  streakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 34, paddingBottom: 2 },
  streakSlot: { width: 6, height: STREAK_BAR, borderRadius: 3, backgroundColor: INK.track, justifyContent: "flex-end", overflow: "hidden" },
  streakBar: { width: 6, borderRadius: 3 },
  streakNow: { backgroundColor: "#FFFFFF", boxShadow: "0 0 10px rgba(255,255,255,0.55)" },

  avatar: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarText: { fontWeight: "800", letterSpacing: -0.2 },

  statRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  statVal: { fontSize: 17, fontWeight: "700", color: INK.text, fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
  statLabel: { fontSize: 12, color: INK.faint, marginTop: 2, fontVariant: ["tabular-nums"] },
  mapWrap: { height: MAP_H, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: INK.hairline },
  mapFade: { position: "absolute", left: 0, right: 0, top: 70, height: 126, pointerEvents: "none" },

  featuredBody: { paddingHorizontal: 18, paddingBottom: 18, marginTop: -54 },
  featuredStats: { flexDirection: "row", gap: 28, marginTop: 12 },

  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: INK.hairline },
  thumb: {
    width: THUMB + 8,
    height: THUMB + 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rowTitle: { fontSize: 15.5, fontWeight: "600", color: INK.text, letterSpacing: -0.2 },
  rowSub: { fontSize: 12.5, color: INK.sub, marginTop: 3, fontVariant: ["tabular-nums"] },

  fillTrack: { width: "100%", backgroundColor: INK.track, overflow: "hidden" },
  fillBar: { height: "100%" },

  boardHead: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  boardFoot: { height: 8 },
  leadRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 10 },
  leadYou: { backgroundColor: "rgba(255,255,255,0.05)" },
  leadRank: { width: 22, fontFamily: MONO, fontSize: 12, color: INK.faint },
  leadBody: { flex: 1, marginLeft: 12 },
  leadKm: { width: 52, textAlign: "right", fontSize: 15, fontWeight: "700", color: INK.text, fontVariant: ["tabular-nums"] },

  profile: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, marginBottom: 6 },
  profileText: { flex: 1, marginLeft: 16 },
  youRing: { width: YOU_RING, height: YOU_RING, alignItems: "center", justifyContent: "center" },
  youBadge: {
    position: "absolute",
    bottom: -6,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: INK.bg,
  },
  youBadgeText: { fontSize: 10.5, fontWeight: "800", color: INK.black, fontVariant: ["tabular-nums"] },
  yearStats: { flexDirection: "row" },
  yearStat: { flex: 1, paddingVertical: 14, paddingHorizontal: 16 },
  yearStatDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: INK.hairline },
  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  prCell: { width: "47.5%", flexGrow: 1 },
  prTile: { flex: 1 },

  /* bar */
  barShadow: {
    position: "absolute",
    left: BAR_SIDE,
    right: BAR_SIDE,
    bottom: BAR_BOTTOM,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    boxShadow: "0 18px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)",
  },
  bar: { flex: 1, borderRadius: BAR_H / 2, overflow: "hidden" },
  hairline: {
    position: "absolute",
    pointerEvents: "none",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BAR_H / 2,
    borderWidth: 1,
    borderTopColor: "rgba(255,255,255,0.26)",
    borderLeftColor: "rgba(255,255,255,0.1)",
    borderRightColor: "rgba(255,255,255,0.1)",
    borderBottomColor: "rgba(255,255,255,0.05)",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12)",
  },
  lens: {
    position: "absolute",
    pointerEvents: "none",
    top: 7,
    bottom: 7,
    borderRadius: 27,
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.04), 0 4px 14px rgba(0,0,0,0.25)",
  },
  tabsRow: { flex: 1, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabInner: { alignItems: "center", justifyContent: "center", paddingTop: 2 },
  iconBox: { width: ICON, height: ICON },
  labelBox: { height: 14, marginTop: 3, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.1, color: "rgba(245,245,245,0.6)" },
  tabLabelOn: { position: "absolute", color: "#FFFFFF", fontWeight: "700" },

  badge: {
    position: "absolute",
    top: -5,
    left: 15,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9)",
  },
  badgeClip: { height: 18, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800", color: INK.black, fontVariant: ["tabular-nums"], lineHeight: 18 },
  badgeAbs: { position: "absolute" },

  fabWrap: { pointerEvents: "box-none", position: "absolute", left: 0, right: 0, bottom: FAB_CENTRE - FAB / 2, alignItems: "center" },
  fabGlow: { pointerEvents: "none", position: "absolute", top: 8, width: FAB - 6, height: FAB - 6, borderRadius: FAB },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.22)",
  },

  scrimGlow: { position: "absolute", left: 0, right: 0, bottom: 0, height: 420 },
  arc: { pointerEvents: "box-none", position: "absolute", left: 0, right: 0, height: 0, alignItems: "center" },
  arcItem: { position: "absolute", top: -29, width: 110, marginLeft: -55, left: "50%", alignItems: "center" },
  arcBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 26px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.08)",
  },
  arcLabel: { marginTop: 8, fontSize: 12.5, fontWeight: "600", color: "#FFFFFF", letterSpacing: -0.1 },

  toastWrap: { pointerEvents: "none", position: "absolute", top: 52, left: 16, right: 16 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingRight: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 16px 34px rgba(0,0,0,0.45)",
  },
  toastIcon: { width: 30, height: 30, borderRadius: 15, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  toastTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.2 },
  toastDetail: { fontSize: 12.5, color: "rgba(255,255,255,0.68)", marginTop: 1 },
});
