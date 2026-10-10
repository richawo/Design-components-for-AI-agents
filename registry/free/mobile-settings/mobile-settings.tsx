import {
  Component,
  createContext,
  useCallback,
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
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
  type PathProps,
} from "react-native-svg";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Paper = "white" | "sepia" | "night";

export type SettingsTheme = "dark" | "light";

export type SettingsProfile = {
  name: string;
  email: string;
  plan: string;
  /** Shown in the plan pill, e.g. "renews 2 Mar". */
  renews: string;
  entries: number;
  streakDays: number;
  words: number;
};

export type SettingsState = {
  paper: Paper;
  textSize: number;
  reminder: boolean;
  reminderTime: string;
  weekdaysOnly: boolean;
  prompts: boolean;
  faceId: boolean;
  sync: boolean;
};

export type MobileSettingsProps = {
  /** Dark by default; the light variant is designed, not inverted. */
  theme?: SettingsTheme;
  /** The one colour: switches, the slider, the selected time and Done. */
  accent?: string;
  appName?: string;
  version?: string;
  profile?: SettingsProfile;
  initial?: Partial<SettingsState>;
  reminderTimes?: string[];
  /** Sample entry shown in the reading preview. */
  sample?: { date: string; text: string };
  /** Moves the reading paper whenever the value changes; the segmented control stays live. */
  paper?: Paper;
  /** Moves the text-size slider whenever the value changes (14 to 22 pt). */
  textSize?: number;
  /** Switches the daily reminder on or off whenever the value changes. */
  reminder?: boolean;
  onChange?: (state: SettingsState) => void;
  onDeleteAll?: () => void;
  onDone?: () => void;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#34C77B";

/**
 * React Native Web turns `dataSet` into the `data-demo` attribute the live demo
 * script finds its targets by; native ignores it. Plain `data-*` props are dropped.
 * The demo drags the text-size slider (data-demo="size-slider") on sepia
 * paper, picks white paper (data-demo="paper-white", also "paper-sepia" and
 * "paper-night"), then flips the daily reminder off and back on
 * (data-demo="reminder-toggle"; its time row is data-demo="reminder-time" and
 * the chips data-demo="time-0" to "time-3"). The
 * delete row (data-demo="delete-all", data-demo="delete-confirm" in the sheet)
 * stays below the fold, so the demo never scrolls.
 */
const demoTarget = (name: string): { dataSet: { demo: string } } => ({ dataSet: { demo: name } });

/**
 * One neutral family per theme. Every surface, tile and glyph is a grey;
 * the accent (a prop) and the semantic red are the only hues, apart from
 * the paper swatches, which depict real paper.
 */
type Palette = {
  scheme: SettingsTheme;
  bg: string;
  ink: string;
  sub: string;
  faint: string;
  sep: string;
  edge: string;
  card: readonly [string, string, string];
  cardShadow: string;
  press: string;
  track: string;
  tile: readonly [string, string];
  tileGlyph: string;
  tileShadow: string;
  segTrack: string;
  segThumb: readonly [string, string];
  segThumbShadow: string;
  chip: string;
  bubble: string;
  bubbleInk: string;
  avatar: readonly [string, string];
  avatarInk: string;
  ring: readonly [string, string];
  pill: string;
  glow: { color: string; opacity: number };
  grain: number;
  blurTint: "dark" | "light";
  navWash: readonly [string, string];
  sheetWash: readonly [string, string];
  sheetEdge: { top: string; side: string; bottom: string };
  grabber: string;
  scrim: string;
  red: string;
  redWash: readonly [string, string];
  previewEdge: string;
};

const THEMES: Record<SettingsTheme, Palette> = {
  dark: {
    scheme: "dark",
    bg: "#0A0A0A",
    ink: "#F5F5F5",
    sub: "rgba(245,245,245,0.6)",
    faint: "rgba(245,245,245,0.36)",
    sep: "rgba(255,255,255,0.08)",
    edge: "rgba(255,255,255,0.08)",
    card: ["#1A1A1A", "#151515", "#121212"],
    cardShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 30px rgba(0,0,0,0.45)",
    press: "rgba(255,255,255,0.06)",
    track: "rgba(255,255,255,0.16)",
    tile: ["#3B3B3B", "#262626"],
    tileGlyph: "#F2F2F2",
    tileShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 2px rgba(0,0,0,0.5)",
    segTrack: "rgba(255,255,255,0.07)",
    segThumb: ["#3E3E3E", "#2F2F2F"],
    segThumbShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 3px 8px rgba(0,0,0,0.4)",
    chip: "rgba(255,255,255,0.07)",
    bubble: "#F5F5F5",
    bubbleInk: "#0A0A0A",
    avatar: ["#F4F4F4", "#BDBDBD"],
    avatarInk: "#0A0A0A",
    ring: ["#FFFFFF", "rgba(255,255,255,0.28)"],
    pill: "rgba(255,255,255,0.08)",
    glow: { color: "#FFFFFF", opacity: 0.07 },
    grain: 0.035,
    blurTint: "dark",
    navWash: ["rgba(10,10,10,0.82)", "rgba(10,10,10,0.66)"],
    sheetWash: ["rgba(38,38,38,0.7)", "rgba(20,20,20,0.88)"],
    sheetEdge: { top: "rgba(255,255,255,0.2)", side: "rgba(255,255,255,0.08)", bottom: "rgba(255,255,255,0.03)" },
    grabber: "rgba(255,255,255,0.22)",
    scrim: "rgba(0,0,0,0.55)",
    red: "#E5484D",
    redWash: ["rgba(255,90,95,0.2)", "rgba(255,90,95,0.1)"],
    previewEdge: "rgba(255,255,255,0.1)",
  },
  light: {
    scheme: "light",
    bg: "#F2F2F2",
    ink: "#111111",
    sub: "#6B6B6B",
    faint: "#A3A3A3",
    sep: "rgba(0,0,0,0.08)",
    edge: "rgba(0,0,0,0.07)",
    card: ["#FFFFFF", "#FCFCFC", "#F9F9F9"],
    cardShadow: "inset 0 1px 0 #FFFFFF, 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
    press: "rgba(0,0,0,0.05)",
    track: "#E3E3E3",
    tile: ["#2E2E2E", "#141414"],
    tileGlyph: "#FFFFFF",
    tileShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.18)",
    segTrack: "rgba(0,0,0,0.06)",
    segThumb: ["#FFFFFF", "#FAFAFA"],
    segThumbShadow: "0 3px 8px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)",
    chip: "rgba(0,0,0,0.05)",
    bubble: "#111111",
    bubbleInk: "#FFFFFF",
    avatar: ["#2E2E2E", "#0F0F0F"],
    avatarInk: "#FFFFFF",
    ring: ["#111111", "rgba(17,17,17,0.24)"],
    pill: "rgba(0,0,0,0.05)",
    glow: { color: "#FFFFFF", opacity: 0.9 },
    grain: 0.03,
    blurTint: "light",
    navWash: ["rgba(242,242,242,0.84)", "rgba(242,242,242,0.66)"],
    sheetWash: ["rgba(255,255,255,0.66)", "rgba(248,248,248,0.9)"],
    sheetEdge: { top: "rgba(255,255,255,0.95)", side: "rgba(255,255,255,0.6)", bottom: "rgba(0,0,0,0.04)" },
    grabber: "rgba(0,0,0,0.18)",
    scrim: "rgba(0,0,0,0.3)",
    red: "#E5484D",
    redWash: ["#FFE5E5", "#FFD3D4"],
    previewEdge: "rgba(0,0,0,0.08)",
  },
};

/** Real paper colours: the preview depicts them, so they keep their hue. */
const PAPERS: Record<Paper, { label: string; bg: string; ink: string; meta: string }> = {
  white: { label: "White", bg: "#FFFFFF", ink: "#1C1C1C", meta: "#8C8C8C" },
  sepia: { label: "Sepia", bg: "#F5EAD7", ink: "#4A3A28", meta: "#9C8466" },
  night: { label: "Night", bg: "#1E1E1E", ink: "#E8E8E8", meta: "#8A8A8A" },
};
const PAPER_KEYS: Paper[] = ["white", "sepia", "night"];

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const STATUS_BAR = 54;
const NAV = 44;
const MIN_SIZE = 14;
const MAX_SIZE = 22;
/** Below this width the time chips take the whole row instead of the text column. */
const NARROW = 380;

/**
 * Entrance choreography. Sections arrive in reading order; their numbers
 * count, the avatar ring draws and the slider fills once the section lands.
 */
const T = {
  stagger: 55, // between sections
  reveal: 520, // a section's rise and unblur
  rise: 12, // pt
  blur: 8, // px of blur that clears
  dataLag: 150, // figures start this long after their section
  count: 680,
  draw: 720,
  fillLag: 260, // the slider waits for its section to land
  fill: 480,
  change: 640, // later changes (deleting entries) tween at this pace
  reduced: 150, // reduced motion: a short fade, nothing else
};

