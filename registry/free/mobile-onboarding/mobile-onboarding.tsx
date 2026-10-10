import { forwardRef, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
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
  Ellipse,
  G,
  LinearGradient as SvgGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** The small glass card floating over the landscape. Every number inside `value` counts up as it arrives. */
export type OnboardingChip =
  | { kind: "breath"; value: string; label: string }
  | { kind: "focus"; value: string; label: string; badge: string }
  | { kind: "week"; value: string; label: string; bars: number[] }
  | { kind: "reminder"; value: string; label: string };

/** A light in the sky: `x` as a fraction of the width, `altitude` in pt above the horizon (negative has set). */
export type SkyBody = { x: number; altitude: number };

/** One time of day, in neutral greys. Neighbouring steps blend as you drag. */
export type OnboardingScene = {
  /** Sky gradient, top → horizon. */
  sky: [string, string, string];
  /** Far ridge, middle hills, near meadow. */
  land: [string, string, string];
  sun: SkyBody;
  moon: SkyBody;
  /** 0–1. */
  stars: number;
  /** 0–1: low mist lying between the ridges. */
  mist: number;
};

export type OnboardingStep = {
  /** Short kicker above the headline. */
  kicker: string;
  title: string;
  body: string;
  /** Minutes after midnight on the card clock. The clock tweens between steps as you drag. */
  minutes: number;
  scene: OnboardingScene;
  chip: OnboardingChip;
};

export type MobileOnboardingProps = {
  brand?: string;
  steps?: OnboardingStep[];
  /** The one colour in the scene (6-digit hex): the grove, the brand mark and the planting button. */
  accent?: string;
  skipLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Shown in the button once the first tree is planted. */
  doneLabel?: string;
  /** Called once the planting flourish has played. */
  onFinish?: () => void;
  /**
   * Jumps the carousel to this step (0-based) each time the value changes. Leave it unset and the
   * carousel is driven only by the person; a planted grove is cleared when you jump back.
   */
  step?: number;
  /** Change this number to jump to `step` again when its value has not changed (a "replay" button). */
  stepKey?: number;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#8BE0A4";

const INK = {
  ground: "#050505",
  text: "#F5F5F5",
  soft: "rgba(245,245,245,0.64)",
  faint: "rgba(245,245,245,0.42)",
  onLight: "#0A0A0A",
  bark: "#262626",
} as const;

const GLASS = {
  card: ["rgba(30,30,30,0.66)", "rgba(10,10,10,0.8)"],
  chip: ["rgba(44,44,44,0.5)", "rgba(14,14,14,0.62)"],
  control: ["rgba(48,48,48,0.46)", "rgba(16,16,16,0.56)"],
} as const satisfies Record<string, readonly [string, string]>;

const ND = Platform.OS !== "web";
/**
 * A CSS blur renders and animates on the web; the native driver cannot animate `filter`,
 * so on iOS and Android the same entrance trades the blur for a 0.98 → 1 scale.
 */
const CAN_BLUR = Platform.OS === "web";
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const DURATION = {
  /** First view: the scene rises and the card lands. */
  intro: 760,
  /** One step's entrance, first block to last. */
  step: 720,
  /** First view: the first step starts once the card has begun to land. */
  stepDelay: 140,
  page: 560,
  skip: 760,
  /** Reduced motion: everything becomes a short fade. */
  reduced: 150,
  press: 90,
  flourish: 1100,
} as const;

const SPRING = {
  drag: { stiffness: 320, damping: 30, mass: 1 },
  press: { stiffness: 420, damping: 22, mass: 1 },
  plant: { stiffness: 200, damping: 17, mass: 1 },
} as const;

type Cue = readonly [start: number, end: number];

/** Where each block lands on a step's entrance timeline: text, then the figure, then its data. */
const CUE = {
  kicker: [0, 0.5],
  title: [0.07, 0.57],
  body: [0.14, 0.64],
  chip: [0.22, 0.7],
  figure: [0.34, 0.84],
  data: [0.42, 1],
  badge: [0.68, 1],
} as const satisfies Record<string, Cue>;

/** Parallax: how far each layer travels per page, as a fraction of the screen width. Stars are infinitely far. */
const RATE = { mist: 0.14, far: 0.22, mid: 0.48, near: 0.8, chip: 1.12, copy: 0.32 } as const;

const LAYOUT = {
  topBar: 54,
  card: 336,
  cardCompact: 304,
  /** Below this height the card and type tighten. */
  compactBelow: 760,
  inset: 12,
} as const;

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    kicker: "Start small",
    title: "Two quiet minutes still count.",
    body: "Breathe, stretch, read a page. Grove counts a two-minute pause exactly like an hour of deep work.",
    minutes: 5 * 60 + 40,
    scene: {
      sky: ["#060606", "#151515", "#303030"],
      land: ["#202020", "#131313", "#0A0A0A"],
      sun: { x: 0.2, altitude: -84 },
      moon: { x: 0.8, altitude: 186 },
      stars: 0.65,
      mist: 0.4,
    },
    chip: { kind: "breath", value: "2:00", label: "Morning breath" },
  },
  {
    kicker: "Grow something",
    title: "Every session plants a tree.",
    body: "Finish a focus block and a sapling takes root on your hill. Stop early and it simply waits. Nothing wilts.",
    minutes: 8 * 60 + 20,
    scene: {
      sky: ["#202020", "#444444", "#767676"],
      land: ["#585858", "#383838", "#1C1C1C"],
      sun: { x: 0.28, altitude: 150 },
      moon: { x: 0.98, altitude: -70 },
      stars: 0,
      mist: 0.85,
    },
    chip: { kind: "focus", value: "Deep work", label: "25 min · Thesis draft", badge: "+1" },
  },
  {
    kicker: "Look back",
    title: "Watch the week take shape.",
    body: "A good week looks like a small forest. On Sunday evening Grove sends one honest page on what grew.",
    minutes: 18 * 60 + 40,
    scene: {
      sky: ["#0C0C0C", "#242424", "#4A4A4A"],
      land: ["#2C2C2C", "#1B1B1B", "#0F0F0F"],
      sun: { x: 0.78, altitude: 22 },
      moon: { x: 0.1, altitude: -50 },
      stars: 0.18,
      mist: 0.5,
    },
    chip: { kind: "week", value: "14 trees", label: "This week", bars: [0.45, 0.7, 0.3, 0.9, 0.6, 1, 0.5] },
  },
  {
    kicker: "Begin",
    title: "Plant your first tree.",
    body: "Pick a moment that already exists in your day. We’ll nudge you once, gently, then get out of the way.",
    minutes: 21 * 60 + 30,
    scene: {
      sky: ["#020202", "#090909", "#171717"],
      land: ["#1A1A1A", "#0E0E0E", "#070707"],
      sun: { x: 0.96, altitude: -120 },
      moon: { x: 0.72, altitude: 196 },
      stars: 1,
      mist: 0.28,
    },
    chip: { kind: "reminder", value: "Tomorrow, 7:30", label: "Morning breath · 2 min" },
  },
];

/* ------------------------------------------------------------------ */
/* Helpers and hooks                                                   */
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

/** An Animated.Value created once, without allocating a throwaway value on every render. */
function useAnimatedNumber(initial: number) {
  return useState(() => new Animated.Value(initial))[0];
}

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * React Native Web turns `dataSet` into the `data-demo` attribute the live demo script targets.
 * The demo swipes the copy (data-demo="copy"), then taps Skip (data-demo="skip") and the main
 * button (data-demo="next"); the top-left button is data-demo="back".
 */
const demoTarget = (name: string): { dataSet: { demo: string } } => ({ dataSet: { demo: name } });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Blend two #RRGGBB colours. */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** #RRGGBB at an alpha. */
function alpha(hex: string, a: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

/** Deterministic pseudo-random numbers, so the stars and grain never reshuffle between renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Eased progress through a cue window, for listeners that need the number rather than a node. */
function cueProgress(v: number, [a, b]: Cue) {
  return EASE_OUT(clamp((v - a) / (b - a), 0, 1));
}

/** A 0→1 node for one cue window on a timeline, eased so linear timelines still land softly. */
function cueNode(t: Animated.Value, [a, b]: Cue) {
  return t.interpolate({ inputRange: [a, b], outputRange: [0, 1], easing: EASE_OUT, extrapolate: "clamp" });
}

/** A value that is 1 on page `i` and 0 at `reach` pages either side. */
function pageWindow(pos: Animated.Value, i: number, reach: number) {
  return pos.interpolate({ inputRange: [i - reach, i, i + reach], outputRange: [0, 1, 0], extrapolate: "clamp" });
}

/**
 * The entrance look for a block: opacity, a rise and a blur that clears (scale on native).
 * `p` runs 0 → 1. With reduced motion it is a plain fade.
 */
function revealStyle(p: Animated.AnimatedInterpolation<number>, reduced: boolean, rise = 12, blur = 6) {
  if (reduced) return { opacity: p };
  const y = p.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] });
  if (!CAN_BLUR) return { opacity: p, transform: [{ translateY: y }, { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] };
  return { opacity: p, transform: [{ translateY: y }], filter: p.interpolate({ inputRange: [0, 1], outputRange: [`blur(${blur}px)`, "blur(0px)"] }) };
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

/* Animated adds a `collapsable` prop that SVG elements on the web would pass to the DOM. */
const StrokePath = forwardRef<Path, ComponentProps<typeof Path> & { collapsable?: boolean }>(function StrokePath(
  { collapsable: _collapsable, ...rest },
  ref,
) {
  return <Path ref={ref} {...rest} />;
});
const StrokeCircle = forwardRef<Circle, ComponentProps<typeof Circle> & { collapsable?: boolean }>(function StrokeCircle(
  { collapsable: _collapsable, ...rest },
  ref,
) {
  return <Circle ref={ref} {...rest} />;
});
const AnimatedPath = Animated.createAnimatedComponent(StrokePath);
const AnimatedCircle = Animated.createAnimatedComponent(StrokeCircle);

type SquishProps = Omit<PressableProps, "style"> & {
  /** Scale while held: ~0.97 for buttons. */
  to?: number;
  reduced?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A Pressable that sinks on press and springs back with a hair of lift. */
function Squish({ to = 0.97, reduced, style, onPressIn, onPressOut, ...rest }: SquishProps) {
  const scale = useAnimatedNumber(1);
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduced) Animated.timing(scale, { toValue: to, duration: DURATION.press, easing: EASE_OUT, useNativeDriver: ND }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, ...SPRING.press, useNativeDriver: ND }).start();
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}

