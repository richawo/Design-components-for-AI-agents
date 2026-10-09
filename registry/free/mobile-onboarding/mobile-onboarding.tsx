import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
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

export type OnboardingChip =
  | { kind: "breath"; value: string; label: string }
  | { kind: "focus"; value: string; label: string; badge: string }
  | { kind: "week"; value: string; label: string; bars: number[] }
  | { kind: "reminder"; value: string; label: string };

export type OnboardingStep = {
  /** Short kicker above the headline. */
  kicker: string;
  title: string;
  body: string;
  /** Minutes after midnight shown on the scene clock. The clock tweens between steps as you drag. */
  minutes: number;
  /** Sky gradient, top → horizon. The page blends between steps' skies as you swipe. */
  sky: [string, string, string];
  /** Hill colours for this time of day: far ridge, middle hills, near meadow. */
  land: [string, string, string];
  /** The small glass card floating over the landscape. */
  chip: OnboardingChip;
};

export type MobileOnboardingProps = {
  brand?: string;
  steps?: OnboardingStep[];
  skipLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Shown in the button once the first tree is planted. */
  doneLabel?: string;
  /** Called about a second after the final button is pressed, once the flourish has played. */
  onFinish?: () => void;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const INK = "#14201A";
const INK_SOFT = "rgba(20,32,26,0.66)";
const LEAF = ["#9CC79A", "#5C9469", "#2F5E45"] as const;
const PINE = ["#4E8462", "#2A563F"] as const;
const BARK = "#4A3A2C";
const ND = Platform.OS !== "web";
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    kicker: "Start small",
    title: "Two quiet minutes still count.",
    body: "Breathe, stretch, read a page. Grove counts a two-minute pause exactly like an hour of deep work.",
    minutes: 6 * 60 + 10,
    sky: ["#E9BFB9", "#F5D7C7", "#FCEBDC"],
    land: ["#C99FA3", "#93A68A", "#4E7C5C"],
    chip: { kind: "breath", value: "2:00", label: "Morning breath" },
  },
  {
    kicker: "Grow something",
    title: "Every session plants a tree.",
    body: "Finish a focus block and a sapling takes root on your hill. Stop early and it simply waits. Nothing wilts.",
    minutes: 9 * 60 + 30,
    sky: ["#F1DFB4", "#F7EBCB", "#FBF5E3"],
    land: ["#BDB8A0", "#86A783", "#4A8259"],
    chip: { kind: "focus", value: "Deep work", label: "25 min · Thesis draft", badge: "+1" },
  },
  {
    kicker: "Look back",
    title: "Watch the week take shape.",
    body: "A good week looks like a small forest. On Sunday evening Grove sends one honest page on what grew.",
    minutes: 15 * 60 + 45,
    sky: ["#9FC9DA", "#C9E2E4", "#F1F0DD"],
    land: ["#93B4BD", "#6E9E80", "#3E7752"],
    chip: { kind: "week", value: "14 trees", label: "This week", bars: [0.45, 0.7, 0.3, 0.9, 0.6, 1, 0.5] },
  },
  {
    kicker: "Begin",
    title: "Plant your first tree.",
    body: "Pick a moment that already exists in your day. We’ll nudge you once, gently, then get out of the way.",
    minutes: 19 * 60 + 20,
    sky: ["#EE9C6C", "#F6C597", "#FCE3C2"],
    land: ["#D49479", "#9C9862", "#56784A"],
    chip: { kind: "reminder", value: "Tomorrow, 7:30", label: "Morning breath · 2 min" },
  },
];

/* Parallax rates: how far each layer travels per page, as a fraction of the screen width. */
const RATE = { cloud: 0.12, far: 0.22, mid: 0.48, near: 0.8, chip: 1.12, copy: 0.32 };

/* ------------------------------------------------------------------ */
/* Hooks and small parts                                               */
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

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SquishProps = Omit<PressableProps, "style"> & {
  /** Scale while held: ~0.97 for buttons. */
  to?: number;
  reduced?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A Pressable that sinks on press and springs back with a hair of lift. */
function Squish({ to = 0.97, reduced, style, onPressIn, onPressOut, ...rest }: SquishProps) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduced) Animated.timing(scale, { toValue: to, duration: 90, easing: EASE_OUT, useNativeDriver: ND }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, stiffness: 420, damping: 22, mass: 1, useNativeDriver: ND }).start();
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}