const at = (step: number) => step * T.stagger;

/** How far (pt) a below-the-fold section must scroll into view before it arrives. */
const REVEAL_MARGIN = 48;

/**
 * CSS `filter: blur()` renders on the web and on Android (RN 0.76+). iOS
 * ignores it, so there entrances run on the native driver and settle with a
 * 0.98 scale instead.
 */
const CAN_BLUR = Platform.OS !== "ios";

/** Room left past each end of a dashed stroke so its round cap hides. */
const DASH_PAD = 12;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_PROFILE: SettingsProfile = {
  name: "Inês Marlowe",
  email: "ines@marlowe.studio",
  plan: "Folio Plus",
  renews: "renews 2 Mar",
  entries: 412,
  streakDays: 38,
  words: 96210,
};

const DEFAULT_STATE: SettingsState = {
  paper: "sepia",
  textSize: 17,
  reminder: true,
  reminderTime: "8:30 pm",
  weekdaysOnly: false,
  prompts: true,
  faceId: true,
  sync: true,
};

const DEFAULT_TIMES = ["7:00 am", "12:30 pm", "8:30 pm", "10:00 pm"];

const DEFAULT_SAMPLE = {
  date: "Thursday, 9 October",
  text: "Rain on the tram windows all the way to Graça. Started the new notebook in the café with the blue tiles.",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** "#RRGGBB" → "rgba(r,g,b,a)" so shadows and washes can carry the accent. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Black or white, whichever reads better on the accent (WCAG relative luminance). */
function inkOn(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.179 ? "#0A0A0A" : "#FFFFFF";
}

const grouped = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const wordCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const whole = (n: number) => String(Math.round(n));

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** A circle as a path that starts at 12 o'clock and runs clockwise. */
function ringPath(cx: number, cy: number, r: number) {
  return `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}`;
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
/* Contexts and hooks                                                  */
/* ------------------------------------------------------------------ */

const ReducedMotion = createContext(false);
const useReduce = () => useContext(ReducedMotion);

type ThemeValue = { t: Palette; s: Styles; accent: string; onAccent: string };
const Theme = createContext<ThemeValue | null>(null);

function useTheme() {
  const theme = useContext(Theme);
  if (!theme) throw new Error("MobileSettings parts must render inside <MobileSettings>.");
  return theme;
}

/**
 * When the section a figure sits in starts arriving (ms after mount), so the
 * figure can wait for it to land. `null` while the section is still waiting
 * to be scrolled into view.
 */
const SectionClock = createContext<number | null>(0);

/** Lets below-the-fold sections hold their entrance until they scroll into view. */
type Viewport = { watch: (top: number, onEnter: (scrolled: boolean) => void) => () => void };
const ViewportContext = createContext<Viewport | null>(null);

function useViewport() {
  const frame = useRef({ scrollTop: 0, height: 0 });
  const watchers = useRef(new Set<() => void>()).current;
  const notify = useCallback(() => watchers.forEach((check) => check()), [watchers]);

  const viewport = useMemo<Viewport>(
    () => ({
      watch(top, onEnter) {
        const check = () => {
          const { scrollTop, height } = frame.current;
          if (!height || top + REVEAL_MARGIN > scrollTop + height) return;
          watchers.delete(check);
          onEnter(scrollTop > 0);
        };
        watchers.add(check);
        check();
        return () => {
          watchers.delete(check);
        };
      },
    }),
    [watchers],
  );

  const setScrollTop = useCallback(
    (y: number) => {
      frame.current.scrollTop = y;
      notify();
    },
    [notify],
  );
  const setHeight = useCallback(
    (h: number) => {
      frame.current.height = h;
      notify();
    },
    [notify],
  );
  return { viewport, setScrollTop, setHeight };
}

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
 * An Animated.Value that follows `target`. Its first run is the entrance: it
 * waits for its section, then starts at `from` after `lag`. Later changes
 * tween from wherever it is.
 */
function useFollow(target: number, lag: number, duration: number, from = 0) {
  const reduce = useReduce();
  const sectionStart = useContext(SectionClock);
  const value = useRef(new Animated.Value(reduce ? target : from)).current;
  const ran = useRef(false);
  const waiting = sectionStart === null;

  useEffect(() => {
    if (reduce) {
      value.setValue(target);
      ran.current = true;
      return;
    }
    if (waiting) return;
    const first = !ran.current;
    return startNextFrame(() => {
      // Marked here, not above: StrictMode's rehearsal run is cancelled before
      // this frame, and must not use up the entrance.
      ran.current = true;
      return Animated.timing(value, {
        toValue: target,
        duration: first ? duration : T.change,
        delay: first ? (sectionStart ?? 0) + lag : 0,
        easing: first ? EASE_OUT : EASE_IN_OUT,
        useNativeDriver: false,
      });
    });
    // The entrance timing is fixed once the section starts; only the target re-runs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce, waiting]);

  return value;
}

/** A spring press: scale while held, a little lift back on release. */
function usePressScale(to = 0.97) {
  const reduce = useReduce();
  const scale = useRef(new Animated.Value(1)).current;
  return useMemo(
    () => ({
      scale,
      onPressIn: () => !reduce && Animated.spring(scale, { toValue: to, stiffness: 700, damping: 40, useNativeDriver: true }).start(),
      onPressOut: () => Animated.spring(scale, { toValue: 1, stiffness: 420, damping: 20, useNativeDriver: true }).start(),
    }),
    [scale, to, reduce],
  );
}

function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, "");
}

/* ------------------------------------------------------------------ */
/* Animatable SVG path                                                 */
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
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/* ------------------------------------------------------------------ */
/* Choreography primitives                                             */
/* ------------------------------------------------------------------ */

type RevealProps = {
  delay: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Hold the entrance until the section scrolls into view (it plays at once if it already is). */
  waitForView?: boolean;
};

/**
 * A section that arrives: it fades, rises 12pt and its blur clears. Children
 * read its start time from SectionClock. At rest it drops the transform and
 * filter so nothing keeps a compositing layer it doesn't need.
 */
function Reveal({ delay, children, style, waitForView = false }: RevealProps) {
  const reduce = useReduce();
  const viewport = useContext(ViewportContext);
  const gated = waitForView && viewport !== null;
  const [start, setStart] = useState<number | null>(gated ? null : delay);
  const [top, setTop] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!viewport || top === null || start !== null) return;
    // On the first screen it keeps its place in the stagger; scrolled to, it arrives at once.
    return viewport.watch(top, (scrolled) => setStart(scrolled ? 0 : delay));
  }, [viewport, top, start, delay]);

  useEffect(() => {
    if (start === null) return;
    return startNextFrame(
      () =>
        Animated.timing(progress, {
          toValue: 1,
          duration: reduce ? T.reduced : T.reveal,
          delay: reduce ? 0 : start,
          easing: EASE_OUT,
          useNativeDriver: !CAN_BLUR,
        }),
      () => setSettled(true),
    );
  }, [progress, start, reduce]);

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

  const measure = gated ? (e: LayoutChangeEvent) => setTop(e.nativeEvent.layout.y) : undefined;

  return (
    <SectionClock.Provider value={start}>
      <Animated.View onLayout={measure} style={[style, !settled && look]}>
        {children}
      </Animated.View>
    </SectionClock.Provider>
  );
}

/**
 * A number that counts to its value: from zero on arrival, from its previous
 * value on change. Its blur clears and its opacity settles as it lands.
 */
function CountUp({ value, format, style, lag = T.dataLag }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; lag?: number }) {
  const reduce = useReduce();
  const sectionStart = useContext(SectionClock);
  const waiting = sectionStart === null;
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
      setShown(value);
      settle.setValue(1);
      setLanded(true);
      ran.current = true;
      return;
    }
    if (waiting) return;
    const first = !ran.current;
    setLanded(false);
    // A change only half-blurs: the number is already there, it just moves.
    settle.setValue(first ? 0 : 0.5);
    const timing = {
      duration: first ? T.count : T.change,
      delay: first ? (sectionStart ?? 0) + lag : 0,
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
  }, [value, reduce, waiting]);

  const look = useMemo(() => {
    const opacity = settle.interpolate({ inputRange: [0, 0.3], outputRange: [0.2, 1], extrapolate: "clamp" });
    if (!CAN_BLUR) return { opacity };
    return { opacity, filter: settle.interpolate({ inputRange: [0, 1], outputRange: ["blur(5px)", "blur(0px)"] }) };
  }, [settle]);

  return <Animated.Text style={[style, !landed && look]}>{format(shown)}</Animated.Text>;
}

