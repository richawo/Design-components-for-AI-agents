import { Component, createRef, memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
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

const DEFAULT_DAYS: HealthDay[] = [
  {
    letter: "M", dateLabel: "Monday, 5 October", values: [418, 22, 10], steps: 6204, distanceKm: 4.6,
    hourly: [0, 0, 0, 0, 0, 0, 40, 620, 880, 210, 160, 300, 540, 420, 180, 160, 240, 690, 820, 300, 140, 60, 20, 0],
    restingHr: 61, hrRange: [54, 131], sleep: { deep: 64, core: 212, rem: 88, awake: 21 }, bedtime: "23:40", wake: "06:05",
  },
  {
    letter: "T", dateLabel: "Tuesday, 6 October", values: [589, 41, 12], steps: 11873, distanceKm: 8.9,
    hourly: [0, 0, 0, 0, 0, 0, 120, 2400, 1900, 260, 210, 340, 880, 520, 230, 200, 310, 980, 1400, 1250, 480, 260, 90, 0],
    restingHr: 58, hrRange: [51, 162], sleep: { deep: 82, core: 226, rem: 104, awake: 14 }, bedtime: "22:58", wake: "06:04",
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
    restingHr: 59, hrRange: [52, 148], sleep: { deep: 78, core: 238, rem: 96, awake: 22 }, bedtime: "23:12", wake: "06:41",
  },
  {
    letter: "S", dateLabel: "Saturday, 10 October", future: true, values: [0, 0, 0], steps: 0, distanceKm: 0, hourly: [],
    restingHr: 0, hrRange: [0, 0], sleep: { deep: 0, core: 0, rem: 0, awake: 0 }, bedtime: "", wake: "",
  },
  {
    letter: "S", dateLabel: "Sunday, 11 October", future: true, values: [0, 0, 0], steps: 0, distanceKm: 0, hourly: [],
    restingHr: 0, hrRange: [0, 0], sleep: { deep: 0, core: 0, rem: 0, awake: 0 }, bedtime: "", wake: "",
  },
];

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const BG = ["#0B0C12", "#0E1018", "#08090D"] as const;
const INK = "#F4F5F8";
const SUB = "rgba(235,238,245,0.56)";
const FAINT = "rgba(235,238,245,0.34)";
const SLEEP_COLORS: Record<keyof SleepStages, string> = { deep: "#4B57E6", core: "#4C94FF", rem: "#6FE2DD", awake: "#FFB27A" };
const SLEEP_ORDER: (keyof SleepStages)[] = ["deep", "core", "rem", "awake"];
const SLEEP_LABEL: Record<keyof SleepStages, string> = { deep: "Deep", core: "Core", rem: "REM", awake: "Awake" };

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const TABULAR = { fontVariant: ["tabular-nums" as const] };
// On the web a mouse drag would otherwise select text.
const noSelect = (Platform.OS === "web" ? { userSelect: "none" } : {}) as ViewStyle;

const RING_BOX = 264;
const RING_STROKE = 22;
const RING_GAP = 3;
const RING_PAD = 6;
const ringRadius = (i: number) => RING_BOX / 2 - RING_PAD - RING_STROKE / 2 - i * (RING_STROKE + RING_GAP);

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
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

const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, "0")}m`;

/** Tweens a number on the JS thread and returns the current frame's value. */
function useTween(target: number, duration = 700, reduce = false, delay = 0) {
  const anim = useRef(new Animated.Value(target)).current;
  const [value, setValue] = useState(target);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setValue(v));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    if (reduce) {
      anim.stopAnimation();
      anim.setValue(target);
      return;
    }
    const a = Animated.timing(anim, { toValue: target, duration, delay, easing: EASE_IN_OUT, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [anim, target, duration, reduce, delay]);
  return value;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
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

type SquishProps = Omit<PressableProps, "style"> & { to?: number; style?: StyleProp<ViewStyle> };

/** A Pressable that springs down while held and back, with a little lift, on release. */
function Squish({ to = 0.97, style, onPressIn, onPressOut, ...rest }: SquishProps) {
  const reduce = useReducedMotion();
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
    Animated.timing(t, { toValue: 0, duration: 110, easing: EASE_IN, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setShown({ id, children: latest.current });
      Animated.timing(t, { toValue: 1, duration: 240, easing: EASE_OUT, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, children]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });
  return <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>{shown.children}</Animated.View>;
}

/** Hairline glass: real backdrop blur, a faint inner gradient and a top edge brighter than the bottom. */
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/**
 * Hairline glass: real backdrop blur, a faint inner gradient and a top edge
 * brighter than the bottom. `fade` is applied to each layer rather than to a
 * wrapper: on the web an ancestor with opacity < 1 cuts the blur off from
 * what's behind it, so the frost would pop in at the end of a fade.
 */
function Glass({
  children,
  style,
  radius = 24,
  fade,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  fade?: Animated.Value | Animated.AnimatedInterpolation<number>;
}) {
  const o = fade ?? 1;
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden", boxShadow: "0 18px 40px -18px rgba(0,0,0,0.7)" }, style]}>
      <AnimatedBlurView intensity={42} tint="dark" style={[StyleSheet.absoluteFill, { opacity: o }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: o }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.085)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0.015)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={{ opacity: o }}>{children}</Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: o,
            borderRadius: radius,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.055)",
            borderTopColor: "rgba(255,255,255,0.17)",
          },
        ]}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Background: low-contrast gradient, soft glows and a fine dither      */
/* ------------------------------------------------------------------ */

function Backdrop({ uid }: { uid: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...BG]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${uid}-g1`} cx="18%" cy="26%" rx="70%" ry="38%">
            <Stop offset="0" stopColor="#FF3D6E" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#FF3D6E" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${uid}-g2`} cx="96%" cy="44%" rx="60%" ry="34%">
            <Stop offset="0" stopColor="#1FD2F4" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#1FD2F4" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${uid}-g3`} cx="8%" cy="86%" rx="62%" ry="30%">
            <Stop offset="0" stopColor="#4C94FF" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#4C94FF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${uid}-g4`} cx="88%" cy="76%" rx="54%" ry="26%">
            <Stop offset="0" stopColor="#FF8B52" stopOpacity={0.16} />
            <Stop offset="1" stopColor="#FF8B52" stopOpacity={0} />
          </RadialGradient>
          <Pattern id={`${uid}-dither`} width="4" height="4" patternUnits="userSpaceOnUse">
            <Rect x="0" y="0" width="1" height="1" fill="#FFFFFF" fillOpacity={0.05} />
            <Rect x="2" y="2" width="1" height="1" fill="#FFFFFF" fillOpacity={0.03} />
            <Rect x="3" y="0" width="1" height="1" fill="#000000" fillOpacity={0.12} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${uid}-g1)`} />
        <Rect width="100%" height="100%" fill={`url(#${uid}-g2)`} />
        <Rect width="100%" height="100%" fill={`url(#${uid}-g3)`} />
        <Rect width="100%" height="100%" fill={`url(#${uid}-g4)`} />
        <Rect width="100%" height="100%" fill={`url(#${uid}-dither)`} />
      </Svg>
    </View>
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
        fill={color}
        fillOpacity={0.22}
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
/* Rings                                                                */
/* ------------------------------------------------------------------ */

/** A full circle starting at 12 o'clock, so a dash offset reads as progress. */
const circlePath = (c: number, r: number) => `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r}`;
const rightHalf = (c: number, r: number) => `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r}`;
const leftHalf = (c: number, r: number) => `M ${c} ${c + r} A ${r} ${r} 0 0 1 ${c} ${c - r}`;

/**
 * One lap of a ring. SVG has no conic gradient, so each half of the circle
 * gets a vertical gradient (top→bottom on the right, bottom→top on the left),
 * which reads as a sweep. A dashed copy of the circle masks it to progress.
 */
function RingLap({
  uid,
  index,
  colors,
  progress,
  lap,
}: {
  uid: string;
  index: number;
  colors: [string, string];
  progress: Animated.Value;
  lap: 0 | 1;
}) {
  const c = RING_BOX / 2;
  const r = ringRadius(index);
  const len = 2 * Math.PI * r;
  const mid = mix(colors[0], colors[1], 0.5);
  const id = `${uid}-r${index}-l${lap}`;
  const offset = progress.interpolate({ inputRange: [lap, lap + 1], outputRange: [len, 0], extrapolate: "clamp" });
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

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

const alpha = (hex: string, a: number) => {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
};

/** The end cap: a solid dot riding the tip, glowing in its colour and casting a shadow forward. */
/** The colour of a lap's two-half gradient at a given progress (0..1), matching RingLap exactly. */
function lapColourAt(colors: [string, string], p: number) {
  const mid = mix(colors[0], colors[1], 0.5);
  const cos = Math.cos(p * Math.PI * 2);
  return p <= 0.5 ? mix(colors[0], mid, (1 - cos) / 2) : mix(mid, colors[1], (1 + cos) / 2);
}

function tipColour(progress: Animated.Value, colors: [string, string], lap: number) {
  const steps = 24;
  const inputRange = Array.from({ length: steps + 1 }, (_, k) => lap + k / steps);
  return progress.interpolate({
    inputRange,
    outputRange: inputRange.map((_, k) => lapColourAt(colors, k / steps)),
    extrapolate: "clamp",
  });
}

/** The end cap: a dot riding the tip in the arc's own colour, casting a soft shadow forward. */
function RingTip({ index, ring, progress }: { index: number; ring: HealthRing; progress: Animated.Value }) {
  const r = ringRadius(index);
  const rotate = progress.interpolate({ inputRange: [0, 4], outputRange: ["0deg", "1440deg"] });
  const first = progress.interpolate({ inputRange: [0, 0.015, 0.999, 1.001], outputRange: [0, 1, 1, 0], extrapolate: "clamp" });
  const second = progress.interpolate({ inputRange: [0.999, 1.001], outputRange: [0, 1], extrapolate: "clamp" });
  const dot: ViewStyle = {
    position: "absolute",
    left: RING_BOX / 2 - RING_STROKE / 2,
    top: RING_BOX / 2 - r - RING_STROKE / 2,
    width: RING_STROKE,
    height: RING_STROKE,
    borderRadius: RING_STROKE / 2,
  };
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
      <Animated.View
        style={[
          dot,
          {
            opacity: first,
            backgroundColor: tipColour(progress, ring.colors, 0),
            boxShadow: `2px 0 6px rgba(0,0,0,0.28), 0 0 14px ${alpha(ring.colors[1], 0.55)}`,
          },
        ]}
      />
      <Animated.View
        style={[
          dot,
          {
            opacity: second,
            backgroundColor: tipColour(progress, ring.lapColors, 1),
            boxShadow: `3px 0 7px rgba(0,0,0,0.6), 0 0 16px ${alpha(ring.colors[1], 0.45)}`,
          },
        ]}
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
  const r = ringRadius(index);
  const opacity = dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.1] });
  const scale = dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });
  const visible = progress.interpolate({ inputRange: [0, 0.004], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, transform: [{ scale }] }]}>
      <Svg width={RING_BOX} height={RING_BOX} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={ring.colors[0]} strokeOpacity={0.16} strokeWidth={RING_STROKE} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: visible }]}>
        <Svg width={RING_BOX} height={RING_BOX} style={StyleSheet.absoluteFill}>
          <RingLap uid={uid} index={index} colors={ring.colors} progress={progress} lap={0} />
          <RingLap uid={uid} index={index} colors={ring.lapColors} progress={progress} lap={1} />
        </Svg>
        <RingTip index={index} ring={ring} progress={progress} />
      </Animated.View>
    </Animated.View>
  );
});