/** Frosted glass: real backdrop blur, a faint inner gradient and a hairline edge that is brighter on top. */
function Glass({
  radius,
  style,
  children,
  intensity = 36,
  wash = ["rgba(255,255,255,0.58)", "rgba(255,255,255,0.26)"],
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  intensity?: number;
  wash?: [string, string];
}) {
  return (
    <View style={[{ borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden", pointerEvents: "none" }]}>
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={wash} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      {children}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            pointerEvents: "none",
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.5)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(20,32,26,0.06)",
          },
        ]}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Landscape geometry                                                  */
/* ------------------------------------------------------------------ */

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

const FAR: Wave[] = [
  [16, 420, 0.4],
  [7, 150, 1.9],
  [3, 61, 0.2],
];
const MID: Wave[] = [
  [12, 330, 2.4],
  [6, 128, 0.7],
];
const NEAR: Wave[] = [
  [10, 520, 1.1],
  [5, 190, 2.8],
];

type TreeSpec = { page: number; x: number; size: number; kind: "round" | "pine"; grow?: "always" | "page" | "final" };

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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function MobileOnboarding({
  brand = "grove",
  steps = DEFAULT_STEPS,
  skipLabel = "Skip",
  nextLabel = "Continue",
  finishLabel = "Plant my first tree",
  doneLabel = "Planted. See you at 7:30",
  onFinish,
}: MobileOnboardingProps) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const n = steps.length;
  const last = n - 1;
  const { w, h } = size;

  const pos = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const plant = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const doneFade = useRef(new Animated.Value(0)).current;

  const live = useRef({ w: 0, n, index: 0, reduced, done: false });
  live.current = { w, n, index, reduced, done };

  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      const i = Math.max(0, Math.min(live.current.n - 1, Math.round(value)));
      setIndex((p) => (p === i ? p : i));
    });
    return () => pos.removeListener(id);
  }, [pos]);

  useEffect(() => {
    if (!w) return;
    Animated.timing(intro, { toValue: 1, duration: reduced ? 150 : 760, easing: EASE_OUT, useNativeDriver: ND }).start();
  }, [w, intro, reduced]);

  const goTo = (target: number, duration = 560) => {
    const t = Math.max(0, Math.min(last, target));
    if (live.current.reduced) {
      Animated.timing(pos, { toValue: t, duration: 140, easing: EASE_OUT, useNativeDriver: ND }).start();
      return;
    }
    Animated.timing(pos, { toValue: t, duration, easing: EASE_IN_OUT, useNativeDriver: ND }).start();
  };

  const pan = useMemo(() => {
    let start = 0;
    const rubber = (o: number) => 1 - 1 / (o * 0.55 + 1);
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => !live.current.done && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pos.stopAnimation((v) => {
          start = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const { w: width, n: count } = live.current;
        if (!width) return;
        const raw = start - g.dx / width;
        const max = count - 1;
        const v = raw < 0 ? -rubber(-raw) * 0.6 : raw > max ? max + rubber(raw - max) * 0.6 : raw;
        pos.setValue(v);
      },
      onPanResponderRelease: (_, g) => {
        const { w: width, n: count, reduced: rm } = live.current;
        if (!width) return;
        const velocity = (-g.vx * 1000) / width; // pages per second
        const current = start - g.dx / width;
        const base = Math.round(start);
        const projected = current + velocity * 0.22;
        const target = Math.max(0, Math.min(count - 1, Math.max(base - 1, Math.min(base + 1, Math.round(projected)))));
        if (rm) {
          Animated.timing(pos, { toValue: target, duration: 140, useNativeDriver: ND }).start();
          return;
        }
        Animated.spring(pos, { toValue: target, velocity, stiffness: 320, damping: 30, mass: 1, useNativeDriver: ND }).start();
      },
      onPanResponderTerminate: () => {
        pos.stopAnimation((v) => {
          Animated.spring(pos, { toValue: Math.round(v), stiffness: 320, damping: 30, useNativeDriver: ND }).start();
        });
      },
    });
  }, [pos]);

  const finish = () => {
    if (done) return;
    setDone(true);
    AccessibilityInfo.announceForAccessibility?.(doneLabel);
    if (reduced) {
      plant.setValue(1);
      Animated.timing(doneFade, { toValue: 1, duration: 150, useNativeDriver: ND }).start();
    } else {
      Animated.parallel([
        Animated.spring(plant, { toValue: 1, stiffness: 200, damping: 17, mass: 1, useNativeDriver: ND }),
        Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: ND }),
        Animated.timing(doneFade, { toValue: 1, duration: 380, easing: EASE_OUT, useNativeDriver: ND }),
      ]).start();
    }
    setTimeout(() => onFinish?.(), 1100);
  };

  const onPrimary = () => (index < last ? goTo(index + 1) : finish());

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  /* Layout */
  const compact = h > 0 && h < 760;
  const cardH = compact ? 304 : 336;
  const cardTop = h - 12 - cardH;
  const horizon = cardTop - (compact ? 118 : 146);
  const midBase = cardTop - (compact ? 82 : 100);
  const nearBase = cardTop - (compact ? 46 : 56);

  const range = (offset: number) => steps.map((_, i) => i + offset);
  const pagesIn = steps.map((_, i) => i);
  const par = (rate: number) => (reduced ? 0 : rate);

  return (
    <View style={styles.root} onLayout={onLayout} {...pan.panHandlers}>
      {w > 0 && h > 0 ? (
        <>
          {/* Sky: each step's gradient fades in over the last, so the colour truly interpolates mid-drag. */}
          {steps.map((s, i) => (
            <Animated.View
              key={`sky-${s.title}`}
              style={[
                StyleSheet.absoluteFill,
                { pointerEvents: "none" },
                i > 0 && { opacity: pos.interpolate({ inputRange: [i - 1, i], outputRange: [0, 1], extrapolate: "clamp" }) },
              ]}
            >
              <LinearGradient colors={s.sky} locations={[0, 0.48, 0.82]} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ))}

          <Sun pos={pos} n={n} w={w} horizon={horizon} intro={intro} reduced={reduced} />

          <Animated.View
            style={[
              styles.layer,
              { width: w * 3, pointerEvents: "none", transform: [{ translateX: Animated.multiply(pos, -w * par(RATE.cloud)) }] },
            ]}
          >
            <Clouds w={w} top={horizon - 210} />
          </Animated.View>

          <Landscape
            w={w}
            h={h}
            steps={steps}
            pos={pos}
            intro={intro}
            plant={plant}
            reduced={reduced}
            horizon={horizon}
            midBase={midBase}
            nearBase={nearBase}
          />

          {/* Time-of-day light: rose at dawn, amber at golden hour, laid over the land. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { pointerEvents: "none", opacity: pos.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: "clamp" }) }]}
          >
            <LinearGradient
              colors={["rgba(231,140,140,0)", "rgba(231,150,140,0.16)"]}
              start={{ x: 0, y: 0.35 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            style={[StyleSheet.absoluteFill, { pointerEvents: "none", opacity: pos.interpolate({ inputRange: [last - 1, last], outputRange: [0, 1], extrapolate: "clamp" }) }]}
          >
            <LinearGradient
              colors={["rgba(255,170,90,0)", "rgba(255,150,70,0.2)"]}
              start={{ x: 1, y: 0.3 }}
              end={{ x: 0.2, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Grain w={w} h={h} />

          {/* Floating glass chips: the fastest layer, so they lead the swipe. */}
          {steps.map((s, i) => {
            const side = i % 4 < 2 ? { right: 20 } : { left: 20 };
            const top = horizon - (i % 2 === 0 ? 84 : 132);
            return (
              <Animated.View
                key={`chip-${s.title}`}
                style={[
                  styles.chipWrap,
                  side,
                  {
                    top,
                    pointerEvents: "none",
                    opacity: Animated.multiply(
                      intro,
                      pos.interpolate({ inputRange: [i - 0.7, i, i + 0.7], outputRange: [0, 1, 0], extrapolate: "clamp" }),
                    ),
                    transform: [
                      {
                        translateX: pos.interpolate({
                          inputRange: [i - 1, i, i + 1],
                          outputRange: [w * par(RATE.chip), 0, -w * par(RATE.chip)],
                        }),
                      },
                      { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 14, 0] }) },
                    ],
                  },
                ]}
              >
                <Chip chip={s.chip} reduced={reduced} active={index === i} />
              </Animated.View>
            );
          })}

          {/* Top bar */}
          <View style={[styles.topBar, { width: w }]}>
            <Animated.View
              style={{
                opacity: done ? 0 : pos.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
                transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : -8, 0], extrapolate: "clamp" }) }],
                pointerEvents: index === 0 || done ? "none" : "auto",
              }}
            >
              <Squish
                reduced={reduced}
                onPress={() => goTo(index - 1)}
                accessibilityRole="button"
                accessibilityLabel="Back"
                accessibilityHint="Goes to the previous step"
                hitSlop={6}
              >
                <Glass radius={20} style={styles.roundBtn}>
                  <View aria-hidden>
                    <Svg width={20} height={20} viewBox="0 0 24 24">
                      <Path d="M14.5 5.5 8 12l6.5 6.5" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </Svg>
                  </View>
                </Glass>
              </Squish>
            </Animated.View>

            <View style={styles.brand} accessibilityRole="header" accessibilityLabel={brand}>
              <View aria-hidden>
                <BrandMark />
              </View>
              <Text style={styles.brandText}>{brand}</Text>
            </View>

            <Animated.View
              style={{
                opacity: done ? 0 : pos.interpolate({ inputRange: [last - 1, last], outputRange: [1, 0], extrapolate: "clamp" }),
                pointerEvents: index === last || done ? "none" : "auto",
              }}
            >
              <Squish
                reduced={reduced}
                onPress={() => goTo(last, 760)}
                accessibilityRole="button"
                accessibilityLabel={`${skipLabel} to the last step`}
                hitSlop={6}
              >
                <Glass radius={20} style={styles.skipBtn}>
                  <Text style={styles.skipText}>{skipLabel}</Text>
                </Glass>
              </Squish>
            </Animated.View>
          </View>

          {/* The glass card */}
          <Animated.View
            style={[
              styles.cardWrap,
              {
                top: cardTop,
                height: cardH,
                transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 28, 0] }) }],
              },
            ]}
          >
            <Glass
              radius={32}
              intensity={60}
              wash={["rgba(255,252,247,0.86)", "rgba(255,249,241,0.72)"]}
              style={[StyleSheet.absoluteFill, styles.cardShadow]}
            />

            <View style={styles.cardInner}>
              <View style={styles.cardHead}>
                <Progress pos={pos} n={n} />
                <Clock pos={pos} steps={steps} />
              </View>

              <View
                style={styles.copyArea}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`${steps[index].title} ${steps[index].body}`}
                accessibilityValue={{ text: `Step ${index + 1} of ${n}` }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(e) => goTo(e.nativeEvent.actionName === "increment" ? index + 1 : index - 1)}
              >
                {steps.map((s, i) => (
                  <Animated.View
                    key={`copy-${s.title}`}
                    style={[
                      StyleSheet.absoluteFill,
                      styles.copy,
                      {
                        opacity: pos.interpolate({ inputRange: [i - 0.55, i, i + 0.55], outputRange: [0, 1, 0], extrapolate: "clamp" }),
                        transform: [
                          {
                            translateX: pos.interpolate({
                              inputRange: [i - 1, i, i + 1],
                              outputRange: [w * par(RATE.copy), 0, -w * par(RATE.copy)],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.kicker}>{s.kicker}</Text>
                    <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
                      {s.title}
                    </Text>
                    <Text style={[styles.body, compact && styles.bodyCompact]}>{s.body}</Text>
                  </Animated.View>
                ))}
              </View>

              <Primary
                pos={pos}
                last={last}
                done={done}
                doneFade={doneFade}
                burst={burst}
                reduced={reduced}
                nextLabel={nextLabel}
                finishLabel={finishLabel}
                doneLabel={doneLabel}
                onPress={onPrimary}
                isLast={index === last}
              />
            </View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sun: arcs across the sky as you swipe, changing from dawn to gold.  */
/* ------------------------------------------------------------------ */

function Sun({
  pos,
  n,
  w,
  horizon,
  intro,
  reduced,
}: {
  pos: Animated.Value;
  n: number;
  w: number;
  horizon: number;
  intro: Animated.Value;
  reduced: boolean;
}) {
  const id = useSvgId("sun");
  const S = 420;
  const pages = Array.from({ length: n }, (_, i) => i);
  const t = (i: number) => (n > 1 ? i / (n - 1) : 0);
  const xs = pages.map((i) => w * (0.22 + 0.58 * t(i)) - S / 2);
  const ys = pages.map((i) => horizon - 34 - Math.sin(Math.PI * t(i)) * 150 - S / 2);
  const tx = n > 1 ? pos.interpolate({ inputRange: pages, outputRange: xs, extrapolate: "clamp" }) : xs[0];
  const ty = n > 1 ? pos.interpolate({ inputRange: pages, outputRange: ys, extrapolate: "clamp" }) : ys[0];
  const lastI = Math.max(1, n - 1);
  const dawn = pos.interpolate({ inputRange: [0, Math.min(1, lastI) * 0.8], outputRange: [1, 0], extrapolate: "clamp" });
  const gold = pos.interpolate({ inputRange: [lastI - 0.8, lastI], outputRange: [0, 1], extrapolate: "clamp" });
  const variants: { key: string; opacity: Animated.AnimatedInterpolation<number> | number; glow: string; core: [string, string]; r: number }[] = [
    { key: "day", opacity: 1, glow: "#FFF8E2", core: ["#FFFFFB", "#FFEDBD"], r: 22 },
    { key: "dawn", opacity: dawn, glow: "#FFE0C6", core: ["#FFF6EA", "#FBBE97"], r: 25 },
    { key: "gold", opacity: gold, glow: "#FFC27E", core: ["#FFF0C8", "#F7954A"], r: 29 },
  ];
  return (
    <Animated.View
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: 0,
        top: 0,
        width: S,
        height: S,
        opacity: intro,
        transform: [
          { translateX: tx },
          { translateY: ty },
          { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 24, 0] }) },
        ],
      }}
    >
      {variants.map((v) => (
        <Animated.View key={v.key} style={[StyleSheet.absoluteFill, { opacity: v.opacity }]}>
          <Svg width={S} height={S}>
            <Defs>
              <RadialGradient id={`${id}${v.key}g`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={v.glow} stopOpacity={1} />
                <Stop offset="0.1" stopColor={v.glow} stopOpacity={0.8} />
                <Stop offset="0.24" stopColor={v.glow} stopOpacity={0.36} />
                <Stop offset="0.5" stopColor={v.glow} stopOpacity={0.1} />
                <Stop offset="1" stopColor={v.glow} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id={`${id}${v.key}c`} cx="42%" cy="38%" r="62%">
                <Stop offset="0" stopColor={v.core[0]} />
                <Stop offset="1" stopColor={v.core[1]} />
              </RadialGradient>
            </Defs>
            <Circle cx={S / 2} cy={S / 2} r={S / 2} fill={`url(#${id}${v.key}g)`} />
            <Circle cx={S / 2} cy={S / 2} r={v.r} fill={`url(#${id}${v.key}c)`} />
            <Circle cx={S / 2} cy={S / 2} r={v.r - 0.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1} />
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function Clouds({ w, top }: { w: number; top: number }) {
  const id = useSvgId("cl");
  const W = w * 3;
  const puffs = [
    { x: w * 0.1, y: top + 40, rx: 70, ry: 10 },
    { x: w * 0.78, y: top + 4, rx: 56, ry: 8 },
    { x: w * 1.35, y: top + 58, rx: 84, ry: 11 },
    { x: w * 2.1, y: top + 20, rx: 64, ry: 9 },
    { x: w * 2.6, y: top + 70, rx: 50, ry: 7 },
  ];
  return (
    <Svg width={W} height={top + 120}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {puffs.map((p) => (
        <G key={`${p.x}`}>
          <Ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={`url(#${id})`} />
          <Ellipse cx={p.x + p.rx * 0.3} cy={p.y - p.ry * 0.7} rx={p.rx * 0.5} ry={p.ry * 0.9} fill={`url(#${id})`} />
        </G>
      ))}
    </Svg>
  );
}

/** Fine, irregular dither so the big gradients never band. */
const GRAIN = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 220 }, () => ({ x: Math.floor(rnd() * 96), y: Math.floor(rnd() * 96), light: rnd() > 0.45 }));
})();

function Grain({ w, h }: { w: number; h: number }) {
  const id = useSvgId("gr");
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Svg width={w} height={h}>
        <Defs>
          <Pattern id={id} x={0} y={0} width={96} height={96} patternUnits="userSpaceOnUse">
            {GRAIN.map((g, i) => (
              <Rect
                key={`g${i}`}
                x={g.x}
                y={g.y}
                width={1}
                height={1}
                fill={g.light ? "#FFFFFF" : "#14201A"}
                fillOpacity={g.light ? 0.1 : 0.045}
              />
            ))}
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

type HillKind = "far" | "mid" | "near";

function hillStops(kind: HillKind, c: string): [number, string][] {
  if (kind === "far") return [[0, c], [0.35, mix(c, "#FFFFFF", 0.12)], [1, mix(c, "#FFFFFF", 0.3)]];
  if (kind === "mid") return [[0, mix(c, "#FFFFFF", 0.08)], [0.3, c], [1, mix(c, INK, 0.3)]];
  return [[0, mix(c, "#FFFFFF", 0.16)], [0.06, c], [0.4, mix(c, INK, 0.38)], [1, mix(c, INK, 0.62)]];
}

/** One hill silhouette, drawn once per step's colour and cross-faded like the sky. */
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
  rim: string;
}) {
  const id = useSvgId(`h${kind}`);
  return (
    <>
      {colors.map((c, i) => (
        <Animated.View
          key={`${kind}${i}`}
          style={[
            StyleSheet.absoluteFill,
            { pointerEvents: "none" },
            i > 0 && { opacity: pos.interpolate({ inputRange: [i - 1, i], outputRange: [0, 1], extrapolate: "clamp" }) },
          ]}
        >
          <Svg width={width} height={height}>
            <Defs>
              <SvgGradient id={`${id}${i}`} x1="0" y1="0" x2="0" y2="1">
                {hillStops(kind, c).map(([o, col]) => (
                  <Stop key={`${o}`} offset={`${o}`} stopColor={col} />
                ))}
              </SvgGradient>
            </Defs>
            <Path d={paths.fill} fill={`url(#${id}${i})`} />
          </Svg>
        </Animated.View>
      ))}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        <Svg width={width} height={height}>
          <Path d={paths.crest} stroke={rim} strokeOpacity={kind === "near" ? 0.6 : 0.5} strokeWidth={kind === "near" ? 1.2 : 1} fill="none" />
        </Svg>
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Landscape: three hill layers at different parallax rates; the grove */
/* grows on the nearest one as the days pass.                          */
/* ------------------------------------------------------------------ */

function Landscape({
  w,
  h,
  steps,
  pos,
  intro,
  plant,
  reduced,
  horizon,
  midBase,
  nearBase,
}: {
  w: number;
  h: number;
  steps: OnboardingStep[];
  pos: Animated.Value;
  intro: Animated.Value;
  plant: Animated.Value;
  reduced: boolean;
  horizon: number;
  midBase: number;
  nearBase: number;
}) {
  const n = steps.length;
  // Each layer is wide enough for its parallax travel plus rubber-band overscroll at both ends.
  const pad = (rate: number) => Math.ceil(w * rate * 0.62) + 8;
  const span = (rate: number) => w * (1 + rate * Math.max(0, n - 1)) + pad(rate) * 2;
  const farW = span(RATE.far);
  const midW = span(RATE.mid);
  const nearW = span(RATE.near);
  const far = useMemo(() => hillPaths(farW, h, horizon, FAR), [farW, h, horizon]);
  const mid = useMemo(() => hillPaths(midW, h, midBase, MID), [midW, h, midBase]);
  const near = useMemo(() => hillPaths(nearW, h, nearBase, NEAR), [nearW, h, nearBase]);
  const move = (rate: number) => Animated.multiply(pos, reduced ? 0 : -w * rate);
  const rise = (px: number) => intro.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : px, 0] });
  const layer = (width: number, rate: number, lift: number) => [
    styles.layer,
    { width, left: -pad(rate), pointerEvents: "none" as const, transform: [{ translateX: move(rate) }, { translateY: rise(lift) }] },
  ];

  return (
    <>
      <Animated.View style={layer(farW, RATE.far, 10)}>
        <Hill kind="far" width={farW} height={h} paths={far} colors={steps.map((s) => s.land[0])} pos={pos} rim="#FFFFFF" />
      </Animated.View>
      <Animated.View style={layer(midW, RATE.mid, 18)}>
        <Hill kind="mid" width={midW} height={h} paths={mid} colors={steps.map((s) => s.land[1])} pos={pos} rim="#FFF6E6" />
      </Animated.View>
      <Animated.View style={layer(nearW, RATE.near, 28)}>
        {TREES.filter((t) => t.page < n).map((t, k, all) => {
          // With reduced motion the land stays put, so the whole grove shares the one visible window.
          const x = reduced
            ? pad(RATE.near) + w * (0.05 + (0.9 * ((k * 7) % all.length + 0.5)) / all.length)
            : pad(RATE.near) + t.page * w * RATE.near + t.x * w;
          const y = crestY(x, nearBase, NEAR);
          return <Tree key={`t${k}`} spec={t} x={x} y={y} pos={pos} plant={plant} reduced={reduced} last={n - 1} />;
        })}
        <Hill kind="near" width={nearW} height={h} paths={near} colors={steps.map((s) => s.land[2])} pos={pos} rim="#EEF7DA" />
      </Animated.View>
    </>
  );
}

function Tree({
  spec,
  x,
  y,
  pos,
  plant,
  reduced,
  last,
}: {
  spec: TreeSpec;
  x: number;
  y: number;
  pos: Animated.Value;
  plant: Animated.Value;
  reduced: boolean;
  last: number;
}) {
  const id = useSvgId("tr");
  const s = spec.size;
  const W = s;
  const H = s * 1.35;
  let scale: Animated.AnimatedInterpolation<number> | Animated.Value | number;
  if (spec.grow === "final") scale = plant;
  else if (spec.grow === "always") scale = pos.interpolate({ inputRange: [0, Math.min(1, last)], outputRange: [0.55, 1], extrapolate: "clamp" });
  else
    scale = reduced
      ? pos.interpolate({ inputRange: [spec.page - 0.5, spec.page - 0.49], outputRange: [0, 1], extrapolate: "clamp" })
      : pos.interpolate({ inputRange: [spec.page - 0.75, spec.page - 0.05], outputRange: [0, 1], extrapolate: "clamp" });
  const glow = spec.grow === "final" ? plant.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 0.55] }) : 0;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - W / 2,
        top: y - H + 4,
        width: W,
        height: H,
        transform: [{ translateY: H / 2 }, { scale }, { translateY: -H / 2 }],
      }}
    >
      {spec.grow === "final" ? (
        <Animated.View style={{ position: "absolute", left: -W, top: -H * 0.4, width: W * 3, height: H * 1.6, opacity: glow }}>
          <Svg width={W * 3} height={H * 1.6}>
            <Defs>
              <RadialGradient id={`${id}glow`} cx="50%" cy="55%" r="50%">
                <Stop offset="0" stopColor="#FFE2A8" stopOpacity={0.95} />
                <Stop offset="0.45" stopColor="#FFC57A" stopOpacity={0.35} />
                <Stop offset="1" stopColor="#FFC57A" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={W * 1.5} cy={H * 0.88} rx={W * 1.5} ry={H * 0.8} fill={`url(#${id}glow)`} />
          </Svg>
        </Animated.View>
      ) : null}
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id={`${id}c`} cx="34%" cy="28%" r="78%">
            <Stop offset="0" stopColor={LEAF[0]} />
            <Stop offset="0.5" stopColor={LEAF[1]} />
            <Stop offset="1" stopColor={LEAF[2]} />
          </RadialGradient>
          <SvgGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={PINE[0]} />
            <Stop offset="1" stopColor={PINE[1]} />
          </SvgGradient>
        </Defs>
        {spec.kind === "round" ? (
          <G>
            <Path d={`M${W / 2 - 1.6} ${H} L${W / 2 - 1.1} ${H * 0.52} L${W / 2 + 1.1} ${H * 0.52} L${W / 2 + 1.6} ${H} Z`} fill={BARK} />
            <Circle cx={W * 0.36} cy={H * 0.5} r={W * 0.24} fill={`url(#${id}c)`} />
            <Circle cx={W * 0.64} cy={H * 0.46} r={W * 0.26} fill={`url(#${id}c)`} />
            <Circle cx={W * 0.5} cy={H * 0.32} r={W * 0.3} fill={`url(#${id}c)`} />
            <Circle cx={W * 0.42} cy={H * 0.24} r={W * 0.12} fill="#FFFFFF" fillOpacity={0.12} />
            {spec.grow === "final"
              ? [
                  [0.32, 0.36],
                  [0.56, 0.22],
                  [0.7, 0.42],
                  [0.46, 0.5],
                  [0.62, 0.32],
                ].map(([fx, fy]) => <Circle key={`${fx}`} cx={W * fx} cy={H * fy} r={1.8} fill="#FFE2A6" fillOpacity={0.95} />)
              : null}
          </G>
        ) : (
          <G>
            <Path d={`M${W / 2 - 1.3} ${H} L${W / 2 - 1} ${H * 0.7} L${W / 2 + 1} ${H * 0.7} L${W / 2 + 1.3} ${H} Z`} fill={BARK} />
            <Path
              d={`M${W / 2} ${H * 0.04} C${W * 0.58} ${H * 0.22} ${W * 0.74} ${H * 0.5} ${W * 0.82} ${H * 0.74} Q${W / 2} ${H * 0.82} ${W * 0.18} ${H * 0.74} C${W * 0.26} ${H * 0.5} ${W * 0.42} ${H * 0.22} ${W / 2} ${H * 0.04} Z`}
              fill={`url(#${id}p)`}
            />
            <Path d={`M${W / 2} ${H * 0.1} C${W * 0.46} ${H * 0.3} ${W * 0.36} ${H * 0.5} ${W * 0.3} ${H * 0.68}`} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Glass chips                                                         */
/* ------------------------------------------------------------------ */

function Chip({ chip, reduced, active }: { chip: OnboardingChip; reduced: boolean; active: boolean }) {
  return (
    <Glass radius={22} intensity={30} style={styles.chip}>
      <View style={styles.chipIcon}>
        <ChipIcon chip={chip} reduced={reduced} active={active} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.chipValue} numberOfLines={1}>
          {chip.value}
        </Text>
        <Text style={styles.chipLabel} numberOfLines={1}>
          {chip.label}
        </Text>
      </View>
      {chip.kind === "focus" ? (
        <View style={styles.badge}>
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d="M12 20v-7M12 13c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5ZM12 15c0-3.2-2.4-5.2-5.6-5.2 0 3.2 2.4 5.2 5.6 5.2Z" stroke="#2F5E45" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.badgeText}>{chip.badge}</Text>
        </View>
      ) : null}
    </Glass>
  );
}