/** Small things (the plan pill, the sync light) arrive last, with one small overshoot. */
function Pop({ lag, children, style }: { lag: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduce();
  const sectionStart = useContext(SectionClock);
  const waiting = sectionStart === null;
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    if (waiting) return;
    // Damping ratio ≈ 0.7: one visible overshoot of a few percent, then still.
    return startNextFrame(() => Animated.spring(v, { toValue: 1, stiffness: 400, damping: 28, delay: (sectionStart ?? 0) + lag, useNativeDriver: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, waiting]);

  const look = useMemo(
    () => ({
      opacity: v.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
    }),
    [v],
  );
  return <Animated.View style={[style, look]}>{children}</Animated.View>;
}

/** Text that crossfades with a small rise when its value changes. */
function SwapText({ children, style }: { children: string; style: StyleProp<TextStyle> }) {
  const reduce = useReduce();
  const [shown, setShown] = useState(children);
  const v = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (children === shown) return;
    if (reduce) {
      setShown(children);
      return;
    }
    let leaving = true;
    const out = Animated.timing(v, { toValue: 0, duration: 90, easing: EASE_IN, useNativeDriver: true });
    out.start(({ finished }) => {
      leaving = false;
      if (!finished) return;
      setShown(children);
      Animated.timing(v, { toValue: 1, duration: 220, easing: EASE_OUT, useNativeDriver: true }).start();
    });
    // Stopping a finished timing stops whatever drives the value now (the fade
    // back in), so only interrupt the exit while it is still running.
    return () => {
      if (leaving) out.stop();
    };
  }, [children, shown, reduce, v]);

  const look = useMemo(() => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }), [v]);
  return <Animated.Text style={[style, look]}>{shown}</Animated.Text>;
}

/* ------------------------------------------------------------------ */
/* Icons (24pt grid, 1.8 stroke, round caps) and tiles                 */
/* ------------------------------------------------------------------ */

type Glyph = "paper" | "text" | "bell" | "clock" | "quote" | "face" | "cloud" | "export" | "trash" | "restore" | "check";

const SW = { strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

const GLYPHS: Record<Glyph, (c: string) => ReactNode> = {
  paper: (c) => (
    <G>
      <Circle cx={12} cy={12} r={7.5} stroke={c} {...SW} />
      <Path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill={c} />
    </G>
  ),
  text: (c) => <Path d="M4 18 8.6 6h.8L14 18M5.6 14h7M15.5 18l2.8-7.4h.4L21.5 18M16.3 15.8h4.4" stroke={c} {...SW} />,
  bell: (c) => (
    <G>
      <Path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" stroke={c} {...SW} />
      <Path d="M10 20.2a2.2 2.2 0 0 0 4 0" stroke={c} {...SW} />
    </G>
  ),
  clock: (c) => (
    <G>
      <Circle cx={12} cy={12} r={7.8} stroke={c} {...SW} />
      <Path d="M12 7.8V12l2.8 1.8" stroke={c} {...SW} />
    </G>
  ),
  quote: (c) => <Path d="M10 7.5c-2.6.8-4.4 3-4.4 6v3.2h4.2v-4H7.6M18.4 7.5c-2.6.8-4.4 3-4.4 6v3.2h4.2v-4H16" stroke={c} {...SW} />,
  face: (c) => (
    <G>
      <Path d="M4.5 8.5v-2a2 2 0 0 1 2-2h2M15.5 4.5h2a2 2 0 0 1 2 2v2M19.5 15.5v2a2 2 0 0 1-2 2h-2M8.5 19.5h-2a2 2 0 0 1-2-2v-2" stroke={c} {...SW} />
      <Path d="M9 9.5v1.2M15 9.5v1.2M12 9.5v3.6h-.9M9.4 15.6a4 4 0 0 0 5.2 0" stroke={c} {...SW} />
    </G>
  ),
  cloud: (c) => <Path d="M7.5 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.4 3.3 3.3 0 0 1-.3 6.6z" stroke={c} {...SW} />,
  export: (c) => (
    <G>
      <Path d="M12 14.5V4.5M8.5 8 12 4.5 15.5 8" stroke={c} {...SW} />
      <Path d="M8 11H6.8A1.8 1.8 0 0 0 5 12.8v5.4A1.8 1.8 0 0 0 6.8 20h10.4a1.8 1.8 0 0 0 1.8-1.8v-5.4a1.8 1.8 0 0 0-1.8-1.8H16" stroke={c} {...SW} />
    </G>
  ),
  restore: (c) => (
    <G>
      <Path d="M5.2 12a6.8 6.8 0 1 0 2-4.8L5 9.4" stroke={c} {...SW} />
      <Path d="M5 5.2v4.2h4.2M12 8.6V12l2.4 1.6" stroke={c} {...SW} />
    </G>
  ),
  trash: (c) => (
    <G>
      <Path d="M5 7h14M10 4.5h4M7 7l.8 11.2A1.9 1.9 0 0 0 9.7 20h4.6a1.9 1.9 0 0 0 1.9-1.8L17 7" stroke={c} {...SW} />
      <Path d="M10.4 10.5v6M13.6 10.5v6" stroke={c} {...SW} />
    </G>
  ),
  check: (c) => <Path d="M5 12.5 10 17.5 19 7" stroke={c} {...SW} strokeWidth={2.4} />,
};

function GlyphIcon({ name, color, size = 18 }: { name: Glyph; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {GLYPHS[name](color)}
      </Svg>
    </View>
  );
}

/** A monochrome icon tile: graphite with a top sheen. Only the glyph may carry meaning in colour. */
function Tile({ name, glyphColor }: { name: Glyph; glyphColor?: string }) {
  const { t, s } = useTheme();
  return (
    <View style={s.tile}>
      <LinearGradient colors={t.tile} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.tileFill} />
      <LinearGradient colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0)"]} locations={[0, 0.55]} style={s.tileFill} />
      <GlyphIcon name={name} color={glyphColor ?? t.tileGlyph} />
    </View>
  );
}