type GlassProps = {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  intensity?: number;
  wash?: readonly [string, string];
  /** Outer shadow, on its own layer so it fades with the glass. */
  shadow?: string;
  /** Opacity for the glass layers. Applied per layer, never to an ancestor of the blur, so the blur keeps its backdrop. */
  fade?: Animated.WithAnimatedValue<number>;
};

/** Dark frosted glass: real backdrop blur, a faint smoked wash and a hairline that is brighter on top. */
function Glass({ radius, style, children, intensity = 40, wash = GLASS.chip, shadow, fade = 1 }: GlassProps) {
  const round = { borderRadius: radius };
  return (
    <View style={[round, style]}>
      {shadow ? <Animated.View style={[StyleSheet.absoluteFill, round, styles.noTouch, { boxShadow: shadow, opacity: fade }]} /> : null}
      <View style={[StyleSheet.absoluteFill, round, styles.clip]}>
        <AnimatedBlur intensity={intensity} tint="dark" style={[StyleSheet.absoluteFill, { opacity: fade }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <LinearGradient colors={wash} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      {children}
      <Animated.View style={[StyleSheet.absoluteFill, round, styles.glassEdge, { opacity: fade }]} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Pager and choreography hooks                                        */
/* ------------------------------------------------------------------ */

/** Rubber band past either end, in pages. */
const rubber = (overshoot: number) => (1 - 1 / (overshoot * 0.55 + 1)) * 0.6;
/** How far a fling carries, in seconds of release velocity. */
const FLING_PROJECTION = 0.22;

/** A 1:1 horizontal pager on one Animated value measured in pages. */
function usePager(pos: Animated.Value, count: number, width: number, reduced: boolean, locked: boolean) {
  const live = useRef({ count, width, reduced, locked });
  live.current = { count, width, reduced, locked };

  const goTo = useMemo(
    () => (target: number, duration: number = DURATION.page) => {
      const toValue = clamp(target, 0, live.current.count - 1);
      const config = live.current.reduced
        ? { toValue, duration: DURATION.reduced, easing: EASE_OUT }
        : { toValue, duration, easing: EASE_IN_OUT };
      Animated.timing(pos, { ...config, useNativeDriver: ND }).start();
    },
    [pos],
  );

  const pan = useMemo(() => {
    let start = 0;
    const settle = (toValue: number, velocity = 0) => {
      if (live.current.reduced) Animated.timing(pos, { toValue, duration: DURATION.reduced, useNativeDriver: ND }).start();
      else Animated.spring(pos, { toValue, velocity, ...SPRING.drag, useNativeDriver: ND }).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => !live.current.locked && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pos.stopAnimation((v) => {
          start = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const { width: w, count: c } = live.current;
        if (!w) return;
        const raw = start - g.dx / w;
        const max = c - 1;
        pos.setValue(raw < 0 ? -rubber(-raw) : raw > max ? max + rubber(raw - max) : raw);
      },
      onPanResponderRelease: (_, g) => {
        const { width: w, count: c } = live.current;
        if (!w) return;
        const velocity = (-g.vx * 1000) / w; // pages per second
        const from = Math.round(start);
        const projected = Math.round(start - g.dx / w + velocity * FLING_PROJECTION);
        // A fling moves one page at most, however hard it is thrown.
        settle(clamp(clamp(projected, from - 1, from + 1), 0, c - 1), velocity);
      },
      onPanResponderTerminate: () => pos.stopAnimation((v) => settle(Math.round(v))),
    });
  }, [pos]);

  return { pan, goTo };
}

/** The page under the finger, as React state (changes once per page, not per frame). */
function usePageIndex(pos: Animated.Value, count: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      const i = clamp(Math.round(value), 0, count - 1);
      setIndex((p) => (p === i ? p : i));
    });
    return () => pos.removeListener(id);
  }, [pos, count]);
  return index;
}

/**
 * One entrance timeline per step. The active step plays 0 → 1; a step resets only once it is
 * fully off screen, so dragging back to a half-visible step never pops it out and in again.
 */