/** Three tiny static rings for the week selector. */
const MiniRings = memo(function MiniRings({ rings, values, future }: { rings: HealthRing[]; values: number[]; future?: boolean }) {
  const s = 30;
  const sw = 3.4;
  const c = s / 2;
  return (
    <Svg width={s} height={s}>
      {rings.map((ring, i) => {
        const r = c - sw / 2 - 0.5 - i * (sw + 1);
        const len = 2 * Math.PI * r;
        const p = future ? 0 : Math.min(values[i] / ring.goal, 1);
        return (
          <G key={ring.key}>
            <Circle cx={c} cy={c} r={r} stroke={ring.colors[0]} strokeOpacity={future ? 0.1 : 0.2} strokeWidth={sw} fill="none" />
            {p > 0 ? (
              <Path
                d={circlePath(c, r)}
                stroke={ring.colors[0]}
                strokeWidth={sw}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${len * p} ${len}`}
              />
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
});

/* ------------------------------------------------------------------ */
/* Cards                                                                */
/* ------------------------------------------------------------------ */

/** Catmull-Rom → cubic Bézier, plus an approximate length for the draw-in dash. */
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return { d: "", length: 0 };
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    let prev = p1;
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const u = 1 - t;
      const x = u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0];
      const y = u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1];
      length += Math.hypot(x - prev[0], y - prev[1]);
      prev = [x, y];
    }
  }
  return { d, length };
}

const Sparkline = memo(function Sparkline({ uid, hourly, width, height, reduce }: { uid: string; hourly: number[]; width: number; height: number; reduce: boolean }) {
  const draw = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const max = Math.max(1200, ...hourly);
  const pts = hourly.map((v, i) => [3 + (i / 23) * (width - 6), height - 3 - (Math.sqrt(v / max) * (height - 8))] as [number, number]);
  const { d, length } = smoothPath(pts);
  const last = pts[pts.length - 1];
  const area = last ? `${d} L ${last[0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z` : "";
  const key = hourly.join(",");
  useEffect(() => {
    if (reduce) {
      draw.setValue(1);
      return;
    }
    draw.setValue(0);
    const a = Animated.timing(draw, { toValue: 1, duration: 900, delay: 260, easing: EASE_OUT, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [key, reduce, draw]);
  const offset = draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });
  const fill = draw.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] });
  const dot = draw.interpolate({ inputRange: [0, 0.92, 1], outputRange: [0, 0, 1] });
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={`${uid}-sf`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF8B52" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#FF8B52" stopOpacity={0} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${uid}-ss`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FF3D6E" />
            <Stop offset="1" stopColor="#FFB27A" />
          </SvgLinearGradient>
        </Defs>
        {[0.33, 0.66].map((f) => (
          <Path key={f} d={`M 0 ${height * f} H ${width}`} stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="2 3" />
        ))}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fill }]}>
        <Svg width={width} height={height}>
          <Path d={area} fill={`url(#${uid}-sf)`} />
        </Svg>
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <AnimatedPath
          d={d}
          stroke={`url(#${uid}-ss)`}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={offset}
        />
      </Svg>
      {last ? (
        <Animated.View
          style={{
            position: "absolute",
            left: last[0] - 4,
            top: last[1] - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#FFD2B0",
            opacity: dot,
            boxShadow: "0 0 0 3px rgba(255,139,82,0.25), 0 0 12px rgba(255,139,82,0.8)",
          }}
        />
      ) : null}
    </View>
  );
});

/** One heartbeat: flat, a small P wave, the QRS spike, then the T wave. */
function ecgPath(width: number, height: number, beats: number) {
  const mid = height * 0.6;
  const w = width / beats;
  let d = `M 0 ${mid}`;
  for (let b = 0; b < beats; b++) {
    const x = b * w;
    const p = (f: number) => (x + w * f).toFixed(1);
    d +=
      ` L ${p(0.18)} ${mid}` +
      ` Q ${p(0.24)} ${mid - height * 0.12} ${p(0.3)} ${mid}` +
      ` L ${p(0.38)} ${mid} L ${p(0.42)} ${mid + height * 0.12}` +
      ` L ${p(0.48)} ${(height * 0.04).toFixed(1)} L ${p(0.54)} ${height - 2} L ${p(0.58)} ${mid}` +
      ` L ${p(0.68)} ${mid} Q ${p(0.76)} ${mid - height * 0.2} ${p(0.84)} ${mid} L ${p(1)} ${mid}`;
  }
  return d;
}

const BeatLine = memo(function BeatLine({ width, height, bpm, reduce }: { width: number; height: number; bpm: number; reduce: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  const beats = 2;
  const d = useMemo(() => ecgPath(width, height, beats), [width, height]);
  // The polyline is mostly flat; its length is close to width plus the spikes.
  const length = width + height * 3.4 * beats;
  const comet = 46;
  useEffect(() => {
    if (reduce || bpm <= 0) {
      t.setValue(0.5);
      return;
    }
    const period = (60000 / bpm) * beats;
    t.setValue(0);
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [bpm, reduce, t]);
  const offset = t.interpolate({ inputRange: [0, 1], outputRange: [comet, -length] });
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="mhs-beat-fade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF3D6E" stopOpacity={0} />
          <Stop offset="0.15" stopColor="#FF3D6E" stopOpacity={1} />
          <Stop offset="0.85" stopColor="#FF3D6E" stopOpacity={1} />
          <Stop offset="1" stopColor="#FF3D6E" stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      <Path d={d} stroke="url(#mhs-beat-fade)" strokeOpacity={0.24} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
      <AnimatedPath
        d={d}
        stroke="#FF6A8C"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={reduce ? undefined : `${comet} ${length + comet}`}
        strokeDashoffset={reduce ? undefined : offset}
      />
    </Svg>
  );
});

function CardLabel({ icon, label, color }: { icon: ReactNode; label: string; color: string }) {
  return (
    <View style={styles.cardLabel}>
      {icon}
      <Text style={[styles.cardLabelText, { color }]}>{label}</Text>
    </View>
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
  onDayChange,
  onRingSelect,
}: MobileHealthSummaryProps) {
  const reduce = useReducedMotion();
  const uid = "mhs";
  const firstDay = initialDay ?? Math.max(0, days.reduce((acc, d, i) => (d.future ? acc : i), 0));
  const [dayIndex, setDayIndex] = useState(firstDay);
  const [focus, setFocus] = useState<number | null>(null);
  const day = days[dayIndex];

  /* ring progress (0..n laps) and per-ring dimming */
  const progress = useRef(rings.map(() => new Animated.Value(0))).current;
  const dims = useRef(rings.map(() => new Animated.Value(0))).current;
  const glows = useRef(rings.map(() => new Animated.Value(0))).current;
  const mounted = useRef(false);

  useEffect(() => {
    const targets = rings.map((ring, i) => Math.min(day.values[i] / ring.goal, 3.99));
    if (reduce) {
      progress.forEach((p, i) => p.setValue(targets[i]));
      return;
    }
    const first = !mounted.current;
    mounted.current = true;
    const anim = Animated.stagger(
      first ? 140 : 70,
      progress.map((p, i) =>
        Animated.timing(p, {
          toValue: targets[i],
          duration: first ? 1250 + targets[i] * 250 : 820,
          easing: first ? EASE_OUT : EASE_IN_OUT,
          useNativeDriver: false,
        }),
      ),
    );
    const timer = setTimeout(() => anim.start(), first ? 280 : 0);
    return () => {
      clearTimeout(timer);
      anim.stop();
    };
  }, [day, rings, progress, reduce]);

  useEffect(() => {
    dims.forEach((v, i) => {
      const to = focus === null || focus === i ? 0 : 1;
      if (reduce) v.setValue(to);
      else Animated.spring(v, { toValue: to, stiffness: 300, damping: 34, mass: 1, useNativeDriver: true }).start();
    });
    glows.forEach((v, i) => {
      const to = focus === i ? 1 : 0;
      if (reduce) v.setValue(to);
      else Animated.timing(v, { toValue: to, duration: 420, easing: EASE_OUT, useNativeDriver: true }).start();
    });
  }, [focus, dims, glows, reduce]);

  const selectRing = (i: number | null) => {
    const next = i === focus ? null : i;
    setFocus(next);
    onRingSelect?.(next === null ? null : rings[next].key);
  };

  /* hit-test the concentric rings from the touch point */
  // Read the touch point on press-in: by the time onPress fires, some platforms
  // (react-native-web) can no longer resolve it relative to the ring box.
  const touchPoint = useRef<{ x: number; y: number } | null>(null);
  const onRingPressIn = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    touchPoint.current = Number.isFinite(locationX) && Number.isFinite(locationY) ? { x: locationX, y: locationY } : null;
  };
  const onRingPress = () => {
    const pt = touchPoint.current;
    if (!pt) {
      // keyboard or assistive activation: step through the rings
      selectRing(focus === null ? 0 : focus + 1 < rings.length ? focus + 1 : null);
      return;
    }
    touchPoint.current = null;
    const dist = Math.hypot(pt.x - RING_BOX / 2, pt.y - RING_BOX / 2);
    const hit = rings.findIndex((_, i) => Math.abs(dist - ringRadius(i)) <= (RING_STROKE + RING_GAP) / 2);
    selectRing(hit === -1 ? null : hit);
  };

  /* week selector */
  const [weekW, setWeekW] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const itemW = weekW / days.length;
  useEffect(() => {
    if (!itemW) return;
    if (reduce) pillX.setValue(dayIndex * itemW);
    else Animated.spring(pillX, { toValue: dayIndex * itemW, stiffness: 500, damping: 40, mass: 1, useNativeDriver: true }).start();
  }, [dayIndex, itemW, pillX, reduce]);
  const pillPlaced = useRef(false);
  const onWeekLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWeekW(w);
    if (!pillPlaced.current) {
      pillX.setValue((w / days.length) * dayIndex);
      pillPlaced.current = true;
    }
  };
  const pickDay = (i: number) => {
    if (days[i].future || i === dayIndex) return;
    setDayIndex(i);
    onDayChange?.(i, days[i]);
  };

  /* entrance */
  const enter = useRef([0, 1, 2, 3].map(() => new Animated.Value(reduce ? 1 : 0))).current;
  useEffect(() => {
    if (reduce) {
      enter.forEach((v) => v.setValue(1));
      return;
    }
    Animated.stagger(
      60,
      enter.map((v) => Animated.timing(v, { toValue: 1, duration: 620, easing: EASE_OUT, useNativeDriver: true })),
    ).start();
  }, [enter, reduce]);
  // Glass sections only slide; their layers fade themselves (see Glass).
  const slide = (i: number) => ({
    transform: [{ translateY: enter[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  });
  const rise = (i: number) => ({
    opacity: enter[i],
    transform: [{ translateY: enter[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  });

  /* centre readout */
  const closed = rings.filter((ring, i) => day.values[i] >= ring.goal).length;
  const latestDay = days.reduce((acc, d, i) => (d.future ? acc : i), 0);
  const dayName = dayIndex === latestDay ? "TODAY" : day.dateLabel.split(",")[0].toUpperCase();
  const focused = focus === null ? null : rings[focus];
  const focusValue = focus === null ? closed : (day.values[focus] / rings[focus].goal) * 100;
  const shownCentre = useTween(focusValue, 640, reduce);
  const centreSub = (() => {
    if (focus === null || !focused) return closed === rings.length ? "all rings closed" : "rings closed";
    const diff = day.values[focus] - focused.goal;
    return diff >= 0 ? `+${group(diff)} ${focused.unit} over` : `${group(-diff)} ${focused.unit} to go`;
  })();

  /* card numbers */
  const steps = useTween(day.steps, 700, reduce);
  const km = useTween(day.distanceKm, 700, reduce);
  const rhr = useTween(day.restingHr, 700, reduce);
  const sleepTotal = day.sleep.deep + day.sleep.core + day.sleep.rem + day.sleep.awake;
  const asleep = useTween(sleepTotal - day.sleep.awake, 700, reduce);
  const legendVals = [useTween(day.values[0], 700, reduce), useTween(day.values[1], 700, reduce), useTween(day.values[2], 700, reduce)];

  /* sleep bar */
  const sleepFlex = useRef(SLEEP_ORDER.map((k) => new Animated.Value(day.sleep[k] || 1))).current;
  useEffect(() => {
    SLEEP_ORDER.forEach((k, i) => {
      const to = day.sleep[k] || 0.0001;
      if (reduce) sleepFlex[i].setValue(to);
      else Animated.timing(sleepFlex[i], { toValue: to, duration: 620, easing: EASE_IN_OUT, useNativeDriver: false }).start();
    });
  }, [day, sleepFlex, reduce]);
  const barIn = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) barIn.setValue(1);
    else Animated.timing(barIn, { toValue: 1, duration: 900, delay: 520, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [barIn, reduce]);

  const [cardW, setCardW] = useState(0);

  return (
    <View style={styles.root}>
      <Backdrop uid={uid} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* header */}
        <Animated.View style={[styles.header, rise(0)]}>
          <View style={{ flex: 1 }}>
            <Swap id={day.dateLabel} reduce={reduce}>
              <Text style={styles.date}>{day.dateLabel.toUpperCase()}</Text>
            </Swap>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <Squish to={0.92} accessibilityRole="button" accessibilityLabel="Profile" style={styles.avatarWrap}>
            <LinearGradient colors={["#FF3D6E", "#FF8B52", "#1FD2F4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </LinearGradient>
          </Squish>
        </Animated.View>

        {/* week selector */}
        <Animated.View style={slide(1)}>
          <Glass radius={22} style={styles.week} fade={enter[1]}>
            <View style={styles.weekInner} onLayout={onWeekLayout}>
              {itemW > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.pill, { width: itemW - 4, transform: [{ translateX: Animated.add(pillX, 2) }] }]}
                >
                  <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.07)"]} style={StyleSheet.absoluteFill} />
                </Animated.View>
              ) : null}
              {days.map((d, i) => {
                const selected = i === dayIndex;
                return (
                  <Squish
                    key={d.dateLabel}
                    to={0.9}
                    disabled={d.future}
                    onPress={() => pickDay(i)}
                    accessibilityRole="tab"
                    accessibilityLabel={d.dateLabel}
                    accessibilityState={{ selected, disabled: !!d.future }}
                    style={[styles.dayItem, d.future ? { opacity: 0.4 } : null]}
                  >
                    <Text style={[styles.dayLetter, { color: selected ? INK : SUB }]}>{d.letter}</Text>
                    <MiniRings rings={rings} values={d.values} future={d.future} />
                  </Squish>
                );
              })}
            </View>
          </Glass>
        </Animated.View>

        {/* rings */}
        <Animated.View style={[styles.ringStage, rise(2)]}>
          {rings.map((ring, i) => (
            <Animated.View key={ring.key} pointerEvents="none" style={[styles.ringGlow, { opacity: glows[i] }]}>
              <Svg width={RING_BOX + 120} height={RING_BOX + 120}>
                <Defs>
                  <RadialGradient id={`${uid}-glow-${i}`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0.5" stopColor={ring.colors[0]} stopOpacity={0} />
                    <Stop offset="0.68" stopColor={ring.colors[0]} stopOpacity={0.3} />
                    <Stop offset="1" stopColor={ring.colors[0]} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#${uid}-glow-${i})`} />
              </Svg>
            </Animated.View>
          ))}
          <Pressable
            onPressIn={onRingPressIn}
            onPress={onRingPress}
            accessibilityRole="button"
            accessibilityLabel={`Activity rings. ${rings.map((r, i) => `${r.label} ${day.values[i]} of ${r.goal} ${r.unit}`).join(". ")}`}
            accessibilityHint="Tap a ring to focus it"
            style={[styles.ringBox, noSelect]}
          >
            {rings.map((ring, i) => (
              <RingLayer key={ring.key} uid={uid} index={i} ring={ring} progress={progress[i]} dim={dims[i]} />
            ))}
            <View pointerEvents="none" style={styles.centre}>
              <Swap id={focused ? focused.key : dayName} reduce={reduce} style={{ alignItems: "center" }}>
                <Text style={[styles.centreLabel, { color: focused ? focused.colors[1] : SUB }]}>
                  {focused ? focused.label.toUpperCase() : dayName}
                </Text>
              </Swap>
              <Text style={[styles.centreValue, TABULAR]}>
                {Math.round(shownCentre)}
                <Text style={styles.centreSuffix}>{focused ? "%" : `/${rings.length}`}</Text>
              </Text>
              <Swap id={`${focused?.key ?? "all"}-${centreSub}`} reduce={reduce}>
                <Text style={styles.centreSub}>{centreSub}</Text>
              </Swap>
            </View>
          </Pressable>
        </Animated.View>

        {/* legend: doubles as accessible ring controls */}
        <Animated.View style={[styles.legend, rise(2)]}>
          {rings.map((ring, i) => {
            const active = focus === null || focus === i;
            return (
              <Squish
                key={ring.key}
                to={0.95}
                onPress={() => selectRing(i)}
                accessibilityRole="button"
                accessibilityLabel={`${ring.label}: ${day.values[i]} of ${ring.goal} ${ring.unit}`}
                accessibilityState={{ selected: focus === i }}
                style={[styles.legendItem, { opacity: active ? 1 : 0.38 }]}
              >
                <View style={styles.legendHead}>
                  <LinearGradient colors={ring.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.legendSwatch} />
                  <Text style={styles.legendLabel}>{ring.label}</Text>
                </View>
                <Text style={[styles.legendValue, TABULAR, { color: ring.colors[1] }]}>
                  {group(legendVals[i])}
                  <Text style={styles.legendGoal}>
                    /{ring.goal} {ring.unit.toUpperCase()}
                  </Text>
                </Text>
              </Squish>
            );
          })}
        </Animated.View>

        {/* metric cards */}
        <Animated.View style={[styles.row, slide(3)]}>
          <Glass style={{ flex: 1.18 }} fade={enter[3]}>
            <View style={styles.card} onLayout={(e) => setCardW(e.nativeEvent.layout.width)}>
              <CardLabel icon={<StepsIcon color="#FF8B52" />} label="Steps" color="#FFB27A" />
              <Text style={[styles.cardValue, TABULAR]}>{group(steps)}</Text>
              <Text style={[styles.cardSub, TABULAR]}>{km.toFixed(1)} km · goal 10,000</Text>
              {cardW > 0 ? <Sparkline uid={uid} hourly={day.hourly} width={cardW - 32} height={34} reduce={reduce} /> : <View style={{ height: 34 }} />}
            </View>
          </Glass>
          <Glass style={{ flex: 1 }} fade={enter[3]}>
            <View style={styles.card}>
              <CardLabel icon={<HeartIcon color="#FF6A8C" />} label="Heart" color="#FF8FA8" />
              <Text style={[styles.cardValue, TABULAR]}>
                {Math.round(rhr)}
                <Text style={styles.cardUnit}> bpm</Text>
              </Text>
              <Text style={[styles.cardSub, TABULAR]}>
                resting · {day.hrRange[0]}–{day.hrRange[1]}
              </Text>
              <View style={{ height: 34, justifyContent: "center", overflow: "hidden" }}>
                <BeatLine width={Math.max(60, cardW * 0.85 - 32)} height={30} bpm={day.restingHr} reduce={reduce} />
              </View>
            </View>
          </Glass>
        </Animated.View>

        <Animated.View style={slide(3)}>
          <Glass style={{ marginTop: 10 }} fade={enter[3]}>
            <View style={styles.card}>
              <View style={styles.sleepTop}>
                <View>
                  <CardLabel icon={<MoonIcon color="#7FA8FF" />} label="Sleep" color="#9DBBFF" />
                  <Text style={[styles.cardValue, TABULAR]}>{hm(asleep)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.sleepTimesLabel}>IN BED</Text>
                  <Text style={[styles.sleepTimes, TABULAR]}>
                    {day.bedtime} – {day.wake}
                  </Text>
                </View>
              </View>
              <Animated.View
                style={[styles.sleepBar, { opacity: barIn, transform: [{ scaleX: barIn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
                accessibilityLabel={SLEEP_ORDER.map((k) => `${SLEEP_LABEL[k]} ${hm(day.sleep[k])}`).join(", ")}
              >
                {SLEEP_ORDER.map((k, i) => (
                  <Animated.View
                    key={k}
                    style={{
                      flexGrow: sleepFlex[i],
                      flexBasis: 0,
                      height: 10,
                      borderRadius: 3,
                      marginRight: i < SLEEP_ORDER.length - 1 ? 2 : 0,
                      backgroundColor: SLEEP_COLORS[k],
                      boxShadow: `0 0 10px ${alpha(SLEEP_COLORS[k], 0.35)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}
                  />
                ))}
              </Animated.View>
              <View style={styles.sleepLegend}>
                {SLEEP_ORDER.map((k) => (
                  <View key={k} style={styles.sleepKey}>
                    <View style={styles.sleepKeyHead}>
                      <View style={[styles.sleepDot, { backgroundColor: SLEEP_COLORS[k] }]} />
                      <Text style={styles.sleepKeyLabel}>{SLEEP_LABEL[k]}</Text>
                    </View>
                    <Text style={[styles.sleepKeyValue, TABULAR]}>{hm(day.sleep[k]).replace(/^0h /, "")}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Glass>
        </Animated.View>
      </ScrollView>
      {/* status-bar and home-indicator scrims, so scrolled content dissolves instead of clipping */}
      <LinearGradient pointerEvents="none" colors={["rgba(11,12,18,0.92)", "rgba(11,12,18,0)"]} style={styles.scrimTop} />
      <LinearGradient pointerEvents="none" colors={["rgba(8,9,13,0)", "rgba(8,9,13,0.88)"]} style={styles.scrimBottom} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG[0], overflow: "hidden" },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 36 },
  scroll: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4, marginBottom: 14 },
  date: { color: SUB, fontSize: 12, fontWeight: "600", letterSpacing: 1.1, marginBottom: 4 },
  title: { color: INK, fontSize: 34, fontWeight: "700", letterSpacing: -1.1, lineHeight: 38 },
  avatarWrap: { marginBottom: 2 },
  avatarRing: { width: 40, height: 40, borderRadius: 20, padding: 1.5 },
  avatar: { flex: 1, borderRadius: 19, backgroundColor: "#161821", alignItems: "center", justifyContent: "center" },
  avatarText: { color: INK, fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  week: {},
  weekInner: { flexDirection: "row", paddingVertical: 4 },
  pill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderTopColor: "rgba(255,255,255,0.2)",
    boxShadow: "0 6px 16px -6px rgba(0,0,0,0.6)",
  },
  dayItem: { flex: 1, alignItems: "center", paddingTop: 7, paddingBottom: 7, gap: 4, minHeight: 60 },
  dayLetter: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  ringStage: { alignItems: "center", justifyContent: "center", marginTop: 14, height: RING_BOX },
  ringGlow: { position: "absolute", width: RING_BOX + 120, height: RING_BOX + 120 },
  ringBox: { width: RING_BOX, height: RING_BOX },
  centre: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  centreLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4 },
  centreValue: { color: INK, fontSize: 34, fontWeight: "700", letterSpacing: -1.2, lineHeight: 38, marginTop: 1 },
  centreSuffix: { color: FAINT, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  centreSub: { color: SUB, fontSize: 11, fontWeight: "500", marginTop: 1 },
  legend: { flexDirection: "row", marginTop: 12, marginBottom: 12, paddingHorizontal: 4 },
  legendItem: { flex: 1, paddingVertical: 4, minHeight: 44 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 4, borderRadius: 2 },
  legendLabel: { color: SUB, fontSize: 12, fontWeight: "600" },
  legendValue: { fontSize: 19, fontWeight: "700", letterSpacing: -0.5, marginTop: 3 },
  legendGoal: { color: FAINT, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  row: { flexDirection: "row", gap: 10 },
  card: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  cardLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardLabelText: { fontSize: 13, fontWeight: "600" },
  cardValue: { color: INK, fontSize: 26, fontWeight: "700", letterSpacing: -0.9, marginTop: 6, lineHeight: 30 },
  cardUnit: { color: FAINT, fontSize: 14, fontWeight: "600", letterSpacing: 0 },
  cardSub: { color: SUB, fontSize: 11.5, fontWeight: "500", marginTop: 2, marginBottom: 8 },
  sleepTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sleepTimesLabel: { color: FAINT, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  sleepTimes: { color: INK, fontSize: 14, fontWeight: "600", marginTop: 3, marginBottom: 3 },
  sleepBar: { flexDirection: "row", marginTop: 12, transformOrigin: "left" },
  sleepLegend: { flexDirection: "row", marginTop: 10 },
  sleepKey: { flex: 1 },
  sleepKeyHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  sleepDot: { width: 6, height: 6, borderRadius: 3 },
  sleepKeyLabel: { color: SUB, fontSize: 11, fontWeight: "600" },
  sleepKeyValue: { color: INK, fontSize: 13, fontWeight: "600", marginTop: 1 },
});

export default function MobileHealthSummaryDemo() {
  return <MobileHealthSummary />;
}