function ChipIcon({ chip, reduced, active }: { chip: OnboardingChip; reduced: boolean; active: boolean }) {
  const id = useSvgId("ci");
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (chip.kind !== "breath" || reduced || !active) {
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
  }, [chip.kind, reduced, active, breathe]);

  if (chip.kind === "breath") {
    const r = 15;
    const c = 2 * Math.PI * r;
    return (
      <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Svg width={40} height={40} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F2A37E" />
              <Stop offset="1" stopColor="#C8664A" />
            </SvgGradient>
          </Defs>
          <Circle cx={20} cy={20} r={r} stroke={INK} strokeOpacity={0.1} strokeWidth={3} fill="none" />
          <Circle
            cx={20}
            cy={20}
            r={r}
            stroke={`url(#${id}r)`}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * 0.72} ${c}`}
            transform="rotate(-90 20 20)"
          />
        </Svg>
        <Animated.View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "#E58A66",
            transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
          }}
        />
      </View>
    );
  }
  if (chip.kind === "week") {
    return (
      <Svg width={44} height={40} viewBox="0 0 44 40">
        <Defs>
          <SvgGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5C9469" />
            <Stop offset="1" stopColor="#2F5E45" />
          </SvgGradient>
        </Defs>
        {chip.bars.slice(0, 7).map((b, i) => {
          const bh = 6 + b * 26;
          return <Rect key={`b${i}`} x={2 + i * 6} y={34 - bh} width={4} height={bh} rx={2} fill={`url(#${id}b)`} opacity={i === 5 ? 1 : 0.55} />;
        })}
        <Rect x={0} y={36} width={44} height={1} fill={INK} opacity={0.12} />
      </Svg>
    );
  }
  if (chip.kind === "focus") {
    return (
      <View style={[styles.iconDisc, { backgroundColor: "rgba(47,94,69,0.12)" }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Circle cx={12} cy={13} r={7.5} stroke="#2F5E45" strokeWidth={1.7} fill="none" />
          <Path d="M12 9.2V13l2.6 1.6M10 3.5h4M12 3.5v2" stroke="#2F5E45" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    );
  }
  return (
    <View style={[styles.iconDisc, { backgroundColor: "rgba(214,120,56,0.14)" }]}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path
          d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5ZM10 20.5a2.2 2.2 0 0 0 4 0"
          stroke="#B85E25"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function BrandMark() {
  const id = useSvgId("bm");
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5C9469" />
          <Stop offset="1" stopColor="#1F4433" />
        </SvgGradient>
      </Defs>
      <Path d="M12 22V12.5" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 13C12 7 15.6 3 21 2.8 21 8.4 17.6 12.6 12 13Z" fill={`url(#${id})`} />
      <Path d="M12 15.5C12 11.4 9.4 8.8 5.2 8.6 5.2 12.6 7.8 15.4 12 15.5Z" fill={`url(#${id})`} opacity={0.7} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Progress: dots that stretch into a pill, built from transforms only */
/* ------------------------------------------------------------------ */

const DOT = 7;
const PILL = 26;
const GAP = 6;

function Progress({ pos, n }: { pos: Animated.Value; n: number }) {
  const pages = Array.from({ length: n }, (_, i) => i);
  const widths = pages.map((i) =>
    pos.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [DOT, PILL, DOT], extrapolate: "clamp" }),
  );
  const starts: (Animated.AnimatedNode | number)[] = [0];
  for (let i = 1; i < n; i++) starts.push(Animated.add(Animated.add(starts[i - 1] as Animated.Value, widths[i - 1]), GAP));
  const total = DOT * (n - 1) + PILL + GAP * (n - 1);
  return (
    <View style={{ width: total, height: DOT }} aria-hidden>
      {pages.map((i) => {
        const x = starts[i] as Animated.Value;
        const wv = widths[i];
        const opacity = pos.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0.22, 1, 0.22], extrapolate: "clamp" });
        return (
          <Animated.View key={`d${i}`} needsOffscreenAlphaCompositing style={[StyleSheet.absoluteFill, { opacity }]}>
            <Animated.View style={[styles.cap, { transform: [{ translateX: x }] }]} />
            <Animated.View
              style={[
                styles.cap,
                { transform: [{ translateX: Animated.add(x, Animated.add(wv, -DOT)) }] },
              ]}
            />
            <Animated.View
              style={[
                styles.span,
                {
                  transform: [
                    { translateX: Animated.add(x, Animated.multiply(wv, 0.5)) },
                    { translateX: -5 },
                    { scaleX: Animated.multiply(Animated.add(wv, -DOT), 0.1) },
                  ],
                },
              ]}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** The time of day, which ticks forward with the drag. */
function Clock({ pos, steps }: { pos: Animated.Value; steps: OnboardingStep[] }) {
  const minsKey = steps.map((s) => s.minutes).join(",");
  const at = (v: number) => {
    const mins = minsKey.split(",").map(Number);
    // Settle on the step's own time once the spring is within a hair of the page.
    const snapped = Math.abs(v - Math.round(v)) < 0.03 ? Math.round(v) : v;
    const c = Math.max(0, Math.min(mins.length - 1, snapped));
    const i = Math.min(mins.length - 2, Math.floor(c));
    if (mins.length < 2) return mins[0] ?? 0;
    const f = c - i;
    return Math.round(mins[i] + (mins[i + 1] - mins[i]) * f);
  };
  const [m, setM] = useState(at(0));
  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      const next = at(value);
      setM((p) => (p === next ? p : next));
    });
    return () => pos.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, minsKey]);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return (
    <View style={styles.clock} aria-hidden>
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={4} stroke={INK_SOFT} strokeWidth={1.8} fill="none" />
        <Path
          d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"
          stroke={INK_SOFT}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.clockText}>
        {hh}:{mm}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Primary button with the planting flourish                           */
/* ------------------------------------------------------------------ */

const LEAVES = Array.from({ length: 14 }, (_, i) => {
  const a = (-174 + (i * 168) / 13) * (Math.PI / 180);
  const d = 64 + ((i * 37) % 5) * 12;
  return { dx: Math.cos(a) * d * 1.9, dy: Math.sin(a) * d * 0.95 - 6, rot: ((i * 71) % 220) - 110, s: 0.8 + ((i * 13) % 4) * 0.14, gold: i % 3 === 0 };
});

function Primary({
  pos,
  last,
  done,
  doneFade,
  burst,
  reduced,
  nextLabel,
  finishLabel,
  doneLabel,
  onPress,
  isLast,
}: {
  pos: Animated.Value;
  last: number;
  done: boolean;
  doneFade: Animated.Value;
  burst: Animated.Value;
  reduced: boolean;
  nextLabel: string;
  finishLabel: string;
  doneLabel: string;
  onPress: () => void;
  isLast: boolean;
}) {
  const id = useSvgId("cta");
  const toFinal = pos.interpolate({ inputRange: [last - 0.6, last], outputRange: [0, 1], extrapolate: "clamp" });
  const nextOpacity = pos.interpolate({ inputRange: [last - 0.6, last - 0.25], outputRange: [1, 0], extrapolate: "clamp" });
  const finalOpacity = Animated.multiply(
    pos.interpolate({ inputRange: [last - 0.3, last], outputRange: [0, 1], extrapolate: "clamp" }),
    doneFade.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: "clamp" }),
  );
  const doneIn = doneFade.interpolate({ inputRange: [0.35, 1], outputRange: [0, 1], extrapolate: "clamp" });
  const shift = (from: number) => (reduced ? 0 : from);

  return (
    <View style={styles.ctaWrap}>
      {/* Warm halo that arrives with golden hour */}
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: Animated.add(toFinal, burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] })),
            transform: [{ scaleX: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { scaleY: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.8, 1.2] }) }],
          },
        ]}
      >
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFB36B" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFB36B" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={50} cy={50} rx={50} ry={50} fill={`url(#${id}h)`} />
        </Svg>
      </Animated.View>

      {/* Burst of leaves */}
      <View style={styles.burstOrigin}>
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: burst.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scaleX: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 4.4] }) }, { scaleY: burst.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }],
            },
          ]}
        />
        {LEAVES.map((l, i) => (
          <Animated.View
            key={`leaf${i}`}
            style={{
              position: "absolute",
              left: -10,
              top: -10,
              opacity: burst.interpolate({ inputRange: [0, 0.05, 0.62, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, l.dx], easing: EASE_OUT }) },
                { translateY: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, l.dy, l.dy + 14], easing: EASE_OUT }) },
                { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${l.rot}deg`], easing: EASE_OUT }) },
                { scale: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, l.s, l.s * 0.85] }) },
              ],
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M4 20C4 10 10 4 20 4 20 14 14 20 4 20Z" fill={l.gold ? "#F0A44E" : "#4E8C60"} />
              <Path d="M5 19 15 9" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.4} strokeLinecap="round" />
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
      >
        <LinearGradient colors={["#24352C", "#121C17"]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: toFinal }]}>
          <LinearGradient
            colors={["#2F5E45", "#1C3A2B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255,196,120,0)", "rgba(255,190,110,0.28)"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: doneFade }]}>
          <LinearGradient colors={["#3E7A57", "#2A5B40"]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, styles.ctaEdge]} />

        {/* Labels stack and crossfade with a small offset */}
        <Animated.View
          style={[
            styles.ctaRow,
            {
              opacity: nextOpacity,
              transform: [{ translateY: nextOpacity.interpolate({ inputRange: [0, 1], outputRange: [shift(-6), 0] }) }],
            },
          ]}
        >
          <Text style={styles.ctaText}>{nextLabel}</Text>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="#F7F3EA" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[
            styles.ctaRow,
            {
              opacity: finalOpacity,
              transform: [{ translateY: Animated.multiply(Animated.add(finalOpacity, -1), shift(-8)) }],
            },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M12 21v-8.5M12 12.5C12 7.5 15 4.5 19.5 4.3 19.5 9 16.6 12.4 12 12.5ZM12 15c0-3.4-2.3-5.6-5.8-5.7 0 3.4 2.3 5.6 5.8 5.7Z" stroke="#FFE2B4" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.ctaText}>{finishLabel}</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.ctaRow,
            {
              opacity: doneIn,
              transform: [{ translateY: doneIn.interpolate({ inputRange: [0, 1], outputRange: [shift(8), 0] }) }],
            },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12.5 10 17.5 19 7" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={styles.ctaText}>{doneLabel}</Text>
        </Animated.View>
      </Squish>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: "#F4D6C6" },
  layer: { position: "absolute", left: 0, top: 0, bottom: 0 },
  topBar: {
    position: "absolute",
    top: 54,
    left: 0,
    height: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(60,40,30,0.10)" },
  skipBtn: { height: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(60,40,30,0.10)" },
  skipText: { userSelect: "none", fontSize: 15, fontWeight: "600", color: INK, letterSpacing: -0.2 },
  brand: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, pointerEvents: "none" },
  brandText: { userSelect: "none", fontSize: 20, fontWeight: "700", letterSpacing: -0.7, color: INK },
  chipWrap: { position: "absolute", maxWidth: 300 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    boxShadow: "0 18px 40px rgba(40,50,40,0.16), 0 2px 6px rgba(40,50,40,0.06)",
  },
  chipIcon: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  chipValue: { userSelect: "none", fontSize: 16, fontWeight: "700", color: INK, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  chipLabel: { userSelect: "none", fontSize: 12.5, fontWeight: "500", color: INK_SOFT, marginTop: 1 },
  iconDisc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(92,148,105,0.18)",
  },
  badgeText: { userSelect: "none", fontSize: 12, fontWeight: "700", color: "#2F5E45", fontVariant: ["tabular-nums"] },
  cardWrap: { position: "absolute", left: 12, right: 12 },
  cardShadow: { boxShadow: "0 -1px 0 rgba(255,255,255,0.4), 0 24px 60px rgba(20,32,26,0.28), 0 4px 14px rgba(20,32,26,0.12)" },
  cardInner: { flex: 1, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 20 },
  cardHead: { height: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copyArea: { flex: 1, marginTop: 18, marginHorizontal: -24, overflow: "hidden" },
  copy: { paddingHorizontal: 24, pointerEvents: "none" },
  kicker: { userSelect: "none",
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#7A5A3E",
    marginBottom: 10,
  },
  title: { userSelect: "none", fontSize: 32, lineHeight: 35, fontWeight: "700", letterSpacing: -1.1, color: INK, marginBottom: 12 },
  titleCompact: { fontSize: 28, lineHeight: 31, letterSpacing: -0.9 },
  body: { userSelect: "none", fontSize: 16, lineHeight: 23, color: INK_SOFT, letterSpacing: -0.1 },
  bodyCompact: { fontSize: 15, lineHeight: 21 },
  cap: { position: "absolute", left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: INK },
  span: { position: "absolute", left: 0, top: 0, width: 10, height: DOT, backgroundColor: INK },
  clock: { flexDirection: "row", alignItems: "center", gap: 6 },
  clockText: { userSelect: "none", fontFamily: MONO, fontSize: 12, letterSpacing: 0.4, color: INK_SOFT, fontVariant: ["tabular-nums"] },
  ctaWrap: { height: 56, marginTop: 12 },
  halo: { pointerEvents: "none", position: "absolute", left: -24, right: -24, top: -26, bottom: -30 },
  burstOrigin: { pointerEvents: "none", position: "absolute", left: "50%", top: 28, width: 0, height: 0 },
  ring: {
    position: "absolute",
    left: -40,
    top: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: "rgba(240,164,78,0.85)",
  },
  cta: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 26px rgba(20,32,26,0.28), 0 2px 4px rgba(20,32,26,0.2)",
  },
  ctaEdge: { pointerEvents: "none", borderRadius: 28, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.25)" },
  ctaRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { userSelect: "none", color: "#F7F3EA", fontSize: 17, fontWeight: "600", letterSpacing: -0.3 },
});

export default function MobileOnboardingDemo() {
  return <MobileOnboarding />;
}