function useStepEntrances(pos: Animated.Value, count: number, index: number, ready: boolean, reduced: boolean) {
  const timelines = useMemo(() => Array.from({ length: count }, () => new Animated.Value(0)), [count]);
  const played = useRef<boolean[]>([]);
  const first = useRef(true);

  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      timelines.forEach((t, i) => {
        if (played.current[i] && Math.abs(value - i) >= 1) {
          played.current[i] = false;
          t.stopAnimation();
          t.setValue(0);
        }
      });
    });
    return () => pos.removeListener(id);
  }, [pos, timelines]);

  useEffect(() => {
    if (!ready) return;
    const t = timelines[index];
    const delay = first.current && !reduced ? DURATION.stepDelay : 0;
    first.current = false;
    played.current[index] = true;
    t.stopAnimation((from) => {
      const span = reduced ? DURATION.reduced : DURATION.step;
      Animated.timing(t, { toValue: 1, duration: span * (1 - from), delay, easing: Easing.linear, useNativeDriver: ND }).start();
    });
  }, [index, ready, reduced, timelines]);

  return timelines;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function MobileOnboarding({
  brand = "grove",
  steps = DEFAULT_STEPS,
  accent = DEFAULT_ACCENT,
  skipLabel = "Skip",
  nextLabel = "Continue",
  finishLabel = "Plant my first tree",
  doneLabel = "Planted. See you at 7:30",
  onFinish,
  step,
  stepKey = 0,
}: MobileOnboardingProps) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [done, setDone] = useState(false);
  /* The card keeps a transform only while it lands; Chromium stops blurring under a lingering transform. */
  const [landed, setLanded] = useState(false);
  const { w, h } = size;
  const n = steps.length;
  const last = n - 1;

  const pos = useAnimatedNumber(0);
  const intro = useAnimatedNumber(0);
  const plant = useAnimatedNumber(0);
  const burst = useAnimatedNumber(0);
  const doneFade = useAnimatedNumber(0);

  const index = usePageIndex(pos, n);
  const { pan, goTo } = usePager(pos, n, w, reduced, done);
  const entrances = useStepEntrances(pos, n, index, w > 0, reduced);

  useEffect(() => {
    if (!w) return;
    Animated.timing(intro, { toValue: 1, duration: reduced ? DURATION.reduced : DURATION.intro, easing: Easing.linear, useNativeDriver: ND }).start(
      ({ finished }) => finished && setLanded(true),
    );
  }, [w, intro, reduced]);

  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
  }, []);

  /* A changed `step` prop moves the carousel; jumping off a planted last step clears the grove. */
  const appliedStep = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (step === undefined || !w) return;
    const request = `${step}:${stepKey}`;
    if (appliedStep.current === request) return;
    appliedStep.current = request;
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (step < last) {
      setDone(false);
      plant.setValue(0);
      burst.setValue(0);
      doneFade.setValue(0);
    }
    goTo(step);
  }, [step, stepKey, w, last, goTo, plant, burst, doneFade]);

  const finish = () => {
    if (done) return;
    setDone(true);
    AccessibilityInfo.announceForAccessibility?.(doneLabel);
    if (reduced) {
      plant.setValue(1);
      Animated.timing(doneFade, { toValue: 1, duration: DURATION.reduced, useNativeDriver: ND }).start();
    } else {
      Animated.parallel([
        Animated.spring(plant, { toValue: 1, ...SPRING.plant, useNativeDriver: ND }),
        Animated.timing(burst, { toValue: 1, duration: DURATION.flourish, easing: Easing.linear, useNativeDriver: ND }),
        Animated.timing(doneFade, { toValue: 1, duration: 380, easing: EASE_OUT, useNativeDriver: ND }),
      ]).start();
    }
    finishTimer.current = setTimeout(() => onFinish?.(), DURATION.flourish);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  const compact = h > 0 && h < LAYOUT.compactBelow;
  const cardH = compact ? LAYOUT.cardCompact : LAYOUT.card;
  const cardTop = h - LAYOUT.inset - cardH;
  const ground = {
    horizon: cardTop - (compact ? 118 : 146),
    mid: cardTop - (compact ? 82 : 100),
    near: cardTop - (compact ? 46 : 56),
  };

  return (
    <View style={styles.root} onLayout={onLayout} {...pan.panHandlers}>
      {w > 0 && h > 0 ? (
        <>
          <Scene w={w} h={h} steps={steps} accent={accent} pos={pos} intro={intro} plant={plant} reduced={reduced} ground={ground} />

          {steps.map((s, i) => (
            <StepChip
              key={`chip-${s.title}`}
              chip={s.chip}
              i={i}
              pos={pos}
              t={entrances[i]}
              w={w}
              top={ground.horizon - (i % 2 === 0 ? 84 : 132)}
              side={i % 4 < 2 ? "right" : "left"}
              accent={accent}
              reduced={reduced}
              active={index === i}
            />
          ))}

          <TopBar
            brand={brand}
            accent={accent}
            pos={pos}
            intro={intro}
            last={last}
            index={index}
            done={done}
            reduced={reduced}
            skipLabel={skipLabel}
            onBack={() => goTo(index - 1)}
            onSkip={() => goTo(last, DURATION.skip)}
          />

          <Card top={cardTop} height={cardH} intro={intro} landed={landed} reduced={reduced}>
            <View style={styles.cardHead}>
              <Progress pos={pos} intro={intro} n={n} reduced={reduced} />
              <Clock pos={pos} intro={intro} steps={steps} reduced={reduced} />
            </View>

            <View
              style={styles.copyArea}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`${steps[index].title} ${steps[index].body}`}
              accessibilityValue={{ text: `Step ${index + 1} of ${n}` }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(e) => goTo(e.nativeEvent.actionName === "increment" ? index + 1 : index - 1)}
              {...demoTarget("copy")}
            >
              {steps.map((s, i) => (
                <StepCopy key={`copy-${s.title}`} step={s} i={i} pos={pos} t={entrances[i]} w={w} compact={compact} reduced={reduced} />
              ))}
            </View>

            <Primary
              pos={pos}
              intro={intro}
              last={last}
              accent={accent}
              done={done}
              doneFade={doneFade}
              burst={burst}
              reduced={reduced}
              nextLabel={nextLabel}
              finishLabel={finishLabel}
              doneLabel={doneLabel}
              isLast={index === last}
              onPress={() => (index < last ? goTo(index + 1) : finish())}
            />
          </Card>
        </>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Scene: sky, stars, sun and moon, mist, three ridges and the grove   */
/* ------------------------------------------------------------------ */

type Ground = { horizon: number; mid: number; near: number };

type SceneProps = {
  w: number;
  h: number;
  steps: OnboardingStep[];
  accent: string;
  pos: Animated.Value;
  intro: Animated.Value;
  plant: Animated.Value;
  reduced: boolean;
  ground: Ground;
};

function Scene({ w, h, steps, accent, pos, intro, plant, reduced, ground }: SceneProps) {
  const skies = useMemo(() => steps.map((s) => s.scene.sky), [steps]);
  const scrim = useMemo(() => intro.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" }), [intro]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.noTouch]}>
      {/* Each step's sky fades in over the last, so mid-drag the greys truly interpolate. */}
      <CrossfadeStack pos={pos} count={steps.length}>
        {(i) => <LinearGradient colors={skies[i]} locations={[0, 0.5, 0.86]} style={StyleSheet.absoluteFill} />}
      </CrossfadeStack>

      <Stars w={w} horizon={ground.horizon} steps={steps} pos={pos} intro={intro} />
      <SkyBodies w={w} steps={steps} pos={pos} intro={intro} horizon={ground.horizon} reduced={reduced} />
      <Landscape w={w} h={h} steps={steps} accent={accent} pos={pos} intro={intro} plant={plant} reduced={reduced} ground={ground} />

      {/* A soft scrim keeps the top bar legible on the brightest morning. */}
      <LinearGradient colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0)"]} style={styles.topScrim} />
      <Grain w={w} h={h} />

      {/* First view: the whole scene comes up out of black. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: INK.ground, opacity: scrim }]} />
    </View>
  );
}

/** Stacks one layer per step and fades each in over the one before as `pos` passes it. */
function CrossfadeStack({ pos, count, children }: { pos: Animated.Value; count: number; children: (i: number) => ReactNode }) {
  const fades = useMemo(
    () => Array.from({ length: count }, (_, i) => (i === 0 ? 1 : pos.interpolate({ inputRange: [i - 1, i], outputRange: [0, 1], extrapolate: "clamp" }))),
    [pos, count],
  );
  return (
    <>
      {fades.map((opacity, i) => (
        <Animated.View key={`layer${i}`} style={[StyleSheet.absoluteFill, styles.noTouch, { opacity }]}>
          {children(i)}
        </Animated.View>
      ))}
    </>
  );
}

/** Interpolates a per-step number across `pos`. */
function perStep(pos: Animated.Value, values: number[]) {
  if (values.length < 2) return values[0] ?? 0;
  return pos.interpolate({ inputRange: values.map((_, i) => i), outputRange: values, extrapolate: "clamp" });
}

function Stars({ w, horizon, steps, pos, intro }: { w: number; horizon: number; steps: OnboardingStep[]; pos: Animated.Value; intro: Animated.Value }) {
  const field = useMemo(() => {
    const rnd = seeded(23);
    return Array.from({ length: 110 }, () => {
      const y = rnd() * horizon;
      // Fainter and smaller toward the horizon, where the air is thicker.
      const depth = 1 - y / horizon;
      return { x: rnd() * w, y, r: 0.35 + rnd() * (0.5 + depth * 0.7), o: (0.25 + rnd() * 0.7) * (0.35 + depth * 0.65) };
    });
  }, [w, horizon]);
  const opacity = useMemo(
    () =>
      Animated.multiply(
        perStep(pos, steps.map((s) => s.scene.stars)),
        intro.interpolate({ inputRange: [0.2, 0.9], outputRange: [0, 1], extrapolate: "clamp" }),
      ),
    [pos, intro, steps],
  );
  return (
    <Animated.View style={[styles.abs, styles.noTouch, { width: w, height: horizon, opacity }]}>
      <Svg width={w} height={horizon}>
        {field.map((s, i) => (
          <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" fillOpacity={s.o} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Sun and moon each travel their own path through the steps, with a gentle arc between keyframes. */
function SkyBodies({ w, steps, pos, intro, horizon, reduced }: { w: number; steps: OnboardingStep[]; pos: Animated.Value; intro: Animated.Value; horizon: number; reduced: boolean }) {
  const tracks = useMemo(() => ({ sun: bodyTrack(steps, "sun", w, horizon), moon: bodyTrack(steps, "moon", w, horizon) }), [steps, w, horizon]);
  return (
    <>
      <SkyBody kind="sun" track={tracks.sun} pos={pos} intro={intro} reduced={reduced} />
      <SkyBody kind="moon" track={tracks.moon} pos={pos} intro={intro} reduced={reduced} />
    </>
  );
}

/** How far a body lifts above the straight line between two steps, so it arcs rather than slides. */
const ARC_LIFT = 26;
/** The highest a body's centre may sit: clear of the top bar on short screens, whatever its altitude. */
const SKY_CEILING = LAYOUT.topBar + 44 + 40;

type BodyTrack = { input: number[]; xs: number[]; ys: number[] };

/** Keyframes for one body: each step's position, plus a lifted midpoint between neighbours. */
function bodyTrack(steps: OnboardingStep[], body: "sun" | "moon", w: number, horizon: number): BodyTrack {
  const track: BodyTrack = { input: [], xs: [], ys: [] };
  const pts = steps.map((s) => ({ x: s.scene[body].x * w, y: Math.max(SKY_CEILING, horizon - s.scene[body].altitude) }));
  pts.forEach((p, i) => {
    if (i > 0) {
      const q = pts[i - 1];
      track.input.push(i - 0.5);
      track.xs.push((p.x + q.x) / 2);
      track.ys.push(Math.max(SKY_CEILING - ARC_LIFT, (p.y + q.y) / 2 - ARC_LIFT));
    }
    track.input.push(i);
    track.xs.push(p.x);
    track.ys.push(p.y);
  });
  return track;
}

const BODY = {
  sun: { field: 460, r: 21, glow: [0.6, 0.34, 0.14, 0.05, 0], core: ["#FFFFFF", "#E6E6E6"] },
  moon: { field: 300, r: 17, glow: [0.34, 0.16, 0.06, 0.02, 0], core: ["#F7F7F7", "#BDBDBD"] },
} as const;

function SkyBody({
  kind,
  track,
  pos,
  intro,
  reduced,
}: {
  kind: "sun" | "moon";
  track: BodyTrack;
  pos: Animated.Value;
  intro: Animated.Value;
  reduced: boolean;
}) {
  const id = useSvgId(kind);
  const { field: S, r, glow, core } = BODY[kind];
  const c = S / 2;
  const style = useMemo(() => {
    const at = (out: number[]) =>
      track.input.length > 1 ? pos.interpolate({ inputRange: track.input, outputRange: out.map((v) => v - c), extrapolate: "clamp" }) : out[0] - c;
    return {
      opacity: intro.interpolate({ inputRange: [0.1, 0.7], outputRange: [0, 1], extrapolate: "clamp" }),
      transform: [
        { translateX: at(track.xs) },
        { translateY: at(track.ys) },
        { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 24, 0], easing: EASE_OUT }) },
      ],
    };
  }, [track, pos, intro, reduced, c]);

  return (
    <Animated.View style={[styles.abs, styles.noTouch, { width: S, height: S }, style]}>
      <Svg width={S} height={S}>
        <Defs>
          <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
            {[0, 0.09, 0.22, 0.48, 1].map((o, k) => (
              <Stop key={o} offset={`${o}`} stopColor="#FFFFFF" stopOpacity={glow[k]} />
            ))}
          </RadialGradient>
          <RadialGradient id={`${id}c`} cx="40%" cy="36%" r="70%">
            <Stop offset="0" stopColor={core[0]} />
            <Stop offset="1" stopColor={core[1]} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill={`url(#${id}g)`} />
        <Circle cx={c} cy={c} r={r} fill={`url(#${id}c)`} />
        {kind === "moon" ? (
          <G opacity={0.5}>
            {MOON_CRATERS.map(([dx, dy, k], i) => (
              <Circle key={`cr${i}`} cx={c + r * dx} cy={c + r * dy} r={r * k} fill="#8F8F8F" fillOpacity={0.45} />
            ))}
          </G>
        ) : null}
        <Circle cx={c} cy={c} r={r - 0.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1} />
      </Svg>
    </Animated.View>
  );
}

const MOON_CRATERS: [dx: number, dy: number, radius: number][] = [
  [-0.32, -0.18, 0.2],
  [0.28, 0.1, 0.27],
  [-0.08, 0.42, 0.13],
  [0.36, -0.42, 0.09],
  [-0.5, 0.24, 0.07],
];

/* ---------------------------- Landscape ---------------------------- */

type Wave = [amp: number, length: number, phase: number];

function crestY(x: number, base: number, waves: Wave[]) {
  return waves.reduce((y, [a, l, p]) => y - a * Math.sin((2 * Math.PI * x) / l + p), base);
}

function hillPaths(width: number, height: number, base: number, waves: Wave[]) {
  const pts: string[] = [];
  for (let x = 0; x <= width + 6; x += 6) pts.push(`${x.toFixed(1)} ${crestY(x, base, waves).toFixed(1)}`);
  const crest = `M${pts.join(" L")}`;
  return { fill: `${crest} L${width + 6} ${height} L0 ${height} Z`, crest };
}

const WAVES: Record<HillKind, Wave[]> = {
  far: [
    [16, 420, 0.4],
    [7, 150, 1.9],
    [3, 61, 0.2],
  ],
  mid: [
    [12, 330, 2.4],
    [6, 128, 0.7],
  ],
  near: [
    [10, 520, 1.1],
    [5, 190, 2.8],
  ],
};

type HillKind = "far" | "mid" | "near";

/** Atmospheric perspective: distant land hazes toward the sky; near land falls into shadow. */
function hillStops(kind: HillKind, c: string): [number, string][] {
  if (kind === "far") return [[0, mix(c, "#FFFFFF", 0.04)], [0.3, mix(c, "#FFFFFF", 0.1)], [1, mix(c, "#FFFFFF", 0.22)]];
  if (kind === "mid") return [[0, mix(c, "#FFFFFF", 0.06)], [0.3, c], [1, mix(c, "#000000", 0.45)]];
  return [[0, mix(c, "#FFFFFF", 0.08)], [0.05, c], [0.4, mix(c, "#000000", 0.45)], [1, mix(c, "#000000", 0.75)]];
}

type TreeSpec = { page: number; x: number; size: number; kind: "round" | "pine"; grow?: "always" | "final" };

const TREES: TreeSpec[] = [
  { page: 0, x: 0.66, size: 46, kind: "round", grow: "always" },
  { page: 1, x: 0.24, size: 52, kind: "round" },
  { page: 1, x: 0.4, size: 40, kind: "pine" },
  { page: 1, x: 0.86, size: 58, kind: "round" },
  { page: 2, x: 0.08, size: 44, kind: "pine" },
  { page: 2, x: 0.3, size: 62, kind: "round" },
  { page: 2, x: 0.47, size: 38, kind: "pine" },
  { page: 2, x: 0.62, size: 54, kind: "round" },
  { page: 2, x: 0.8, size: 42, kind: "pine" },
  { page: 3, x: 0.18, size: 50, kind: "round" },
  { page: 3, x: 0.36, size: 36, kind: "pine" },
  { page: 3, x: 0.58, size: 70, kind: "round", grow: "final" },
  { page: 3, x: 0.86, size: 46, kind: "pine" },
];

/** How strongly the land is lit on a step (0.12–1), and which way shadows fall (−1 left … 1 right). */
function lightOf(scene: OnboardingScene) {
  const moon = { ...scene.moon, altitude: scene.moon.altitude * 0.7 };
  const key = scene.sun.altitude >= moon.altitude ? scene.sun : moon;
  return { strength: clamp(key.altitude / 180, 0.12, 1), cast: clamp((0.5 - key.x) * 2, -1, 1) };
}

function Landscape({ w, h, steps, accent, pos, intro, plant, reduced, ground }: SceneProps) {
  const n = steps.length;

  /* Each layer is wide enough for its parallax travel plus rubber-band overscroll at both ends. */
  const layers = useMemo(() => {
    const make = (rate: number, lift: number) => {
      const pad = Math.ceil(w * rate * 0.62) + 8;
      const width = w * (1 + rate * Math.max(0, n - 1)) + pad * 2;
      const style = [
        styles.layer,
        styles.noTouch,
        {
          width,
          left: -pad,
          transform: [
            { translateX: Animated.multiply(pos, reduced ? 0 : -w * rate) },
            { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : lift, 0], easing: EASE_OUT }) },
          ],
        },
      ];
      return { pad, width, style };
    };
    return { far: make(RATE.far, 10), mist: make(RATE.mist, 14), mid: make(RATE.mid, 18), near: make(RATE.near, 28) };
  }, [pos, intro, reduced, w, n]);

  const paths = useMemo(
    () => ({
      far: hillPaths(layers.far.width, h, ground.horizon, WAVES.far),
      mid: hillPaths(layers.mid.width, h, ground.mid, WAVES.mid),
      near: hillPaths(layers.near.width, h, ground.near, WAVES.near),
    }),
    [layers, h, ground.horizon, ground.mid, ground.near],
  );

  /* Light per step: how bright the crests catch, how dark and which way the trees' shadows fall, how much mist. */
  const light = useMemo(() => {
    const lit = steps.map((s) => lightOf(s.scene));
    return {
      rim: perStep(pos, lit.map((l) => 0.12 + l.strength * 0.4)),
      shadow: perStep(pos, lit.map((l) => 0.18 + l.strength * 0.42)),
      cast: perStep(pos, lit.map((l) => l.cast)),
      mist: perStep(pos, steps.map((s) => s.scene.mist)),
    };
  }, [pos, steps]);

  const lands = useMemo(() => [0, 1, 2].map((k) => steps.map((s) => s.scene.land[k])), [steps]);

  return (
    <>
      <Animated.View style={layers.far.style}>
        <Hill kind="far" width={layers.far.width} height={h} paths={paths.far} colors={lands[0]} pos={pos} rim={light.rim} />
      </Animated.View>
      <Animated.View style={layers.mist.style}>
        <Mist width={layers.mist.width} top={ground.horizon + 4} bottom={ground.mid + 2} opacity={light.mist} />
      </Animated.View>
      <Animated.View style={layers.mid.style}>
        <Hill kind="mid" width={layers.mid.width} height={h} paths={paths.mid} colors={lands[1]} pos={pos} rim={light.rim} />
      </Animated.View>
      <Animated.View style={layers.near.style}>
        <Hill kind="near" width={layers.near.width} height={h} paths={paths.near} colors={lands[2]} pos={pos} rim={light.rim} />
        {TREES.filter((t) => t.page < n).map((t, k, all) => {
          // With reduced motion the land stays put, so the whole grove shares the one visible window.
          const x = reduced
            ? layers.near.pad + w * (0.05 + (0.9 * (((k * 7) % all.length) + 0.5)) / all.length)
            : layers.near.pad + t.page * w * RATE.near + t.x * w;
          return (
            <Tree
              key={`t${k}`}
              spec={t}
              x={x}
              y={crestY(x, ground.near, WAVES.near)}
              accent={accent}
              pos={pos}
              plant={plant}
              reduced={reduced}
              last={n - 1}
              cast={light.cast}
              shade={light.shadow}
            />
          );
        })}
      </Animated.View>
    </>
  );
}

/** One ridge, drawn once per step's grey and cross-faded like the sky, with a crest that catches the light. */
function Hill({
  kind,
  width,
  height,
  paths,
  colors,
  pos,
  rim,
}: {
  kind: HillKind;
  width: number;
  height: number;
  paths: { fill: string; crest: string };
  colors: string[];
  pos: Animated.Value;
  rim: Animated.WithAnimatedValue<number>;
}) {
  const id = useSvgId(`h${kind}`);
  return (
    <>
      <CrossfadeStack pos={pos} count={colors.length}>
        {(i) => (
          <Svg width={width} height={height}>
            <Defs>
              <SvgGradient id={`${id}${i}`} x1="0" y1="0" x2="0" y2="1">
                {hillStops(kind, colors[i]).map(([o, col]) => (
                  <Stop key={`${o}`} offset={`${o}`} stopColor={col} />
                ))}
              </SvgGradient>
            </Defs>
            <Path d={paths.fill} fill={`url(#${id}${i})`} />
          </Svg>
        )}
      </CrossfadeStack>
      <Animated.View style={[StyleSheet.absoluteFill, styles.noTouch, { opacity: rim }]}>
        <Svg width={width} height={height}>
          <Path d={paths.crest} stroke="#FFFFFF" strokeOpacity={kind === "near" ? 0.5 : kind === "mid" ? 0.42 : 0.6} strokeWidth={1} fill="none" />
        </Svg>
      </Animated.View>
    </>
  );
}

const MIST_SPACING = 96;

/** Long, soft banks of mist lying in the valleys. */
function Mist({ width, top, bottom, opacity }: { width: number; top: number; bottom: number; opacity: Animated.WithAnimatedValue<number> }) {
  const id = useSvgId("mist");
  const banks = useMemo(() => {
    const rnd = seeded(5);
    // Banks wander between the far valley and the near one, so the mist never reads as a ruled stripe.
    return Array.from({ length: Math.ceil(width / MIST_SPACING) }, (_, i) => ({
      x: i * MIST_SPACING + rnd() * 70,
      y: top + rnd() * (bottom - top),
      rx: 70 + rnd() * 90,
      ry: 7 + rnd() * 9,
      o: 0.45 + rnd() * 0.55,
    }));
  }, [width, top, bottom]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.noTouch, { opacity }]}>
      <Svg width={width} height={bottom + 40}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {banks.map((b, i) => (
          <Ellipse key={`m${i}`} cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} fill={`url(#${id})`} fillOpacity={b.o} />
        ))}
      </Svg>
    </Animated.View>
  );
}

function Tree({
  spec,
  x,
  y,
  accent,
  pos,
  plant,
  reduced,
  last,
  cast,
  shade,
}: {
  spec: TreeSpec;
  x: number;
  y: number;
  accent: string;
  pos: Animated.Value;
  plant: Animated.Value;
  reduced: boolean;
  last: number;
  /** Which way the shadow falls, −1 … 1. */
  cast: Animated.WithAnimatedValue<number>;
  /** Shadow strength. */
  shade: Animated.WithAnimatedValue<number>;
}) {
  const id = useSvgId("tr");
  const W = spec.size * (reduced ? REDUCED_TREE_SCALE : 1);
  const H = W * 1.35;
  const final = spec.grow === "final";

  const motion = useMemo(() => {
    let grow: Animated.WithAnimatedValue<number>;
    if (final) grow = plant;
    else if (spec.grow === "always") grow = pos.interpolate({ inputRange: [0, Math.min(1, last)], outputRange: [0.55, 1], extrapolate: "clamp" });
    else if (reduced) grow = pos.interpolate({ inputRange: [spec.page - 0.5, spec.page - 0.49], outputRange: [0, 1], extrapolate: "clamp" });
    else grow = pos.interpolate({ inputRange: [spec.page - 0.75, spec.page - 0.05], outputRange: [0, 1], extrapolate: "clamp" });
    return {
      // Grow from the foot of the trunk.
      tree: { transform: [{ translateY: H / 2 }, { scale: grow }, { translateY: -H / 2 }] },
      shadow: { opacity: shade, transform: [{ translateX: Animated.multiply(cast, W * 0.42) }] },
      glow: final ? plant.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 0.5] }) : 0,
    };
  }, [final, spec.grow, spec.page, pos, plant, reduced, last, H, W, cast, shade]);

  const leaf = { lit: mix(accent, "#FFFFFF", 0.28), mid: accent, deep: mix(accent, "#000000", 0.62) };

  return (
    <Animated.View style={[styles.abs, { left: x - W / 2, top: y - H + 3, width: W, height: H }, motion.tree]}>
      {final ? (
        <Animated.View style={{ position: "absolute", left: -W, top: -H * 0.4, width: W * 3, height: H * 1.6, opacity: motion.glow }}>
          <Svg width={W * 3} height={H * 1.6}>
            <Defs>
              <RadialGradient id={`${id}glow`} cx="50%" cy="55%" r="50%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.55} />
                <Stop offset="0.45" stopColor={accent} stopOpacity={0.18} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={W * 1.5} cy={H * 0.88} rx={W * 1.5} ry={H * 0.8} fill={`url(#${id}glow)`} />
          </Svg>
        </Animated.View>
      ) : null}

      {/* Contact shadow, thrown away from the light. */}
      <Animated.View style={[{ position: "absolute", left: -W * 0.2, top: H - 7, width: W * 1.4, height: 10 }, motion.shadow]}>
        <Svg width={W * 1.4} height={10}>
          <Defs>
            <RadialGradient id={`${id}s`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.9} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.7} cy={5} rx={W * 0.62} ry={4} fill={`url(#${id}s)`} />
        </Svg>
      </Animated.View>

      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id={`${id}c`} cx="34%" cy="26%" r="80%">
            <Stop offset="0" stopColor={leaf.lit} />
            <Stop offset="0.45" stopColor={leaf.mid} />
            <Stop offset="1" stopColor={leaf.deep} />
          </RadialGradient>
          <SvgGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={leaf.mid} />
            <Stop offset="1" stopColor={leaf.deep} />
          </SvgGradient>
        </Defs>
        {spec.kind === "round" ? (
          <G>
            <Path d={`M${W / 2 - 1.6} ${H} L${W / 2 - 1.1} ${H * 0.52} L${W / 2 + 1.1} ${H * 0.52} L${W / 2 + 1.6} ${H} Z`} fill={INK.bark} />
            <Circle cx={W * 0.36} cy={H * 0.5} r={W * 0.24} fill={`url(#${id}c)`} />
            <Circle cx={W * 0.64} cy={H * 0.46} r={W * 0.26} fill={`url(#${id}c)`} />
            <Circle cx={W * 0.5} cy={H * 0.32} r={W * 0.3} fill={`url(#${id}c)`} />
            <Circle cx={W * 0.42} cy={H * 0.24} r={W * 0.12} fill="#FFFFFF" fillOpacity={0.14} />
            {final ? BLOSSOMS.map(([fx, fy]) => <Circle key={`${fx}`} cx={W * fx} cy={H * fy} r={1.8} fill="#FFFFFF" fillOpacity={0.9} />) : null}
          </G>
        ) : (
          <G>
            <Path d={`M${W / 2 - 1.3} ${H} L${W / 2 - 1} ${H * 0.7} L${W / 2 + 1} ${H * 0.7} L${W / 2 + 1.3} ${H} Z`} fill={INK.bark} />
            <Path
              d={`M${W / 2} ${H * 0.04} C${W * 0.58} ${H * 0.22} ${W * 0.74} ${H * 0.5} ${W * 0.82} ${H * 0.74} Q${W / 2} ${H * 0.82} ${W * 0.18} ${H * 0.74} C${W * 0.26} ${H * 0.5} ${W * 0.42} ${H * 0.22} ${W / 2} ${H * 0.04} Z`}
              fill={`url(#${id}p)`}
            />
            <Path
              d={`M${W / 2} ${H * 0.1} C${W * 0.46} ${H * 0.3} ${W * 0.36} ${H * 0.5} ${W * 0.3} ${H * 0.68}`}
              stroke="#FFFFFF"
              strokeOpacity={0.16}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

/** With reduced motion the whole grove shares one screen, so each tree is drawn a little smaller. */
const REDUCED_TREE_SCALE = 0.78;

const BLOSSOMS: [number, number][] = [
  [0.32, 0.36],
  [0.56, 0.22],
  [0.7, 0.42],
  [0.46, 0.5],
  [0.62, 0.32],
];

/** Fine, irregular dither so the big grey gradients never band. */
const GRAIN = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 240 }, () => ({ x: Math.floor(rnd() * 96), y: Math.floor(rnd() * 96), light: rnd() > 0.5 }));
})();