function Chevron({ size = 14 }: { size?: number }) {
  const { t } = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <Path d="M9 5 16 12 9 19" stroke={t.faint} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

function RotChevron({ open }: { open: boolean }) {
  const reduce = useReduce();
  const { s } = useTheme();
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) v.setValue(open ? 1 : 0);
    else Animated.spring(v, { toValue: open ? 1 : 0, stiffness: 500, damping: 40, useNativeDriver: true }).start();
  }, [open, reduce, v]);
  const turn = useMemo(() => ({ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }), [v]);
  return (
    <Animated.View style={[s.chevronGap, turn]}>
      <Chevron />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

/** Dither: a 4pt grid of faint dots that keeps the stage gradient from banding. */
function Grain({ opacity }: { opacity: number }) {
  const { s } = useTheme();
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

/** The stage's light: one neutral glow from the top left, under the grain. */
function StageLight() {
  const { t, s } = useTheme();
  const id = useSvgId("stage");
  return (
    <View style={s.overlay}>
      <Svg width="100%" height="100%" aria-hidden>
        <Defs>
          <RadialGradient id={id} cx="0%" cy="0%" r="85%">
            <Stop offset="0" stopColor={t.glow.color} stopOpacity={t.glow.opacity} />
            <Stop offset="1" stopColor={t.glow.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Grain opacity={t.grain} />
    </View>
  );
}

function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t, s } = useTheme();
  return (
    <View style={[s.card, style]}>
      <LinearGradient colors={t.card} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

type GroupProps = { title?: string; footer?: string; delay: number; children: ReactNode };

/** A titled inset group that arrives as one section. */
function Group({ title, footer, delay, children }: GroupProps) {
  const { s } = useTheme();
  return (
    <Reveal delay={delay} waitForView style={s.groupWrap}>
      {title && <Text style={s.groupTitle}>{title}</Text>}
      <Card>{children}</Card>
      {footer && <SwapText style={s.groupFooter}>{footer}</SwapText>}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Row: a pressable list row whose highlight fades in fast and out slow */
/* ------------------------------------------------------------------ */

type RowTone = "default" | "destructive" | "accent";

type RowProps = {
  icon: Glyph;
  title: string;
  tone?: RowTone;
  subtitle?: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  first?: boolean;
  label?: string;
  role?: "button" | "switch";
  state?: { checked?: boolean; expanded?: boolean };
  demo?: string;
};

function Row({ icon, title, tone = "default", subtitle, value, right, chevron, onPress, first, label, role = "button", state, demo }: RowProps) {
  const reduce = useReduce();
  const { t, s, accent } = useTheme();
  const highlight = useRef(new Animated.Value(0)).current;
  const tile = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.timing(highlight, { toValue: 1, duration: 90, useNativeDriver: true }).start();
    if (!reduce) Animated.spring(tile, { toValue: 0.9, stiffness: 700, damping: 40, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.timing(highlight, { toValue: 0, duration: 320, easing: EASE_OUT, useNativeDriver: true }).start();
    Animated.spring(tile, { toValue: 1, stiffness: 420, damping: 18, useNativeDriver: true }).start();
  };

  const toneColor = tone === "destructive" ? t.red : tone === "accent" ? accent : undefined;

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} accessibilityRole={role} accessibilityLabel={label ?? title} accessibilityState={state} style={s.row} {...(demo ? demoTarget(demo) : null)}>
      <Animated.View style={[s.rowHighlight, { opacity: highlight }]} />
      <Animated.View style={{ transform: [{ scale: tile }] }}>
        <Tile name={icon} glyphColor={toneColor} />
      </Animated.View>
      <View style={[s.rowBody, !first && s.rowSep]}>
        <View style={s.flex}>
          <Text style={[s.rowTitle, tone === "destructive" && { color: t.red }]}>{title}</Text>
          {subtitle ? <View style={s.mt2}>{typeof subtitle === "string" ? <Text style={s.rowSub}>{subtitle}</Text> : subtitle}</View> : null}
        </View>
        {typeof value === "string" ? <Text style={s.rowValue}>{value}</Text> : value}
        {right}
        {chevron && (
          <View style={s.chevronGap}>
            <Chevron />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle: a physical knob that stretches while held                   */
/* ------------------------------------------------------------------ */

const TOGGLE_W = 51;
const TOGGLE_H = 31;
const KNOB = 27;
const KNOB_STRETCH = 6; // pt the knob grows toward the centre while held

function Toggle({ value, onChange, label, demo }: { value: boolean; onChange: (v: boolean) => void; label: string; demo?: string }) {
  const reduce = useReduce();
  const { s, accent } = useTheme();
  const on = useRef(new Animated.Value(value ? 1 : 0)).current;
  const held = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      Animated.timing(on, { toValue: value ? 1 : 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    // A touch of overshoot on arrival: the knob "lands".
    Animated.spring(on, { toValue: value ? 1 : 0, stiffness: 520, damping: 26, useNativeDriver: true }).start();
  }, [value, reduce, on]);

  const hold = (to: number) => !reduce && Animated.spring(held, { toValue: to, stiffness: 600, damping: 36, useNativeDriver: true }).start();

  const motion = useMemo(() => {
    const travel = TOGGLE_W - KNOB - 4;
    // Stretched, the knob grows toward the middle: right when off, left when on.
    const stretchShift = Animated.multiply(held, Animated.add(KNOB_STRETCH / 2, Animated.multiply(on, -KNOB_STRETCH)));
    return {
      fill: { opacity: on.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }) },
      knob: {
        transform: [
          { translateX: Animated.add(on.interpolate({ inputRange: [0, 1], outputRange: [2, 2 + travel] }), stretchShift) },
          { scaleX: held.interpolate({ inputRange: [0, 1], outputRange: [1, (KNOB + KNOB_STRETCH) / KNOB] }) },
        ],
      },
    };
  }, [on, held]);

  return (
    <Pressable
      onPress={() => onChange(!value)}
      onPressIn={() => hold(1)}
      onPressOut={() => hold(0)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={s.toggle}
      {...(demo ? demoTarget(demo) : null)}
    >
      <View style={s.toggleTrack} />
      <Animated.View style={[s.toggleTrack, { backgroundColor: accent }, motion.fill]}>
        <LinearGradient colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]} style={s.toggleSheen} />
      </Animated.View>
      <Animated.View style={[s.knob, motion.knob]}>
        <LinearGradient colors={["#FFFFFF", "#F2F2F2"]} style={s.knobFill} />
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control with a gliding thumb                              */
/* ------------------------------------------------------------------ */

function Segmented({ value, onChange }: { value: Paper; onChange: (p: Paper) => void }) {
  const reduce = useReduce();
  const { t, s } = useTheme();
  const [w, setW] = useState(0);
  const idx = PAPER_KEYS.indexOf(value);
  const x = useRef(new Animated.Value(0)).current;
  const squish = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  const segW = (w - 4) / PAPER_KEYS.length;

  useEffect(() => {
    if (!w) return;
    const to = idx * segW;
    if (!placed.current || reduce) {
      placed.current = true;
      x.setValue(to);
      return;
    }
    Animated.spring(x, { toValue: to, stiffness: 500, damping: 40, useNativeDriver: true }).start();
  }, [idx, w, segW, reduce, x]);

  const squeeze = (to: number) => Animated.spring(squish, { toValue: to, stiffness: to < 1 ? 700 : 420, damping: to < 1 ? 40 : 22, useNativeDriver: true }).start();

  return (
    <View style={s.seg} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {w > 0 && (
        <Animated.View style={[s.segThumb, { width: segW, transform: [{ translateX: x }, { scale: squish }] }]}>
          <LinearGradient colors={t.segThumb} style={s.segThumbFill} />
        </Animated.View>
      )}
      {PAPER_KEYS.map((k) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            onPressIn={() => on && !reduce && squeeze(0.95)}
            onPressOut={() => squeeze(1)}
            accessibilityRole="tab"
            accessibilityLabel={`${PAPERS[k].label} paper`}
            accessibilityState={{ selected: on }}
            style={s.segItem}
            {...demoTarget(`paper-${k}`)}
          >
            <View style={[s.swatch, { backgroundColor: PAPERS[k].bg }]} />
            <Text style={[s.segLabel, on && s.segLabelOn]}>{PAPERS[k].label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Reading preview: paper colours crossfade, size follows the slider   */
/* ------------------------------------------------------------------ */

function Preview({ paper, size, sample }: { paper: Paper; size: number; sample: { date: string; text: string } }) {
  const reduce = useReduce();
  const { s } = useTheme();
  const layers = useRef(PAPER_KEYS.map((k) => new Animated.Value(k === paper ? 1 : 0))).current;

  useEffect(() => {
    const fade = Animated.parallel(
      PAPER_KEYS.map((k, i) =>
        Animated.timing(layers[i], { toValue: k === paper ? 1 : 0, duration: reduce ? 120 : 340, easing: EASE_IN_OUT, useNativeDriver: true }),
      ),
    );
    fade.start();
    return () => fade.stop();
  }, [paper, reduce, layers]);

  const body = (k: Paper) => (
    <>
      <Text style={[s.previewDate, { color: PAPERS[k].meta }]}>{sample.date.toUpperCase()}</Text>
      <Text style={[s.previewText, { color: PAPERS[k].ink, fontSize: size, lineHeight: size * 1.45 }]}>{sample.text}</Text>
    </>
  );

  return (
    <View style={s.preview} accessibilityLabel={`Preview on ${PAPERS[paper].label} paper at ${Math.round(size)} point`}>
      {/* An invisible in-flow copy sizes the card; the paper layers sit on top of it. */}
      <View style={s.hidden}>{body(paper)}</View>
      {PAPER_KEYS.map((k, i) => (
        <Animated.View key={k} style={[s.previewLayer, { backgroundColor: PAPERS[k].bg, opacity: layers[i] }]}>
          {k === "sepia" && <SepiaSheen />}
          {body(k)}
        </Animated.View>
      ))}
    </View>
  );
}

/** A warm light across sepia paper, so it reads as paper rather than a flat beige. */
function SepiaSheen() {
  const id = useSvgId("sepia");
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden>
      <Defs>
        <RadialGradient id={id} cx="0%" cy="0%" r="100%">
          <Stop offset="0" stopColor="#FFF7E8" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#E8D4B2" stopOpacity={0.35} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Slider: 1:1 drag, rubber-band past the ends, snaps with a tick       */
/* ------------------------------------------------------------------ */

const THUMB = 28;
const SLIDER_SPAN = MAX_SIZE - MIN_SIZE;
/** Release velocity (pt/ms) is carried this many ms into the snap. */
const FLING_CARRY = 40;
/** A touch this close to the thumb grabs it; further away jumps the thumb there. */
const GRAB_RADIUS = 22;

/** Past either end the thumb follows at a fraction of the finger, harder the further it goes. */
const rubberBand = (overshoot: number) => (overshoot * 0.35) / (1 + overshoot / 120);

function SizeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const reduce = useReduce();
  const { s, accent } = useTheme();
  const sectionStart = useContext(SectionClock);
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;
  const thumb = useRef(new Animated.Value(1)).current;
  const grabbedAt = useRef(0);
  const live = useRef(value);
  const [shown, setShown] = useState(value);
  const entered = useRef(false);
  const wRef = useRef(0);
  wRef.current = w;

  const toX = (v: number) => ((v - MIN_SIZE) / SLIDER_SPAN) * wRef.current;
  const toV = (px: number) => MIN_SIZE + (Math.min(Math.max(px, 0), wRef.current) / (wRef.current || 1)) * SLIDER_SPAN;

  /* Entrance: the fill runs from the left end to the value once the section lands. */
  useEffect(() => {
    if (!w || sectionStart === null) return;
    if (entered.current || reduce) {
      x.setValue(toX(live.current));
      return;
    }
    x.setValue(0);
    return startNextFrame(() => {
      entered.current = true;
      return Animated.timing(x, { toValue: toX(live.current), duration: T.fill, delay: sectionStart + T.fillLag, easing: EASE_OUT, useNativeDriver: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, sectionStart === null, reduce]);

  const tick = () => {
    if (reduce) return;
    Animated.sequence([
      Animated.timing(thumb, { toValue: 1.16, duration: 90, easing: EASE_OUT, useNativeDriver: false }),
      Animated.spring(thumb, { toValue: 1, stiffness: 520, damping: 24, useNativeDriver: false }),
    ]).start();
  };

  const settle = (target: number) => {
    const v = Math.round(Math.min(Math.max(target, MIN_SIZE), MAX_SIZE));
    live.current = v;
    setShown(v);
    onChange(v);
    if (reduce) x.setValue(toX(v));
    else Animated.spring(x, { toValue: toX(v), stiffness: 420, damping: 30, useNativeDriver: false }).start();
    Animated.timing(bubble, { toValue: 0, duration: reduce ? 80 : 180, delay: reduce ? 0 : 260, easing: EASE_IN, useNativeDriver: false }).start();
    tick();
  };

  const track = (v: number) => {
    if (Math.round(v) !== Math.round(live.current)) onChange(Math.round(v));
    live.current = v;
    setShown(v);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        x.stopAnimation();
        entered.current = true;
        const touchX = e.nativeEvent.locationX - THUMB / 2;
        const current = toX(live.current);
        grabbedAt.current = Math.abs(touchX - current) < GRAB_RADIUS ? current : touchX;
        x.setValue(grabbedAt.current);
        Animated.timing(bubble, { toValue: 1, duration: reduce ? 80 : 160, easing: EASE_OUT, useNativeDriver: false }).start();
        track(toV(grabbedAt.current));
      },
      onPanResponderMove: (_, g) => {
        const W = wRef.current;
        const raw = grabbedAt.current + g.dx;
        const px = raw < 0 ? -rubberBand(-raw) : raw > W ? W + rubberBand(raw - W) : raw;
        x.setValue(px);
        track(toV(px));
      },
      onPanResponderRelease: (_, g) => settle(toV(grabbedAt.current + g.dx + g.vx * FLING_CARRY)),
      onPanResponderTerminate: () => settle(live.current),
    }),
  ).current;

  const step = (d: number) => settle(Math.round(live.current) + d);

  /* A value that arrives from outside (a host control) glides the thumb there. */
  useEffect(() => {
    if (!w || Math.round(live.current) === value) return;
    live.current = value;
    setShown(value);
    entered.current = true;
    if (reduce) x.setValue(toX(value));
    else Animated.spring(x, { toValue: toX(value), stiffness: 420, damping: 30, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const motion = useMemo(
    () => ({
      fill: { width: Animated.add(x, THUMB / 2) },
      thumb: { transform: [{ translateX: x }, { scale: thumb }] },
      bubble: {
        opacity: bubble,
        transform: [
          { translateX: x },
          { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
        ],
      },
    }),
    [x, thumb, bubble],
  );

  return (
    <View
      style={s.slider}
      onLayout={(e) => setW(e.nativeEvent.layout.width - THUMB)}
      accessibilityRole="adjustable"
      accessibilityLabel="Text size"
      accessibilityValue={{ min: MIN_SIZE, max: MAX_SIZE, now: Math.round(shown), text: `${Math.round(shown)} point` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      {...responder.panHandlers}
      {...demoTarget("size-slider")}
    >
      {/* Step marks sit under the fill, so they show only on the part still to go. */}
      <View style={s.sliderTrack}>
        {Array.from({ length: SLIDER_SPAN + 1 }, (_, i) => (
          <View key={i} style={[s.sliderTick, { left: `${(i / SLIDER_SPAN) * 100}%` }]} />
        ))}
      </View>
      <Animated.View style={[s.sliderFill, { backgroundColor: accent }, motion.fill]}>
        <LinearGradient colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0)"]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[s.sliderThumb, motion.thumb]} />
      <Animated.View style={[s.bubble, motion.bubble]}>
        <View style={s.bubbleBody}>
          <Text style={s.bubbleText}>{Math.round(shown)} pt</Text>
        </View>
        <View style={s.bubbleTail} />
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Expand: height animates to the measured content                     */
/* ------------------------------------------------------------------ */

function Expand({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReduce();
  const { s } = useTheme();
  const [h, setH] = useState(0);
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    const move = Animated.timing(v, {
      toValue: open ? 1 : 0,
      duration: reduce ? 0 : open ? 380 : 260,
      easing: open ? EASE_OUT : EASE_IN_OUT,
      useNativeDriver: false,
    });
    move.start();
    return () => move.stop();
  }, [open, reduce, v]);

  const motion = useMemo(
    () => ({
      height: { height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }) },
      content: {
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.2, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      },
    }),
    [v, h],
  );

  return (
    <Animated.View style={[s.expand, motion.height, !open && s.inert]}>
      <Animated.View onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)} style={[s.expandInner, motion.content]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

function TimeChip({ label, selected, onPress, demo }: { label: string; selected: boolean; onPress: () => void; demo?: string }) {
  const reduce = useReduce();
  const { s, accent, onAccent } = useTheme();
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const press = usePressScale(0.94);

  useEffect(() => {
    Animated.timing(on, { toValue: selected ? 1 : 0, duration: reduce ? 0 : 200, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [selected, reduce, on]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={s.flex}
      {...(demo ? demoTarget(demo) : null)}
    >
      <Animated.View style={[s.chip, { transform: [{ scale: press.scale }] }]}>
        <Animated.View style={[s.chipOn, { backgroundColor: accent, boxShadow: `0 4px 12px ${withAlpha(accent, 0.3)}`, opacity: on }]} />
        <Text style={s.chipText} numberOfLines={1}>
          {label}
        </Text>
        <Animated.Text style={[s.chipText, s.chipTextOn, { color: onAccent, opacity: on }]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const AVATAR = 68;
const AVATAR_R = 32.5;
const AVATAR_DISC = 56;

/** Initials on a disc, with a halo that draws itself around them as the card lands. */
function Avatar({ initials }: { initials: string }) {
  const { t, s } = useTheme();
  const halo = useSvgId("halo");
  const drawn = useFollow(1, T.dataLag, T.draw);
  const length = 2 * Math.PI * AVATAR_R;
  const offset = useMemo(() => drawn.interpolate({ inputRange: [0, 1], outputRange: [length + DASH_PAD, 0] }), [drawn, length]);
  return (
    <View style={s.avatarWrap}>
      {/* Wrapped in a View: on the web an Svg beside a positioned layer can render beneath it. */}
      <View style={s.overlay}>
        <Svg width={AVATAR} height={AVATAR} aria-hidden>
          <Defs>
            <SvgGradient id={halo} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={t.ring[0]} />
              <Stop offset="1" stopColor={t.ring[1]} />
            </SvgGradient>
          </Defs>
          <AnimatedPath
            d={ringPath(AVATAR / 2, AVATAR / 2, AVATAR_R)}
            fill="none"
            stroke={`url(#${halo})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${length} ${length + DASH_PAD * 2}`}
            strokeDashoffset={offset}
          />
        </Svg>
      </View>
      <View style={s.avatarDisc}>
        <LinearGradient colors={t.avatar} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={s.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

function ProfileCard({ profile, entries, words }: { profile: SettingsProfile; entries: number; words: number }) {
  const { s } = useTheme();
  const press = usePressScale(0.98);
  const stats: { value: number; format: (n: number) => string; label: string }[] = [
    { value: entries, format: grouped, label: "entries" },
    { value: profile.streakDays, format: whole, label: "day streak" },
    { value: words, format: wordCount, label: "words" },
  ];
  return (
    <Pressable
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}, ${profile.plan}, ${profile.renews}. Account details`}
    >
      <Animated.View style={{ transform: [{ scale: press.scale }] }}>
        <Card>
          <View style={s.profileTop}>
            <Avatar initials={initialsOf(profile.name)} />
            <View style={s.profileText}>
              <Text style={s.profileName}>{profile.name}</Text>
              <Text style={s.profileEmail}>{profile.email}</Text>
              <Pop lag={T.dataLag + T.draw * 0.6} style={s.planPill}>
                <Text style={s.planText}>
                  {profile.plan} <Text style={s.planDim}>· {profile.renews}</Text>
                </Text>
              </Pop>
            </View>
            <Chevron />
          </View>
          <View style={s.stats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[s.stat, i > 0 && s.statSep]}>
                <CountUp value={st.value} format={st.format} style={s.statVal} />
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm sheet                                                       */
/* ------------------------------------------------------------------ */

const SHEET_HIDDEN = 600;
const SHEET_DISMISS_DRAG = 120;
const SHEET_DISMISS_FLICK = 0.9;
const DELETE_WORK = 900; // ms of "working" before the entries move
const DONE_HOLD = 900; // ms the success state shows before the sheet leaves

function Spinner({ color }: { color: string }) {
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(r, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [r]);
  const spin = useMemo(() => ({ transform: [{ rotate: r.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }), [r]);
  return (
    <Animated.View style={spin}>
      <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
        <Circle cx={12} cy={12} r={9} stroke={color} strokeOpacity={0.3} strokeWidth={2.4} fill="none" />
        <Path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

type SheetPhase = "idle" | "working" | "done";

function ConfirmSheet({ open, entries, onCancel, onConfirm }: { open: boolean; entries: number; onCancel: () => void; onConfirm: () => void }) {
  const reduce = useReduce();
  const { t, s, accent } = useTheme();
  const y = useRef(new Animated.Value(SHEET_HIDDEN)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const success = useRef(new Animated.Value(0)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = useState<SheetPhase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    // Nothing to animate on mount while closed.
    if (!mounted.current) {
      mounted.current = true;
      if (!open) return;
    }
    if (open) {
      setPhase("idle");
      success.setValue(0);
      y.setValue(reduce ? 0 : SHEET_HIDDEN);
      Animated.parallel([
        reduce ? Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }) : Animated.spring(y, { toValue: 0, stiffness: 340, damping: 34, useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 1, duration: reduce ? 120 : 300, easing: EASE_OUT, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(y, { toValue: SHEET_HIDDEN, duration: reduce ? 0 : 260, easing: EASE_IN, useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 0, duration: reduce ? 120 : 240, easing: EASE_IN, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Drag the sheet down to dismiss: 1:1 downwards, resisted upwards.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(g.dy > 0 ? g.dy : -((-g.dy * 0.3) / (1 + -g.dy / 80))),
      onPanResponderRelease: (_, g) => {
        if (g.dy > SHEET_DISMISS_DRAG || g.vy > SHEET_DISMISS_FLICK) onCancel();
        else Animated.spring(y, { toValue: 0, velocity: g.vy, stiffness: 320, damping: 30, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const confirm = () => {
    if (phase !== "idle") return;
    setPhase("working");
    timers.current.push(
      setTimeout(() => {
        setPhase("done");
        onConfirm();
        Animated.timing(success, { toValue: 1, duration: reduce ? 120 : 260, easing: EASE_OUT, useNativeDriver: true }).start();
        if (!reduce)
          Animated.sequence([
            Animated.timing(confirmScale, { toValue: 1.04, duration: 110, easing: EASE_OUT, useNativeDriver: true }),
            Animated.spring(confirmScale, { toValue: 1, stiffness: 500, damping: 26, useNativeDriver: true }),
          ]).start();
        timers.current.push(setTimeout(onCancel, DONE_HOLD));
      }, DELETE_WORK),
    );
  };

  const motion = useMemo(
    () => ({
      sheet: { transform: [{ translateY: y }] },
      trash: { opacity: success.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: success.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }] },
      check: { opacity: success, transform: [{ scale: success.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
    }),
    [y, success],
  );

  return (
    <View style={[StyleSheet.absoluteFill, !open && s.inert]} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View style={[s.sheetWrap, motion.sheet]} {...pan.panHandlers} accessibilityViewIsModal>
        <View style={s.sheet}>
          <BlurView intensity={100} tint={t.blurTint} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={t.sheetWash} style={StyleSheet.absoluteFill} />
          <View style={s.sheetEdge} />
          <View style={s.grabber} />
          <View style={s.sheetIcon}>
            <Animated.View style={[s.sheetIconLayer, motion.trash]}>
              <LinearGradient colors={t.redWash} style={s.sheetIconFill} />
              <GlyphIcon name="trash" color={t.red} size={24} />
            </Animated.View>
            <Animated.View style={[s.sheetIconLayer, motion.check]}>
              <View style={[s.sheetIconFill, { backgroundColor: withAlpha(accent, 0.18) }]} />
              <GlyphIcon name="check" color={accent} size={24} />
            </Animated.View>
          </View>
          <Text style={s.sheetTitle}>Delete all {entries} entries?</Text>
          <Text style={s.sheetBody}>They wait in Recently Deleted on every device for 30 days, then they’re gone.</Text>
          <Animated.View style={[s.stretch, { transform: [{ scale: confirmScale }] }]}>
            <SheetButton label={phase === "done" ? "Moved to Recently Deleted" : `Delete ${entries} entries`} onPress={confirm} destructive phase={phase} demo="delete-confirm" />
          </Animated.View>
          <SheetButton label="Cancel" onPress={onCancel} />
        </View>
      </Animated.View>
    </View>
  );
}

function SheetButton({ label, onPress, destructive, phase = "idle", demo }: { label: string; onPress: () => void; destructive?: boolean; phase?: SheetPhase; demo?: string }) {
  const { t, s, accent, onAccent } = useTheme();
  const press = usePressScale(0.97);
  const fill = destructive ? (phase === "done" ? accent : t.red) : undefined;
  const ink = !destructive ? t.ink : phase === "done" ? onAccent : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={phase === "working" ? "Deleting" : label}
      accessibilityState={{ busy: phase === "working", disabled: phase !== "idle" }}
      style={s.stretch}
      {...(demo ? demoTarget(demo) : null)}
    >
      <Animated.View
        style={[
          s.sheetBtn,
          fill ? { backgroundColor: fill, boxShadow: `0 8px 20px ${withAlpha(fill, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.28)` } : s.sheetBtnPlain,
          { transform: [{ scale: press.scale }] },
        ]}
      >
        {fill && <LinearGradient colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]} style={StyleSheet.absoluteFill} />}
        {phase === "working" ? (
          <Spinner color={ink} />
        ) : (
          <View style={s.btnRow}>
            {phase === "done" && <GlyphIcon name="check" color={ink} size={18} />}
            <Text style={[s.sheetBtnText, { color: ink }]}>{label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Nav bar: glass that fades in as the large title scrolls under it    */
/* ------------------------------------------------------------------ */

function NavBar({ glass, small, onDone }: { glass: Animated.Value; small: Animated.Value; onDone?: () => void }) {
  const { t, s, accent, onAccent } = useTheme();
  const press = usePressScale(0.92);
  const title = useMemo(() => ({ opacity: small, transform: [{ translateY: small.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }), [small]);
  return (
    <View style={s.nav}>
      {/* Opacity goes on the BlurView itself: a faded parent would cut it off from its backdrop on the web. */}
      <AnimatedBlurView intensity={100} tint={t.blurTint} style={[StyleSheet.absoluteFill, { opacity: glass }]} />
      <Animated.View style={[s.overlay, { opacity: glass }]}>
        <LinearGradient colors={t.navWash} style={StyleSheet.absoluteFill} />
        <View style={s.navHairline} />
      </Animated.View>
      <View style={s.navRow}>
        <Animated.Text style={[s.navTitle, title]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          Settings
        </Animated.Text>
        <Reveal delay={at(1)} style={s.doneSlot}>
          <Pressable onPress={onDone} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel="Done" hitSlop={10}>
            <Animated.View style={[s.done, { backgroundColor: accent, boxShadow: `0 4px 12px ${withAlpha(accent, 0.28)}` }, { transform: [{ scale: press.scale }] }]}>
              <Text style={[s.doneText, { color: onAccent }]}>Done</Text>
            </Animated.View>
          </Pressable>
        </Reveal>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

/** Scroll distances (pt) over which the nav glass and the small title fade in. */
const GLASS_FROM = 6;
const GLASS_OVER = 36;
const SMALL_FROM = 30;
const SMALL_OVER = 18;
const PULL_SCALE = 1.12; // the large title grows this much when pulled down 140pt

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function MobileSettings({
  theme = "dark",
  accent = DEFAULT_ACCENT,
  appName = "Folio",
  version = "4.2 (1180)",
  profile = DEFAULT_PROFILE,
  initial,
  reminderTimes = DEFAULT_TIMES,
  sample = DEFAULT_SAMPLE,
  paper,
  textSize,
  reminder,
  onChange,
  onDeleteAll,
  onDone,
}: MobileSettingsProps) {
  const reduce = useReducedMotionSetting();
  const { width } = useWindowDimensions();
  const themeValue = useMemo<ThemeValue>(() => ({ t: THEMES[theme], s: STYLES[theme], accent, onAccent: inkOn(accent) }), [theme, accent]);
  const { t, s } = themeValue;
  const { viewport, setScrollTop, setHeight } = useViewport();

  const [st, setSt] = useState<SettingsState>({ ...DEFAULT_STATE, ...initial });
  const [timeOpen, setTimeOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    setSt((prev) => {
      const next = { ...prev, [k]: v };
      onChange?.(next);
      return next;
    });
  const toggle = (k: "reminder" | "weekdaysOnly" | "prompts" | "faceId" | "sync") => set(k, !st[k]);

  /* Values pushed in from a host (a settings panel, a test) win when they change; taps in between still work. */
  useEffect(() => {
    if (paper !== undefined && paper !== st.paper) set("paper", paper);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper]);
  useEffect(() => {
    if (textSize !== undefined && Math.round(textSize) !== st.textSize) set("textSize", Math.round(Math.min(Math.max(textSize, MIN_SIZE), MAX_SIZE)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSize]);
  useEffect(() => {
    if (reminder !== undefined && reminder !== st.reminder) set("reminder", reminder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder]);

  /* scroll-linked chrome */
  const scrollY = useRef(new Animated.Value(0)).current;
  const glass = useRef(new Animated.Value(0)).current;
  const small = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          glass.setValue(clamp01((y - GLASS_FROM) / GLASS_OVER));
          small.setValue(clamp01((y - SMALL_FROM) / SMALL_OVER));
          setScrollTop(y);
        },
      }),
    [scrollY, glass, small, setScrollTop],
  );
  const parallax = useMemo(
    () => ({
      stage: { transform: [{ translateY: scrollY.interpolate({ inputRange: [-200, 0, 600], outputRange: [60, 0, -300], extrapolate: "clamp" }) }] },
      title: { transform: [{ scale: scrollY.interpolate({ inputRange: [-140, 0], outputRange: [PULL_SCALE, 1], extrapolate: "clamp" }) }] },
    }),
    [scrollY],
  );

  const reminderLabel = st.weekdaysOnly ? `${st.reminderTime}, weekdays` : st.reminderTime;

  return (
    <ReducedMotion.Provider value={reduce}>
      <Theme.Provider value={themeValue}>
        <ViewportContext.Provider value={viewport}>
          <View style={s.root} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
            <Animated.View style={[s.stage, parallax.stage]}>
              <StageLight />
            </Animated.View>

            <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Reveal delay={0}>
                <Animated.Text accessibilityRole="header" style={[s.largeTitle, parallax.title]}>
                  Settings
                </Animated.Text>
              </Reveal>

              <Reveal delay={at(1)}>
                <ProfileCard profile={profile} entries={deleted ? 0 : profile.entries} words={deleted ? 0 : profile.words} />
              </Reveal>

              <Group title="Reading" delay={at(2)}>
                <View style={s.segPad}>
                  <Segmented value={st.paper} onChange={(p) => set("paper", p)} />
                </View>
                <View style={s.sliderRow}>
                  <View style={s.sliderHead}>
                    <Tile name="text" />
                    <Text style={[s.rowTitle, s.sliderTitle]}>Text size</Text>
                    <Text style={s.rowValue}>{st.textSize} pt</Text>
                  </View>
                  <View style={s.sliderLine}>
                    <Text style={[s.aa, s.aaSmall]}>A</Text>
                    <View style={s.sliderBox}>
                      <SizeSlider value={st.textSize} onChange={(v) => set("textSize", v)} />
                    </View>
                    <Text style={[s.aa, s.aaLarge]}>A</Text>
                  </View>
                </View>
                <View style={s.previewPad}>
                  <Preview paper={st.paper} size={st.textSize} sample={sample} />
                </View>
              </Group>

              <Group title="Writing" delay={at(3)} footer="Folio nudges once. If you’ve already written today, it stays quiet.">
                <Row
                  icon="bell"
                  first
                  title="Daily reminder"
                  role="switch"
                  onPress={() => toggle("reminder")}
                  state={{ checked: st.reminder }}
                  right={<Toggle value={st.reminder} onChange={(v) => set("reminder", v)} label="Daily reminder" demo="reminder-toggle" />}
                />
                <Expand open={st.reminder}>
                  <Row
                    icon="clock"
                    demo="reminder-time"
                    title="Reminder time"
                    label={`Reminder time, ${st.reminderTime}${st.weekdaysOnly ? ", weekdays" : ", every day"}`}
                    state={{ expanded: timeOpen }}
                    onPress={() => setTimeOpen((o) => !o)}
                    value={<SwapText style={s.rowValue}>{reminderLabel}</SwapText>}
                    right={<RotChevron open={timeOpen} />}
                  />
                  <Expand open={timeOpen}>
                    {/* Chips align with the text column; on narrow phones they take the full row. */}
                    <View style={[s.times, width < NARROW && s.timesNarrow]} accessibilityRole="radiogroup">
                      {reminderTimes.map((time, i) => (
                        <TimeChip key={time} label={time} demo={`time-${i}`} selected={st.reminderTime === time} onPress={() => set("reminderTime", time)} />
                      ))}
                    </View>
                    <View style={s.inlineToggle}>
                      <Text style={[s.rowTitle, s.inlineTitle]}>Weekdays only</Text>
                      <Toggle value={st.weekdaysOnly} onChange={(v) => set("weekdaysOnly", v)} label="Weekdays only" />
                    </View>
                  </Expand>
                </Expand>
                <Row
                  icon="quote"
                  title="Writing prompts"
                  subtitle="One gentle question a day"
                  role="switch"
                  onPress={() => toggle("prompts")}
                  state={{ checked: st.prompts }}
                  right={<Toggle value={st.prompts} onChange={(v) => set("prompts", v)} label="Writing prompts" />}
                />
              </Group>

              <Group title="Privacy & sync" delay={at(4)}>
                <Row
                  icon="face"
                  first
                  title="Lock with Face ID"
                  role="switch"
                  onPress={() => toggle("faceId")}
                  state={{ checked: st.faceId }}
                  right={<Toggle value={st.faceId} onChange={(v) => set("faceId", v)} label="Lock with Face ID" />}
                />
                <Row
                  icon="cloud"
                  title="iCloud sync"
                  role="switch"
                  subtitle={
                    <View style={s.syncLine}>
                      <Pop lag={T.dataLag}>
                        <View style={[s.syncDot, { backgroundColor: st.sync ? accent : t.faint }]} />
                      </Pop>
                      <SwapText style={s.rowSub}>{st.sync ? "Synced 2 min ago · 3 devices" : "Paused · this iPhone only"}</SwapText>
                    </View>
                  }
                  onPress={() => toggle("sync")}
                  state={{ checked: st.sync }}
                  right={<Toggle value={st.sync} onChange={(v) => set("sync", v)} label="iCloud sync" />}
                />
                <Row icon="export" title="Export journal" value="Markdown" chevron label="Export journal, Markdown" />
              </Group>

              <Group delay={at(5)} footer={deleted ? `${profile.entries} entries are in Recently Deleted until 8 November.` : "Entries go to Recently Deleted for 30 days first."}>
                <Row
                  icon={deleted ? "restore" : "trash"}
                  tone={deleted ? "accent" : "destructive"}
                  first
                  demo="delete-all"
                  title={deleted ? `Restore ${profile.entries} entries` : "Delete all entries"}
                  onPress={() => (deleted ? setDeleted(false) : setSheet(true))}
                />
              </Group>

              <Reveal delay={at(6)} waitForView>
                <Text style={s.colophon}>
                  {appName} {version} · Made slowly in Lisbon
                </Text>
              </Reveal>
            </Animated.ScrollView>

            <NavBar glass={glass} small={small} onDone={onDone} />

            <ConfirmSheet
              open={sheet}
              entries={profile.entries}
              onCancel={() => setSheet(false)}
              onConfirm={() => {
                setDeleted(true);
                onDeleteAll?.();
              }}
            />
          </View>
        </ViewportContext.Provider>
      </Theme.Provider>
    </ReducedMotion.Provider>
  );
}

type Nudges = Pick<MobileSettingsProps, "paper" | "textSize" | "reminder">;

const sameProps = (a: Partial<MobileSettingsProps>, b: Partial<MobileSettingsProps>) => {
  const ka = Object.keys(a) as (keyof MobileSettingsProps)[];
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]));
};

/**
 * Paper, text size and the reminder arrive from the preview's action buttons.
 * They are nudges: the screen only reacts when a value changes, so a button
 * pressed twice (after the visitor moved the control on the phone in between)
 * would do nothing. When the same props arrive again, the nudges clear for a
 * frame and are sent again, so every press lands.
 */
export default function MobileSettingsDemo(overrides: Partial<MobileSettingsProps> = {}) {
  const { paper, textSize, reminder, ...config } = overrides;
  const [nudges, setNudges] = useState<Nudges>({ paper, textSize, reminder });
  const previous = useRef<Partial<MobileSettingsProps> | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = overrides;
    const next = { paper, textSize, reminder };
    if (!prev || prev === overrides || !sameProps(prev, overrides)) {
      setNudges(next);
      return;
    }
    setNudges({});
    const id = requestAnimationFrame(() => setNudges(next));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);
  return <MobileSettings {...config} {...nudges} />;
}

/* ------------------------------------------------------------------ */
/* Styles: one sheet per theme, built from its palette                 */
/* ------------------------------------------------------------------ */

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg, overflow: "hidden", userSelect: "none" },
    stage: { position: "absolute", top: 0, left: 0, right: 0, height: 460, pointerEvents: "none" },
    scroll: { paddingTop: STATUS_BAR + NAV, paddingHorizontal: 16, paddingBottom: 48 },
    /** Decoration and motion layers never take touches. */
    inert: { pointerEvents: "none" },
    overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none" },
    hidden: { opacity: 0 },
    flex: { flex: 1 },
    stretch: { alignSelf: "stretch" },
    mt2: { marginTop: 2 },

    largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.9, color: t.ink, marginLeft: 4, marginBottom: 14, transformOrigin: "0% 50%" },

    /* nav */
    nav: { position: "absolute", top: 0, left: 0, right: 0, height: STATUS_BAR + NAV, pointerEvents: "box-none" },
    navHairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.sep },
    navRow: { position: "absolute", left: 0, right: 0, bottom: 0, height: NAV, alignItems: "center", justifyContent: "center", pointerEvents: "box-none" },
    navTitle: { fontSize: 17, fontWeight: "600", color: t.ink, letterSpacing: -0.3 },
    doneSlot: { position: "absolute", right: 14, top: 6, bottom: 6, justifyContent: "center" },
    done: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: "center" },
    doneText: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },

    /* cards and groups */
    card: { borderRadius: 20, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: t.edge, boxShadow: t.cardShadow },
    groupWrap: { marginTop: 26 },
    groupTitle: { fontSize: 13, fontWeight: "600", color: t.sub, letterSpacing: 0.4, marginLeft: 16, marginBottom: 8, textTransform: "uppercase" },
    groupFooter: { fontSize: 13, color: t.sub, marginTop: 8, marginHorizontal: 16, lineHeight: 18 },

    /* profile */
    profileTop: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 14 },
    profileText: { flex: 1, marginLeft: 14 },
    avatarWrap: { width: AVATAR, height: AVATAR, alignItems: "center", justifyContent: "center" },
    avatarDisc: { width: AVATAR_DISC, height: AVATAR_DISC, borderRadius: AVATAR_DISC / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 21, fontWeight: "700", color: t.avatarInk, letterSpacing: -0.4 },
    profileName: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5, color: t.ink },
    profileEmail: { fontSize: 14, color: t.sub, marginTop: 1 },
    planPill: { alignSelf: "flex-start", marginTop: 8, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3.5, backgroundColor: t.pill },
    planText: { fontSize: 12, fontWeight: "700", color: t.ink, letterSpacing: 0.1 },
    planDim: { fontWeight: "500", color: t.sub },
    stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    stat: { flex: 1, alignItems: "center", paddingVertical: 12 },
    statSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.sep },
    statVal: { fontSize: 18, fontWeight: "700", color: t.ink, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
    statLabel: { fontSize: 12, color: t.sub, marginTop: 1 },

    /* rows */
    row: { flexDirection: "row", alignItems: "center", paddingLeft: 14, minHeight: 52 },
    rowHighlight: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: t.press, pointerEvents: "none" },
    rowBody: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, paddingRight: 14, paddingVertical: 11, minHeight: 52 },
    rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    rowTitle: { fontSize: 16, color: t.ink, letterSpacing: -0.3 },
    rowSub: { fontSize: 13, color: t.sub, letterSpacing: -0.1 },
    rowValue: { fontSize: 16, color: t.sub, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
    chevronGap: { marginLeft: 8 },
    tile: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", boxShadow: t.tileShadow },
    tileFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 8 },

    /* toggle */
    toggle: { width: TOGGLE_W, height: TOGGLE_H, borderRadius: TOGGLE_H / 2, marginLeft: 10 },
    toggleTrack: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: TOGGLE_H / 2, overflow: "hidden", backgroundColor: t.track },
    toggleSheen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    knob: {
      position: "absolute",
      top: 2,
      left: 0,
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      overflow: "hidden",
      boxShadow: "0 3px 8px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.04)",
    },
    knobFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: KNOB / 2 },

    /* segmented + preview */
    segPad: { paddingHorizontal: 14, paddingTop: 14 },
    previewPad: { paddingHorizontal: 14, paddingBottom: 14 },
    seg: { flexDirection: "row", height: 36, borderRadius: 11, backgroundColor: t.segTrack, padding: 2 },
    segThumb: { position: "absolute", top: 2, left: 2, bottom: 2, borderRadius: 9, boxShadow: t.segThumbShadow },
    segThumbFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 9 },
    segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    segLabel: { fontSize: 13.5, fontWeight: "500", color: t.sub },
    segLabelOn: { color: t.ink, fontWeight: "600" },
    swatch: { width: 11, height: 11, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: t.scheme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.22)" },

    preview: { borderRadius: 14, overflow: "hidden", padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.previewEdge },
    previewLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, padding: 16, pointerEvents: "none" },
    previewDate: { fontSize: 11, fontWeight: "600", letterSpacing: 1.1, marginBottom: 6 },
    previewText: { fontFamily: "Georgia", letterSpacing: -0.1 },

    /* slider */
    sliderRow: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
    sliderHead: { flexDirection: "row", alignItems: "center" },
    sliderTitle: { flex: 1, marginLeft: 12 },
    sliderLine: { flexDirection: "row", alignItems: "center", marginTop: 6 },
    sliderBox: { flex: 1, marginHorizontal: 6 },
    aa: { width: 18, textAlign: "center", fontFamily: "Georgia", color: t.sub },
    aaSmall: { fontSize: 13 },
    aaLarge: { fontSize: 20 },
    slider: { height: 44, justifyContent: "center" },
    sliderTrack: { position: "absolute", left: THUMB / 2, right: THUMB / 2, height: 6, borderRadius: 3, backgroundColor: t.track, top: 19, pointerEvents: "none" },
    sliderTick: { position: "absolute", top: 2, width: 2, height: 2, marginLeft: -1, borderRadius: 1, backgroundColor: t.faint },
    sliderFill: { position: "absolute", left: 0, top: 19, height: 6, borderRadius: 3, overflow: "hidden", pointerEvents: "none" },
    sliderThumb: {
      position: "absolute",
      left: 0,
      top: 8,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: "#FFFFFF",
      boxShadow: "0 3px 8px rgba(0,0,0,0.22), 0 1px 1px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.05)",
      pointerEvents: "none",
    },
    bubble: { position: "absolute", left: -12, top: -34, width: 52, alignItems: "center", pointerEvents: "none" },
    bubbleBody: { backgroundColor: t.bubble, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, boxShadow: "0 6px 16px rgba(0,0,0,0.25)" },
    bubbleText: { color: t.bubbleInk, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
    bubbleTail: { width: 8, height: 8, backgroundColor: t.bubble, transform: [{ rotate: "45deg" }], marginTop: -5 },

    /* reminder time */
    expand: { overflow: "hidden" },
    expandInner: { position: "absolute", top: 0, left: 0, right: 0 },
    times: { flexDirection: "row", gap: 6, paddingLeft: 56, paddingRight: 14, paddingTop: 2, paddingBottom: 10 },
    timesNarrow: { paddingLeft: 14 },
    chip: { height: 34, borderRadius: 12, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: t.chip },
    chipOn: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 12 },
    chipText: { fontSize: 13, fontWeight: "600", letterSpacing: -0.2, color: t.ink, fontVariant: ["tabular-nums"] },
    chipTextOn: { position: "absolute" },
    inlineToggle: { flexDirection: "row", alignItems: "center", marginLeft: 56, paddingRight: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
    inlineTitle: { flex: 1, fontSize: 15 },

    syncLine: { flexDirection: "row", alignItems: "center" },
    syncDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },

    colophon: { textAlign: "center", fontSize: 12.5, color: t.faint, marginTop: 28 },

    /* sheet */
    sheetWrap: { position: "absolute", left: 10, right: 10, bottom: 12 },
    sheet: {
      borderRadius: 34,
      overflow: "hidden",
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 20,
      alignItems: "center",
      boxShadow: "0 30px 60px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.12)",
    },
    sheetEdge: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 34,
      borderWidth: 1,
      borderTopColor: t.sheetEdge.top,
      borderLeftColor: t.sheetEdge.side,
      borderRightColor: t.sheetEdge.side,
      borderBottomColor: t.sheetEdge.bottom,
      pointerEvents: "none",
    },
    grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: t.grabber, marginBottom: 18 },
    sheetIcon: { width: 52, height: 52, marginBottom: 14 },
    sheetIconLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
    sheetIconFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 26 },
    sheetTitle: { fontSize: 21, fontWeight: "700", letterSpacing: -0.5, color: t.ink, textAlign: "center" },
    sheetBody: { fontSize: 15, lineHeight: 21, color: t.sub, textAlign: "center", marginTop: 8, marginBottom: 20, paddingHorizontal: 8 },
    sheetBtn: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 8 },
    sheetBtnPlain: { backgroundColor: t.chip },
    sheetBtnText: { fontSize: 16.5, fontWeight: "600", letterSpacing: -0.3 },
    btnRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  });

type Styles = ReturnType<typeof makeStyles>;

const STYLES: Record<SettingsTheme, Styles> = { dark: makeStyles(THEMES.dark), light: makeStyles(THEMES.light) };