function Grain({ w, h }: { w: number; h: number }) {
  const id = useSvgId("gr");
  return (
    <View style={[StyleSheet.absoluteFill, styles.noTouch]}>
      <Svg width={w} height={h}>
        <Defs>
          <Pattern id={id} x={0} y={0} width={96} height={96} patternUnits="userSpaceOnUse">
            {GRAIN.map((g, i) => (
              <Rect key={`g${i}`} x={g.x} y={g.y} width={1} height={1} fill={g.light ? "#FFFFFF" : "#000000"} fillOpacity={g.light ? 0.05 : 0.14} />
            ))}
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({
  brand,
  accent,
  pos,
  intro,
  last,
  index,
  done,
  reduced,
  skipLabel,
  onBack,
  onSkip,
}: {
  brand: string;
  accent: string;
  pos: Animated.Value;
  intro: Animated.Value;
  last: number;
  index: number;
  done: boolean;
  reduced: boolean;
  skipLabel: string;
  onBack: () => void;
  onSkip: () => void;
}) {
  const motion = useMemo(() => {
    const arrive = intro.interpolate({ inputRange: [0.15, 0.65], outputRange: [0, 1], easing: EASE_OUT, extrapolate: "clamp" });
    return {
      brand: revealStyle(arrive, reduced, 6, 4),
      back: Animated.multiply(arrive, pos.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" })),
      backX: pos.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : -8, 0], extrapolate: "clamp" }),
      skip: Animated.multiply(arrive, pos.interpolate({ inputRange: [last - 1, last], outputRange: [1, 0], extrapolate: "clamp" })),
    };
  }, [intro, pos, last, reduced]);
  const backFade = done ? 0 : motion.back;
  const skipFade = done ? 0 : motion.skip;

  return (
    <View style={styles.topBar}>
      <Animated.View style={{ transform: [{ translateX: motion.backX }], pointerEvents: index === 0 || done ? "none" : "auto" }}>
        <Squish reduced={reduced} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" accessibilityHint="Goes to the previous step" hitSlop={6} {...demoTarget("back")}>
          <Glass radius={20} wash={GLASS.control} fade={backFade} style={styles.roundBtn}>
            <Animated.View aria-hidden style={{ opacity: backFade }}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M14.5 5.5 8 12l6.5 6.5" stroke={INK.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Animated.View>
          </Glass>
        </Squish>
      </Animated.View>

      <Animated.View style={[styles.brand, motion.brand]} accessibilityRole="header" accessibilityLabel={brand}>
        <View aria-hidden>
          <BrandMark accent={accent} />
        </View>
        <Text style={styles.brandText}>{brand}</Text>
      </Animated.View>

      <View style={{ pointerEvents: index === last || done ? "none" : "auto" }}>
        <Squish reduced={reduced} onPress={onSkip} accessibilityRole="button" accessibilityLabel={`${skipLabel} to the last step`} hitSlop={6} {...demoTarget("skip")}>
          <Glass radius={20} wash={GLASS.control} fade={skipFade} style={styles.skipBtn}>
            <Animated.Text style={[styles.skipText, { opacity: skipFade }]}>{skipLabel}</Animated.Text>
          </Glass>
        </Squish>
      </View>
    </View>
  );
}

function BrandMark({ accent }: { accent: string }) {
  const id = useSvgId("bm");
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={mix(accent, "#FFFFFF", 0.2)} />
          <Stop offset="1" stopColor={mix(accent, "#000000", 0.35)} />
        </SvgGradient>
      </Defs>
      <Path d="M12 22V12.5" stroke={INK.text} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 13C12 7 15.6 3 21 2.8 21 8.4 17.6 12.6 12 13Z" fill={`url(#${id})`} />
      <Path d="M12 15.5C12 11.4 9.4 8.8 5.2 8.6 5.2 12.6 7.8 15.4 12 15.5Z" fill={`url(#${id})`} opacity={0.7} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Card and copy                                                       */
/* ------------------------------------------------------------------ */

function Card({
  top,
  height,
  intro,
  landed,
  reduced,
  children,
}: {
  top: number;
  height: number;
  intro: Animated.Value;
  landed: boolean;
  reduced: boolean;
  children: ReactNode;
}) {
  const motion = useMemo(
    () => ({
      glass: intro.interpolate({ inputRange: [0, 0.45], outputRange: [0, 1], extrapolate: "clamp" }),
      rise: intro.interpolate({ inputRange: [0, 0.8], outputRange: [reduced ? 0 : 28, 0], easing: EASE_OUT, extrapolate: "clamp" }),
    }),
    [intro, reduced],
  );
  return (
    <Animated.View style={[styles.cardWrap, { top, height }, landed ? null : { transform: [{ translateY: motion.rise }] }]}>
      <Glass radius={32} intensity={60} wash={GLASS.card} fade={motion.glass} shadow={CARD_SHADOW} style={StyleSheet.absoluteFill} />
      <View style={styles.cardInner}>{children}</View>
    </Animated.View>
  );
}

const CARD_SHADOW = "0 30px 70px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.35)";

/** One step's words. Slides with the drag, and staggers in from a blur whenever its step becomes the current one. */
function StepCopy({
  step,
  i,
  pos,
  t,
  w,
  compact,
  reduced,
}: {
  step: OnboardingStep;
  i: number;
  pos: Animated.Value;
  t: Animated.Value;
  w: number;
  compact: boolean;
  reduced: boolean;
}) {
  const motion = useMemo(() => {
    const travel = reduced ? 0 : w * RATE.copy;
    return {
      page: {
        opacity: pageWindow(pos, i, 0.55),
        transform: [{ translateX: pos.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [travel, 0, -travel] }) }],
      },
      kicker: revealStyle(cueNode(t, CUE.kicker), reduced, 8, 4),
      title: revealStyle(cueNode(t, CUE.title), reduced, 12, 7),
      body: revealStyle(cueNode(t, CUE.body), reduced, 12, 5),
    };
  }, [pos, t, i, w, reduced]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.copy, motion.page]}>
      <Animated.Text style={[styles.kicker, motion.kicker]}>{step.kicker}</Animated.Text>
      <Animated.Text style={[styles.title, compact && styles.titleCompact, motion.title]} accessibilityRole="header">
        {step.title}
      </Animated.Text>
      <Animated.Text style={[styles.body, compact && styles.bodyCompact, motion.body]}>{step.body}</Animated.Text>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Glass chips                                                         */
/* ------------------------------------------------------------------ */

function StepChip({
  chip,
  i,
  pos,
  t,
  w,
  top,
  side,
  accent,
  reduced,
  active,
}: {
  chip: OnboardingChip;
  i: number;
  pos: Animated.Value;
  t: Animated.Value;
  w: number;
  top: number;
  side: "left" | "right";
  accent: string;
  reduced: boolean;
  active: boolean;
}) {
  const motion = useMemo(() => {
    const travel = reduced ? 0 : w * RATE.chip;
    const arrive = cueNode(t, CUE.chip);
    const fade = Animated.multiply(arrive, pageWindow(pos, i, 0.7));
    return {
      fade,
      wrap: {
        transform: [
          { translateX: pos.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [travel, 0, -travel] }) },
          { translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 14, 0] }) },
        ],
      },
      content: { ...revealStyle(arrive, reduced, 0, 5), opacity: fade },
      figure: cueNode(t, CUE.figure),
      badge: cueNode(t, CUE.badge),
    };
  }, [pos, t, i, w, reduced]);

  return (
    <Animated.View style={[styles.chipWrap, { top, [side]: 20 }, motion.wrap]}>
      <Glass radius={22} intensity={30} wash={GLASS.chip} fade={motion.fade} shadow={CHIP_SHADOW} style={styles.chip}>
        <Animated.View style={[styles.chipRow, motion.content]}>
          <View style={styles.chipIcon} aria-hidden>
            <ChipFigure chip={chip} accent={accent} progress={motion.figure} t={t} reduced={reduced} active={active} />
          </View>
          <View style={styles.chipText}>
            <CountUp text={chip.value} t={t} cue={CUE.data} reduced={reduced} style={styles.chipValue} />
            <Text style={styles.chipLabel} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
          {chip.kind === "focus" ? <GrowthBadge text={chip.badge} accent={accent} pop={motion.badge} reduced={reduced} /> : null}
        </Animated.View>
      </Glass>
    </Animated.View>
  );
}

const CHIP_SHADOW = "0 18px 40px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)";

/** "+1": the one accent on the chip, popping in last with a single small overshoot. */
function GrowthBadge({ text, accent, pop, reduced }: { text: string; accent: string; pop: Animated.AnimatedInterpolation<number>; reduced: boolean }) {
  const style = useMemo(
    () => ({
      opacity: pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
      transform: [{ scale: reduced ? 1 : pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.08, 1] }) }],
    }),
    [pop, reduced],
  );
  return (
    <Animated.View style={[styles.badge, { backgroundColor: alpha(accent, 0.14), borderColor: alpha(accent, 0.32) }, style]}>
      <Svg width={12} height={12} viewBox="0 0 24 24">
        <Path d={LEAF_GLYPH} stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
      <Text style={[styles.badgeText, { color: accent }]}>{text}</Text>
    </Animated.View>
  );
}

const LEAF_GLYPH = "M12 20v-7M12 13c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5ZM12 15c0-3.2-2.4-5.2-5.6-5.2 0 3.2 2.4 5.2 5.6 5.2Z";

/** Icon glyphs drawn on a 24pt grid; each stroke draws itself in on the figure cue. */
const GLYPH = {
  focus: ["M12 20.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z", "M12 9.2V13l2.6 1.6M10 3.5h4M12 3.5v2"],
  reminder: ["M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5Z", "M10 20.5a2.2 2.2 0 0 0 4 0"],
} as const;
/** Longer than any glyph stroke, so a dash this size hides then reveals the whole path. */
const GLYPH_DASH = 64;

function ChipFigure({
  chip,
  accent,
  progress,
  t,
  reduced,
  active,
}: {
  chip: OnboardingChip;
  accent: string;
  progress: Animated.AnimatedInterpolation<number>;
  t: Animated.Value;
  reduced: boolean;
  active: boolean;
}) {
  if (chip.kind === "breath") return <BreathRing progress={progress} reduced={reduced} active={active} />;
  if (chip.kind === "week") return <WeekBars bars={chip.bars} accent={accent} t={t} reduced={reduced} />;
  return <DrawnGlyph paths={GLYPH[chip.kind]} progress={progress} reduced={reduced} />;
}

function DrawnGlyph({ paths, progress, reduced }: { paths: readonly string[]; progress: Animated.AnimatedInterpolation<number>; reduced: boolean }) {
  const offset = useMemo(() => (reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [GLYPH_DASH, 0] })), [progress, reduced]);
  return (
    <View style={styles.iconDisc}>
      <View>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          {paths.map((d) => (
            <AnimatedPath
              key={d}
              d={d}
              stroke={INK.text}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${GLYPH_DASH} ${GLYPH_DASH}`}
              strokeDashoffset={offset}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const BREATH = { size: 40, r: 15, sweep: 0.72 } as const;

/** A two-minute ring that draws along its path, with a dot that breathes while its step is showing. */
function BreathRing({ progress, reduced, active }: { progress: Animated.AnimatedInterpolation<number>; reduced: boolean; active: boolean }) {
  const id = useSvgId("br");
  const breathe = useAnimatedNumber(0);
  const c = 2 * Math.PI * BREATH.r;
  const mid = BREATH.size / 2;

  useEffect(() => {
    if (reduced || !active) {
      breathe.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2400, easing: EASE_IN_OUT, useNativeDriver: ND }),
        Animated.timing(breathe, { toValue: 0, duration: 2400, easing: EASE_IN_OUT, useNativeDriver: ND }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, active, breathe]);

  const motion = useMemo(
    () => ({
      offset: progress.interpolate({ inputRange: [0, 1], outputRange: [c, c * (1 - BREATH.sweep)] }),
      dot: {
        opacity: Animated.multiply(progress, breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] })),
        transform: [{ scale: Animated.multiply(progress, breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] })) }],
      },
    }),
    [progress, breathe, c],
  );

  return (
    <View style={styles.breath}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={BREATH.size} height={BREATH.size}>
          <Defs>
            <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#9A9A9A" />
            </SvgGradient>
          </Defs>
          <Circle cx={mid} cy={mid} r={BREATH.r} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={3} fill="none" />
          <AnimatedCircle
            cx={mid}
            cy={mid}
            r={BREATH.r}
            stroke={`url(#${id})`}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={motion.offset}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        </Svg>
      </View>
      <Animated.View style={[styles.breathDot, motion.dot]} />
    </View>
  );
}

/** Bar geometry, and how far apart (in timeline fractions) neighbouring bars start growing. */
const BAR = { width: 4, gap: 2, max: 26, min: 6, stagger: 0.05 } as const;

/** Seven days of trees; bars grow from the baseline left to right, the best day in the accent. */
function WeekBars({ bars, accent, t, reduced }: { bars: number[]; accent: string; t: Animated.Value; reduced: boolean }) {
  const days = useMemo(() => bars.slice(0, 7), [bars]);
  const best = days.indexOf(Math.max(...days));
  const grows = useMemo(
    () =>
      days.map((_, i) => {
        const g = cueNode(t, [CUE.figure[0] + i * BAR.stagger, Math.min(1, CUE.figure[1] + i * BAR.stagger * 0.6)]);
        return reduced ? { opacity: g } : { opacity: g, transform: [{ scaleY: g }] };
      }),
    [t, days, reduced],
  );
  return (
    <View style={styles.week}>
      {days.map((b, i) => {
        const height = BAR.min + b * (BAR.max - BAR.min);
        return (
          // The wrapper sits on the baseline so scaleY grows the bar upward from it.
          <View key={`b${i}`} style={[styles.barSlot, { height: BAR.max }]}>
            <Animated.View
              style={[
                { width: BAR.width, height, borderRadius: BAR.width / 2, transformOrigin: "bottom", backgroundColor: i === best ? accent : "rgba(255,255,255,0.34)" },
                grows[i],
              ]}
            />
          </View>
        );
      })}
      <View style={styles.weekBase} />
    </View>
  );
}

/** Splits text into literal and digit runs; a digit run after a colon is minutes and keeps its zeros. */
function digitRuns(text: string) {
  const parts = text.split(/(\d+)/);
  return parts.map((part, k) => ({ part, digits: k % 2 === 1, minutes: parts[k - 1]?.endsWith(":") ?? false }));
}

/** U+2007 is as wide as a tabular digit, so a counting number never changes width. */
const FIGURE_SPACE = " ";

/**
 * Counts every number in `text` up from zero across a cue, with tabular numerals that never reflow,
 * and settles from a soft blur as it lands. Minutes after a colon keep their leading zero.
 */
function CountUp({ text, t, cue, reduced, style }: { text: string; t: Animated.Value; cue: Cue; reduced: boolean; style: StyleProp<TextStyle> }) {
  const runs = useMemo(() => digitRuns(text), [text]);
  const format = useMemo(
    () => (f: number) =>
      runs
        .map(({ part, digits, minutes }) => (digits ? String(Math.round(Number(part) * f)).padStart(part.length, minutes ? "0" : FIGURE_SPACE) : part))
        .join(""),
    [runs],
  );
  const [shown, setShown] = useState(() => format(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) {
      setShown(format(1));
      return;
    }
    const id = t.addListener(({ value }) => {
      const next = format(cueProgress(value, cue));
      setShown((p) => (p === next ? p : next));
    });
    return () => t.removeListener(id);
  }, [t, cue, format, reduced]);

  const settle = useMemo(() => revealStyle(cueNode(t, cue), reduced, 0, 3), [t, cue, reduced]);
  return (
    <Animated.Text style={[style, settle]} numberOfLines={1} accessibilityLabel={text}>
      {shown}
    </Animated.Text>
  );
}

/* ------------------------------------------------------------------ */
/* Progress: dots that stretch into a pill, built from transforms only */
/* ------------------------------------------------------------------ */

const DOT = 7;
const PILL = 26;
const DOT_GAP = 6;
/** The bar between a dot's caps is drawn at this width and scaled on X. */
const SPAN = 10;

function Progress({ pos, intro, n, reduced }: { pos: Animated.Value; intro: Animated.Value; n: number; reduced: boolean }) {
  const dots = useMemo(() => {
    const widths = Array.from({ length: n }, (_, i) =>
      pos.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [DOT, PILL, DOT], extrapolate: "clamp" }),
    );
    const starts: Animated.AnimatedNode[] = [];
    widths.forEach((_, i) => starts.push(i === 0 ? new Animated.Value(0) : Animated.add(Animated.add(starts[i - 1], widths[i - 1]), DOT_GAP)));
    return widths.map((wv, i) => {
      const x = starts[i] as Animated.Value;
      // First view: the dots arrive last, after the words, one by one.
      const arrive = intro.interpolate({ inputRange: [0.62 + i * 0.06, Math.min(1, 0.86 + i * 0.05)], outputRange: [0, 1], easing: EASE_OUT, extrapolate: "clamp" });
      return {
        group: {
          opacity: Animated.multiply(arrive, pageWindow(pos, i, 1).interpolate({ inputRange: [0, 1], outputRange: [0.22, 1] })),
          transform: reduced ? [] : [{ translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
        },
        start: { transform: [{ translateX: x }] },
        end: { transform: [{ translateX: Animated.add(x, Animated.add(wv, -DOT)) }] },
        span: {
          transform: [{ translateX: Animated.add(x, Animated.multiply(wv, 0.5)) }, { translateX: -SPAN / 2 }, { scaleX: Animated.multiply(Animated.add(wv, -DOT), 1 / SPAN) }],
        },
      };
    });
  }, [pos, intro, n, reduced]);

  return (
    <View style={{ width: DOT * (n - 1) + PILL + DOT_GAP * (n - 1), height: DOT }} aria-hidden>
      {dots.map((d, i) => (
        <Animated.View key={`d${i}`} needsOffscreenAlphaCompositing style={[StyleSheet.absoluteFill, d.group]}>
          <Animated.View style={[styles.cap, d.start]} />
          <Animated.View style={[styles.cap, d.end]} />
          <Animated.View style={[styles.span, d.span]} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Where the clock winds up from 00:00 on the intro timeline. */
const CLOCK_WIND: Cue = [0.3, 1];

/** The time of day. It winds up from 00:00 on the first view, then ticks forward with the drag. */
function Clock({ pos, intro, steps, reduced }: { pos: Animated.Value; intro: Animated.Value; steps: OnboardingStep[]; reduced: boolean }) {
  const at = useMemo(() => {
    const mins = steps.map((s) => s.minutes);
    return (v: number) => {
      if (mins.length < 2) return mins[0] ?? 0;
      // Settle on the step's own time once the spring is within a hair of the page.
      const snapped = Math.abs(v - Math.round(v)) < 0.03 ? Math.round(v) : v;
      const c = clamp(snapped, 0, mins.length - 1);
      const i = Math.min(mins.length - 2, Math.floor(c));
      return Math.round(mins[i] + (mins[i + 1] - mins[i]) * (c - i));
    };
  }, [steps]);
  const [m, setM] = useState(() => (reduced ? at(0) : 0));

  useEffect(() => {
    const live = { page: 0, wind: reduced ? 1 : 0 };
    const update = () => {
      const next = Math.round(at(live.page) * live.wind);
      setM((p) => (p === next ? p : next));
    };
    const a = pos.addListener(({ value }) => {
      live.page = value;
      update();
    });
    const b = intro.addListener(({ value }) => {
      if (reduced) return;
      live.wind = cueProgress(value, CLOCK_WIND);
      update();
    });
    update();
    return () => {
      pos.removeListener(a);
      intro.removeListener(b);
    };
  }, [pos, intro, at, reduced]);

  const fade = useMemo(() => intro.interpolate({ inputRange: [0.25, 0.6], outputRange: [0, 1], extrapolate: "clamp" }), [intro]);
  return (
    <Animated.View style={[styles.clock, { opacity: fade }]} aria-hidden>
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={4} stroke={INK.faint} strokeWidth={1.8} fill="none" />
        <Path
          d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"
          stroke={INK.faint}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.clockText}>
        {String(Math.floor(m / 60)).padStart(2, "0")}:{String(m % 60).padStart(2, "0")}
      </Text>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Primary button with the planting flourish                           */
/* ------------------------------------------------------------------ */

const LEAVES = Array.from({ length: 14 }, (_, i) => {
  const a = (-174 + (i * 168) / 13) * (Math.PI / 180);
  const d = 64 + ((i * 37) % 5) * 12;
  return { dx: Math.cos(a) * d * 1.9, dy: Math.sin(a) * d * 0.95 - 6, rot: ((i * 71) % 220) - 110, s: 0.8 + ((i * 13) % 4) * 0.14, pale: i % 3 === 0 };
});

function Primary({
  pos,
  intro,
  last,
  accent,
  done,
  doneFade,
  burst,
  reduced,
  nextLabel,
  finishLabel,
  doneLabel,
  isLast,
  onPress,
}: {
  pos: Animated.Value;
  intro: Animated.Value;
  last: number;
  accent: string;
  done: boolean;
  doneFade: Animated.Value;
  burst: Animated.Value;
  reduced: boolean;
  nextLabel: string;
  finishLabel: string;
  doneLabel: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const id = useSvgId("cta");

  const m = useMemo(() => {
    const shift = (px: number) => (reduced ? 0 : px);
    const toFinal = pos.interpolate({ inputRange: [last - 0.6, last], outputRange: [0, 1], extrapolate: "clamp" });
    const next = pos.interpolate({ inputRange: [last - 0.6, last - 0.25], outputRange: [1, 0], extrapolate: "clamp" });
    const final = Animated.multiply(
      pos.interpolate({ inputRange: [last - 0.3, last], outputRange: [0, 1], extrapolate: "clamp" }),
      doneFade.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: "clamp" }),
    );
    const planted = doneFade.interpolate({ inputRange: [0.35, 1], outputRange: [0, 1], extrapolate: "clamp" });
    const arrive = intro.interpolate({ inputRange: [0.3, 0.8], outputRange: [0, 1], easing: EASE_OUT, extrapolate: "clamp" });
    return {
      arrive: revealStyle(arrive, reduced, 10, 0),
      faceFinal: { opacity: toFinal },
      faceDone: { opacity: doneFade },
      halo: {
        opacity: Animated.add(Animated.multiply(toFinal, 0.7), burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] })),
        transform: [
          { scaleX: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          { scaleY: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.8, 1.2] }) },
        ],
      },
      ring: {
        opacity: burst.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.9, 0] }),
        transform: [{ scaleX: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 4.4] }) }, { scaleY: burst.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }],
      },
      leaves: LEAVES.map((l) => ({
        opacity: burst.interpolate({ inputRange: [0, 0.05, 0.62, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, l.dx], easing: EASE_OUT }) },
          { translateY: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, l.dy, l.dy + 14], easing: EASE_OUT }) },
          { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${l.rot}deg`], easing: EASE_OUT }) },
          { scale: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, l.s, l.s * 0.85] }) },
        ],
      })),
      next: { opacity: next, transform: [{ translateY: next.interpolate({ inputRange: [0, 1], outputRange: [shift(-6), 0] }) }] },
      final: { opacity: final, transform: [{ translateY: Animated.multiply(Animated.add(final, -1), shift(-8)) }] },
      planted: { opacity: planted, transform: [{ translateY: planted.interpolate({ inputRange: [0, 1], outputRange: [shift(8), 0] }) }] },
    };
  }, [pos, intro, last, doneFade, burst, reduced]);

  const face = { lit: mix(accent, "#FFFFFF", 0.3), deep: mix(accent, "#000000", 0.14) };

  return (
    <Animated.View style={[styles.ctaWrap, m.arrive]}>
      {/* A soft accent halo arrives with the last step and blooms when the tree is planted. */}
      <Animated.View style={[styles.halo, m.halo]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity={0.4} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={50} cy={50} rx={50} ry={50} fill={`url(#${id}h)`} />
        </Svg>
      </Animated.View>

      <View style={styles.burstOrigin}>
        <Animated.View style={[styles.ring, { borderColor: alpha(accent, 0.85) }, m.ring]} />
        {LEAVES.map((l, i) => (
          <Animated.View key={`leaf${i}`} style={[styles.leaf, m.leaves[i]]}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M4 20C4 10 10 4 20 4 20 14 14 20 4 20Z" fill={l.pale ? "#E8E8E8" : accent} />
              <Path d="M5 19 15 9" stroke={l.pale ? "#9A9A9A" : "#FFFFFF"} strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        ))}
      </View>

      <Squish
        reduced={reduced}
        onPress={onPress}
        disabled={done}
        accessibilityRole="button"
        accessibilityLabel={done ? doneLabel : isLast ? finishLabel : nextLabel}
        accessibilityState={{ disabled: done }}
        style={styles.cta}
        {...demoTarget("next")}
      >
        <LinearGradient colors={["#FAFAFA", "#D6D6D6"]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, m.faceFinal]}>
          <LinearGradient colors={[face.lit, accent, face.deep]} locations={[0, 0.5, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, m.faceDone]}>
          <LinearGradient colors={[face.lit, face.lit]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, styles.ctaEdge]} />

        {/* Labels stack and crossfade with a small offset. */}
        <Animated.View style={[styles.ctaRow, m.next]}>
          <Text style={styles.ctaText}>{nextLabel}</Text>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke={INK.onLight} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.ctaRow, m.final]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M12 21v-8.5M12 12.5C12 7.5 15 4.5 19.5 4.3 19.5 9 16.6 12.4 12 12.5ZM12 15c0-3.4-2.3-5.6-5.8-5.7 0 3.4 2.3 5.6 5.8 5.7Z"
              stroke={INK.onLight}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
          <Text style={styles.ctaText}>{finishLabel}</Text>
        </Animated.View>
        <Animated.View style={[styles.ctaRow, m.planted]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12.5 10 17.5 19 7" stroke={INK.onLight} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.ctaText}>{doneLabel}</Text>
        </Animated.View>
      </Squish>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: INK.ground },
  noTouch: { pointerEvents: "none" },
  clip: { overflow: "hidden", pointerEvents: "none" },
  abs: { position: "absolute", left: 0, top: 0 },
  layer: { position: "absolute", left: 0, top: 0, bottom: 0 },
  topScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 150 },
  glassEdge: {
    pointerEvents: "none",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.4)",
  },

  topBar: {
    position: "absolute",
    top: LAYOUT.topBar,
    left: 0,
    right: 0,
    height: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  skipBtn: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  skipText: { userSelect: "none", fontSize: 15, fontWeight: "600", color: INK.text, letterSpacing: -0.2 },
  brand: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, pointerEvents: "none" },
  brandText: { userSelect: "none", fontSize: 20, fontWeight: "700", letterSpacing: -0.7, color: INK.text },

  chipWrap: { position: "absolute", maxWidth: 300, pointerEvents: "none" },
  chip: { paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  chipIcon: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  chipText: { flexShrink: 1 },
  chipValue: { userSelect: "none", fontSize: 16, fontWeight: "700", color: INK.text, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  chipLabel: { userSelect: "none", fontSize: 12.5, fontWeight: "500", color: INK.soft, marginTop: 1 },
  iconDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  breath: { width: BREATH.size, height: BREATH.size, alignItems: "center", justifyContent: "center" },
  breathDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFFFFF" },
  week: { flexDirection: "row", alignItems: "flex-end", gap: BAR.gap, height: 34, paddingBottom: 4 },
  barSlot: { justifyContent: "flex-end" },
  weekBase: { position: "absolute", left: -2, right: -2, bottom: 2, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.22)" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginLeft: 2 },
  badgeText: { userSelect: "none", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },

  cardWrap: { position: "absolute", left: LAYOUT.inset, right: LAYOUT.inset },
  cardInner: { flex: 1, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 20 },
  cardHead: { height: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copyArea: { flex: 1, marginTop: 18, marginHorizontal: -24, overflow: "hidden" },
  copy: { paddingHorizontal: 24, pointerEvents: "none" },
  kicker: { userSelect: "none", fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: INK.faint, marginBottom: 10 },
  title: { userSelect: "none", fontSize: 32, lineHeight: 35, fontWeight: "700", letterSpacing: -1.1, color: INK.text, marginBottom: 12 },
  titleCompact: { fontSize: 28, lineHeight: 31, letterSpacing: -0.9 },
  body: { userSelect: "none", fontSize: 16, lineHeight: 23, color: INK.soft, letterSpacing: -0.1 },
  bodyCompact: { fontSize: 15, lineHeight: 21 },
  cap: { position: "absolute", left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: INK.text },
  span: { position: "absolute", left: 0, top: 0, width: SPAN, height: DOT, backgroundColor: INK.text },
  clock: { flexDirection: "row", alignItems: "center", gap: 6 },
  clockText: { userSelect: "none", fontFamily: MONO, fontSize: 12, letterSpacing: 0.4, color: INK.faint, fontVariant: ["tabular-nums"] },

  ctaWrap: { height: 56, marginTop: 12 },
  halo: { pointerEvents: "none", position: "absolute", left: -24, right: -24, top: -26, bottom: -30 },
  burstOrigin: { pointerEvents: "none", position: "absolute", left: "50%", top: 28, width: 0, height: 0 },
  ring: { position: "absolute", left: -40, top: -40, width: 80, height: 80, borderRadius: 40, borderWidth: 1.5 },
  leaf: { position: "absolute", left: -10, top: -10 },
  cta: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 28px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
  },
  ctaEdge: { pointerEvents: "none", borderRadius: 28, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -1px 0 rgba(0,0,0,0.16)" },
  ctaRow: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { userSelect: "none", color: INK.onLight, fontSize: 17, fontWeight: "600", letterSpacing: -0.3 },
});

export default function MobileOnboardingDemo(props: Partial<MobileOnboardingProps> = {}) {
  const { step, ...overrides } = props;
  /* The Jump to buttons send the same `step` again after a manual swipe. Nothing else re-sends an
     identical set of props, so a parent render that changes nothing means "press again": bump the
     key to re-apply. Our own re-render (the key bump) hands back the same props object, so it is skipped. */
  const [stepKey, setStepKey] = useState(0);
  const seen = useRef<{ props: Partial<MobileOnboardingProps>; step?: number; sig: string } | null>(null);
  const sig = JSON.stringify(overrides);
  useEffect(() => {
    const before = seen.current;
    seen.current = { props, step, sig };
    if (before && before.props !== props && step !== undefined && before.step === step && before.sig === sig) setStepKey((k) => k + 1);
  });
  return <MobileOnboarding {...overrides} step={step} stepKey={stepKey} />;
}
