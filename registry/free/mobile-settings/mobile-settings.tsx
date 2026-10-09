import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Paper = "white" | "sepia" | "night";

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
  appName?: string;
  version?: string;
  profile?: SettingsProfile;
  initial?: Partial<SettingsState>;
  reminderTimes?: string[];
  /** Sample entry shown in the reading preview. */
  sample?: { date: string; text: string };
  onChange?: (state: SettingsState) => void;
  onDeleteAll?: () => void;
  onDone?: () => void;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const C = {
  bg: "#F2F1EE",
  card: "#FFFFFF",
  ink: "#18171C",
  sub: "#6C6872",
  faint: "#A9A6AE",
  sep: "rgba(60,58,67,0.12)",
  accent: "#21A06B",
  accentHi: "#3CC287",
  red: "#E5484D",
  track: "#E7E5E9",
};

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const TOP = 54; // status bar
const NAV = 44;

const PAPERS: Record<Paper, { label: string; bg: string; ink: string; meta: string; swatch: string }> = {
  white: { label: "White", bg: "#FFFFFF", ink: "#1C1B1F", meta: "#8C8892", swatch: "#FFFFFF" },
  sepia: { label: "Sepia", bg: "#F5EAD7", ink: "#4A3A28", meta: "#9C8466", swatch: "#EEDDBF" },
  night: { label: "Night", bg: "#1A1A1F", ink: "#ECE9E3", meta: "#8D8A93", swatch: "#2A2A31" },
};
const PAPER_KEYS: Paper[] = ["white", "sepia", "night"];

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

const MIN_SIZE = 14;
const MAX_SIZE = 22;

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useReducedMotion() {
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

function useTween(target: number, reduce: boolean, duration = 700) {
  const anim = useRef(new Animated.Value(target)).current;
  const [value, setValue] = useState(target);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setValue(v));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    if (reduce) {
      anim.setValue(target);
      return;
    }
    Animated.timing(anim, { toValue: target, duration, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [anim, target, reduce, duration]);
  return value;
}

function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, "");
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/* ------------------------------------------------------------------ */
/* Icons (24pt grid, 1.7 stroke, round caps) and tiles                 */
/* ------------------------------------------------------------------ */

type Glyph = "paper" | "text" | "bell" | "clock" | "quote" | "face" | "cloud" | "export" | "trash" | "restore";

const SW = { strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function GlyphIcon({ name, color = "#FFFFFF", size = 18 }: { name: Glyph; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {name === "paper" && (
          <G>
            <Circle cx={12} cy={12} r={7.5} stroke={color} {...SW} />
            <Path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill={color} />
          </G>
        )}
        {name === "text" && <Path d="M4 18 8.6 6h.8L14 18M5.6 14h7M15.5 18l2.8-7.4h.4L21.5 18M16.3 15.8h4.4" stroke={color} {...SW} />}
        {name === "bell" && (
          <G>
            <Path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" stroke={color} {...SW} />
            <Path d="M10 20.2a2.2 2.2 0 0 0 4 0" stroke={color} {...SW} />
          </G>
        )}
        {name === "clock" && (
          <G>
            <Circle cx={12} cy={12} r={7.8} stroke={color} {...SW} />
            <Path d="M12 7.8V12l2.8 1.8" stroke={color} {...SW} />
          </G>
        )}
        {name === "quote" && (
          <Path
            d="M10 7.5c-2.6.8-4.4 3-4.4 6v3.2h4.2v-4H7.6M18.4 7.5c-2.6.8-4.4 3-4.4 6v3.2h4.2v-4H16"
            stroke={color}
            {...SW}
          />
        )}
        {name === "face" && (
          <G>
            <Path d="M4.5 8.5v-2a2 2 0 0 1 2-2h2M15.5 4.5h2a2 2 0 0 1 2 2v2M19.5 15.5v2a2 2 0 0 1-2 2h-2M8.5 19.5h-2a2 2 0 0 1-2-2v-2" stroke={color} {...SW} />
            <Path d="M9 9.5v1.2M15 9.5v1.2M12 9.5v3.6h-.9M9.4 15.6a4 4 0 0 0 5.2 0" stroke={color} {...SW} />
          </G>
        )}
        {name === "cloud" && <Path d="M7.5 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.4 3.3 3.3 0 0 1-.3 6.6z" stroke={color} {...SW} />}
        {name === "export" && (
          <G>
            <Path d="M12 14.5V4.5M8.5 8 12 4.5 15.5 8" stroke={color} {...SW} />
            <Path d="M8 11H6.8A1.8 1.8 0 0 0 5 12.8v5.4A1.8 1.8 0 0 0 6.8 20h10.4a1.8 1.8 0 0 0 1.8-1.8v-5.4a1.8 1.8 0 0 0-1.8-1.8H16" stroke={color} {...SW} />
          </G>
        )}
        {name === "restore" && (
          <G>
            <Path d="M5.2 12a6.8 6.8 0 1 0 2-4.8L5 9.4" stroke={color} {...SW} />
            <Path d="M5 5.2v4.2h4.2M12 8.6V12l2.4 1.6" stroke={color} {...SW} />
          </G>
        )}
        {name === "trash" && (
          <G>
            <Path d="M5 7h14M10 4.5h4M7 7l.8 11.2A1.9 1.9 0 0 0 9.7 20h4.6a1.9 1.9 0 0 0 1.9-1.8L17 7" stroke={color} {...SW} />
            <Path d="M10.4 10.5v6M13.6 10.5v6" stroke={color} {...SW} />
          </G>
        )}
      </Svg>
    </View>
  );
}

const TILE: Record<Glyph, [string, string]> = {
  paper: ["#FFC062", "#F2922B"],
  text: ["#6CB2FF", "#3479F2"],
  bell: ["#FF8A7A", "#EE4F43"],
  clock: ["#FF8A7A", "#EE4F43"],
  quote: ["#C5A0FF", "#8E63F0"],
  face: ["#5BD691", "#21A06B"],
  cloud: ["#8BCBFF", "#3E9CF2"],
  export: ["#B4B6C0", "#80838F"],
  trash: ["#FF7B7F", "#E5484D"],
  restore: ["#5BD691", "#21A06B"],
};

function Tile({ name }: { name: Glyph }) {
  return (
    <View style={s.tile}>
      <LinearGradient colors={TILE[name]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
      <LinearGradient colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
      <GlyphIcon name={name} />
    </View>
  );
}

function Chevron({ color = C.faint, size = 14 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <Path d="M9 5 16 12 9 19" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Row: a pressable list row with a highlight that fades in fast and out slow */
/* ------------------------------------------------------------------ */

type RowProps = {
  icon?: Glyph;
  title: string;
  titleColor?: string;
  subtitle?: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  first?: boolean;
  label?: string;
  role?: "button" | "switch" | "link";
  state?: { checked?: boolean; expanded?: boolean; disabled?: boolean };
  disabled?: boolean;
};

function Row({ icon, title, titleColor, subtitle, value, right, chevron, onPress, first, label, role = "button", state, disabled }: RowProps) {
  const hl = useRef(new Animated.Value(0)).current;
  const tile = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    Animated.timing(hl, { toValue: 1, duration: 90, useNativeDriver: true }).start();
    Animated.spring(tile, { toValue: 0.9, stiffness: 700, damping: 40, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.timing(hl, { toValue: 0, duration: 320, easing: EASE_OUT, useNativeDriver: true }).start();
    Animated.spring(tile, { toValue: 1, stiffness: 420, damping: 18, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label ?? title}
      accessibilityState={{ ...state, disabled }}
      style={[s.row, disabled && { opacity: 0.4 }]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.rowHl, { opacity: hl }]} />
      {icon && (
        <Animated.View style={{ transform: [{ scale: tile }] }}>
          <Tile name={icon} />
        </Animated.View>
      )}
      <View style={[s.rowBody, !first && s.rowSep, !icon && { marginLeft: 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
          {subtitle ? <View style={{ marginTop: 2 }}>{typeof subtitle === "string" ? <Text style={s.rowSub}>{subtitle}</Text> : subtitle}</View> : null}
        </View>
        {value ? typeof value === "string" ? <Text style={s.rowValue}>{value}</Text> : value : null}
        {right}
        {chevron && (
          <View style={{ marginLeft: 8 }}>
            <Chevron />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Group({ title, footer, children, style }: { title?: string; footer?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.groupWrap, style]}>
      {title && <Text style={s.groupTitle}>{title}</Text>}
      <View style={s.group}>
        <LinearGradient colors={["#FFFFFF", "#FDFCFB", "#FAF9F7"]} style={StyleSheet.absoluteFill} />
        {children}
      </View>
      {footer && <Text style={s.groupFooter}>{footer}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle: physical knob that stretches while held, colour fills in     */
/* ------------------------------------------------------------------ */

function Toggle({ value, onChange, reduce, label }: { value: boolean; onChange: (v: boolean) => void; reduce: boolean; label: string }) {
  const v = useRef(new Animated.Value(value ? 1 : 0)).current;
  const press = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      Animated.timing(v, { toValue: value ? 1 : 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    // A touch of overshoot on arrival: the knob "lands".
    Animated.spring(v, { toValue: value ? 1 : 0, stiffness: 520, damping: 26, useNativeDriver: true }).start();
  }, [value, reduce, v]);
  const hold = (to: number) => !reduce && Animated.spring(press, { toValue: to, stiffness: 600, damping: 36, useNativeDriver: true }).start();
  // Knob is 27 wide; stretched it grows 6pt toward the centre of the track.
  const stretchShift = Animated.multiply(press, Animated.add(3, Animated.multiply(v, -6)));
  const x = Animated.add(v.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }), stretchShift);
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
    >
      <View style={[StyleSheet.absoluteFill, s.toggleTrack]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.toggleFill,
          { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }) },
        ]}
      >
        <LinearGradient colors={[C.accentHi, C.accent]} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
      </Animated.View>
      <Animated.View
        style={[
          s.knob,
          {
            transform: [{ translateX: x }, { scaleX: press.interpolate({ inputRange: [0, 1], outputRange: [1, 33 / 27] }) }],
          },
        ]}
      >
        <LinearGradient colors={["#FFFFFF", "#F6F5F4"]} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control with a gliding thumb                               */
/* ------------------------------------------------------------------ */

function Segmented({ value, onChange, reduce }: { value: Paper; onChange: (p: Paper) => void; reduce: boolean }) {
  const [w, setW] = useState(0);
  const idx = PAPER_KEYS.indexOf(value);
  const x = useRef(new Animated.Value(0)).current;
  const squish = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  const segW = (w - 4) / 3;
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

  return (
    <View style={s.seg} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {w > 0 && (
        <Animated.View style={[s.segThumb, { width: segW, transform: [{ translateX: x }, { scale: squish }] }]}>
          <LinearGradient colors={["#FFFFFF", "#FBFAF9"]} style={[StyleSheet.absoluteFill, { borderRadius: 9 }]} />
        </Animated.View>
      )}
      {PAPER_KEYS.map((k, i) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            onPressIn={() => on && !reduce && Animated.spring(squish, { toValue: 0.95, stiffness: 700, damping: 40, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(squish, { toValue: 1, stiffness: 420, damping: 22, useNativeDriver: true }).start()}
            accessibilityRole="tab"
            accessibilityLabel={`${PAPERS[k].label} paper`}
            accessibilityState={{ selected: on }}
            style={[s.segItem, i > 0 && i !== idx && i - 1 !== idx && s.segDivider]}
          >
            <View style={[s.swatch, { backgroundColor: PAPERS[k].swatch }]} />
            <Text style={[s.segLabel, on && s.segLabelOn]}>{PAPERS[k].label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Reading preview: paper colours crossfade, size follows the slider    */
/* ------------------------------------------------------------------ */

function Preview({ paper, size, sample, reduce }: { paper: Paper; size: number; sample: { date: string; text: string }; reduce: boolean }) {
  const layers = useRef(PAPER_KEYS.map((k) => new Animated.Value(k === paper ? 1 : 0))).current;
  useEffect(() => {
    Animated.parallel(
      PAPER_KEYS.map((k, i) => Animated.timing(layers[i], { toValue: k === paper ? 1 : 0, duration: reduce ? 120 : 340, easing: EASE_IN_OUT, useNativeDriver: true })),
    ).start();
  }, [paper, reduce, layers]);
  const body = (k: Paper) => (
    <>
      <Text style={[s.previewDate, { color: PAPERS[k].meta }]}>{sample.date.toUpperCase()}</Text>
      <Text style={[s.previewText, { color: PAPERS[k].ink, fontSize: size, lineHeight: size * 1.45 }]}>{sample.text}</Text>
    </>
  );
  return (
    <View style={s.preview} accessibilityLabel={`Preview on ${PAPERS[paper].label} paper at ${Math.round(size)} point`}>
      {/* in-flow copy sizes the card; the coloured layers sit on top */}
      <View style={{ opacity: 0 }}>{body(paper)}</View>
      {PAPER_KEYS.map((k, i) => (
        <Animated.View key={k} pointerEvents="none" style={[StyleSheet.absoluteFill, s.previewLayer, { backgroundColor: PAPERS[k].bg, opacity: layers[i] }]}>
          {k === "sepia" && <PaperGrain />}
          {body(k)}
        </Animated.View>
      ))}
    </View>
  );
}

function PaperGrain() {
  const id = useSvgId("paper");
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
/* Slider: 1:1 drag, rubber-band past the ends, snaps with a tick        */
/* ------------------------------------------------------------------ */

function SizeSlider({ value, onChange, reduce }: { value: number; onChange: (v: number) => void; reduce: boolean }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;
  const thumb = useRef(new Animated.Value(1)).current;
  const start = useRef(0);
  const live = useRef(value);
  const [shown, setShown] = useState(value);
  const wRef = useRef(0);
  wRef.current = w;
  const span = MAX_SIZE - MIN_SIZE;
  const toX = (v: number) => ((v - MIN_SIZE) / span) * wRef.current;
  const toV = (px: number) => MIN_SIZE + (Math.min(Math.max(px, 0), wRef.current) / (wRef.current || 1)) * span;

  useEffect(() => {
    if (w) x.setValue(toX(live.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

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

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        x.stopAnimation();
        // A tap on the track jumps there; a grab on the thumb keeps its offset.
        const touchX = e.nativeEvent.locationX - 14;
        const current = toX(live.current);
        start.current = Math.abs(touchX - current) < 22 ? current : touchX;
        x.setValue(start.current);
        Animated.timing(bubble, { toValue: 1, duration: reduce ? 80 : 160, easing: EASE_OUT, useNativeDriver: false }).start();
        const v = toV(start.current);
        live.current = v;
        setShown(v);
        onChange(Math.round(v));
      },
      onPanResponderMove: (_, g) => {
        const W = wRef.current;
        const raw = start.current + g.dx;
        // Past either end the thumb follows at a fraction of the finger, harder the further it goes.
        const band = (d: number) => (d * 0.35) / (1 + d / 120);
        const px = raw < 0 ? -band(-raw) : raw > W ? W + band(raw - W) : raw;
        x.setValue(px);
        const v = toV(px);
        if (Math.round(v) !== Math.round(live.current)) onChange(Math.round(v));
        live.current = v;
        setShown(v);
      },
      onPanResponderRelease: (_, g) => {
        // Carry a little of the release velocity into the snap.
        const projected = toV(start.current + g.dx + g.vx * 40);
        settle(projected);
      },
      onPanResponderTerminate: () => settle(live.current),
    }),
  ).current;

  const step = (d: number) => settle(Math.round(live.current) + d);
  const fill = Animated.add(x, 14);

  return (
    <View
      style={s.slider}
      onLayout={(e) => setW(e.nativeEvent.layout.width - 28)}
      accessibilityRole="adjustable"
      accessibilityLabel="Text size"
      accessibilityValue={{ min: MIN_SIZE, max: MAX_SIZE, now: Math.round(shown), text: `${Math.round(shown)} point` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      {...responder.panHandlers}
    >
      <View style={s.sliderTrack} pointerEvents="none">
        {Array.from({ length: span + 1 }, (_, i) => (
          <View key={i} style={[s.sliderTick, { left: `${(i / span) * 100}%` }, i + MIN_SIZE <= shown && { backgroundColor: "rgba(255,255,255,0.7)" }]} />
        ))}
      </View>
      <Animated.View style={[s.sliderFill, { width: fill }]} pointerEvents="none">
        <LinearGradient colors={[C.accentHi, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 3 }]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[s.sliderThumb, { transform: [{ translateX: x }, { scale: thumb }] }]} />
      <Animated.View
        pointerEvents="none"
        style={[
          s.bubble,
          {
            opacity: bubble,
            transform: [
              { translateX: x },
              { translateY: bubble.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
              { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            ],
          },
        ]}
      >
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

function Expand({ open, children, reduce }: { open: boolean; children: ReactNode; reduce: boolean }) {
  const [h, setH] = useState(0);
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: open ? 1 : 0, duration: reduce ? 0 : open ? 380 : 260, easing: open ? EASE_OUT : EASE_IN_OUT, useNativeDriver: false }).start();
  }, [open, reduce, v]);
  return (
    <Animated.View style={{ height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), overflow: "hidden" }} pointerEvents={open ? "auto" : "none"}>
      <Animated.View
        onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)}
        style={[
          s.expandInner,
          {
            opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.2, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** Text that crossfades with a small rise when its value changes. */
function SwapText({ children, style, reduce }: { children: string; style: StyleProp<import("react-native").TextStyle>; reduce: boolean }) {
  const [shown, setShown] = useState(children);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (children === shown) return;
    if (reduce) {
      setShown(children);
      return;
    }
    Animated.timing(v, { toValue: 0, duration: 90, easing: EASE_IN, useNativeDriver: true }).start(() => {
      setShown(children);
      Animated.timing(v, { toValue: 1, duration: 220, easing: EASE_OUT, useNativeDriver: true }).start();
    });
  }, [children, shown, reduce, v]);
  return (
    <Animated.Text style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>{shown}</Animated.Text>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfileCard({ profile, entries, reduce }: { profile: SettingsProfile; entries: number; reduce: boolean }) {
  const ring = useSvgId("ring");
  const face = useSvgId("face");
  const shownEntries = useTween(entries, reduce, 900);
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  const hl = useRef(new Animated.Value(1)).current;
  const fmtWords = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  return (
    <Pressable
      onPressIn={() => !reduce && Animated.spring(hl, { toValue: 0.98, stiffness: 700, damping: 40, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(hl, { toValue: 1, stiffness: 420, damping: 20, useNativeDriver: true }).start()}
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}, ${profile.plan}, ${profile.renews}. Account details`}
    >
      <Animated.View style={[s.profile, { transform: [{ scale: hl }] }]}>
        <LinearGradient colors={["#FFFFFF", "#FDFBF8", "#FAF7F3"]} style={StyleSheet.absoluteFill} />
        <ProfileWash />
        <View style={s.profileTop}>
          <View style={s.avatarWrap}>
            <Svg width={68} height={68} viewBox="0 0 68 68" style={StyleSheet.absoluteFill} aria-hidden>
              <Defs>
                <SvgGradient id={ring} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#F7C47B" />
                  <Stop offset="0.5" stopColor="#EE7E5C" />
                  <Stop offset="1" stopColor="#D8506E" />
                </SvgGradient>
                <SvgGradient id={face} x1="0" y1="0" x2="0.6" y2="1">
                  <Stop offset="0" stopColor="#3A3640" />
                  <Stop offset="1" stopColor="#1E1C22" />
                </SvgGradient>
              </Defs>
              <Circle cx={34} cy={34} r={32.5} stroke={`url(#${ring})`} strokeWidth={2.4} fill="none" />
              <Circle cx={34} cy={34} r={28} fill={`url(#${face})`} />
            </Svg>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.profileName}>{profile.name}</Text>
            <Text style={s.profileEmail}>{profile.email}</Text>
            <View style={s.planPill}>
              <LinearGradient colors={["#FFF1E6", "#FCE3D3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
              <Text style={s.planText}>
                {profile.plan} <Text style={s.planDim}>· {profile.renews}</Text>
              </Text>
            </View>
          </View>
          <Chevron />
        </View>
        <View style={s.stats}>
          {[
            [Math.round(shownEntries).toLocaleString("en-GB"), "entries"],
            [String(profile.streakDays), "day streak"],
            [fmtWords(Math.round(profile.words * (shownEntries / Math.max(profile.entries, 1)))), "words"],
          ].map(([v, l], i) => (
            <View key={l} style={[s.stat, i > 0 && s.statSep]}>
              <Text style={s.statVal}>{v}</Text>
              <Text style={s.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ProfileWash() {
  const a = useSvgId("washA");
  const b = useSvgId("washB");
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden>
      <Defs>
        <RadialGradient id={a} cx="8%" cy="0%" r="70%">
          <Stop offset="0" stopColor="#FFD9BE" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFD9BE" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={b} cx="100%" cy="0%" r="60%">
          <Stop offset="0" stopColor="#F9C7D2" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#F9C7D2" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${a})`} />
      <Rect width="100%" height="100%" fill={`url(#${b})`} />
    </Svg>
  );
}

function StageWash() {
  const id = useSvgId("stage");
  const id2 = useSvgId("stage2");
  return (
    <Svg width="100%" height="100%" aria-hidden>
      <Defs>
        <RadialGradient id={id} cx="0%" cy="0%" r="80%">
          <Stop offset="0" stopColor="#FBD3B8" stopOpacity={0.75} />
          <Stop offset="1" stopColor="#FBD3B8" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id2} cx="100%" cy="10%" r="70%">
          <Stop offset="0" stopColor="#CFE6DA" stopOpacity={0.7} />
          <Stop offset="1" stopColor="#CFE6DA" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
      <Rect width="100%" height="100%" fill={`url(#${id2})`} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm sheet                                                       */
/* ------------------------------------------------------------------ */

function Spinner({ color }: { color: string }) {
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(r, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [r]);
  return (
    <Animated.View style={{ transform: [{ rotate: r.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
        <Circle cx={12} cy={12} r={9} stroke={color} strokeOpacity={0.3} strokeWidth={2.4} fill="none" />
        <Path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

type SheetPhase = "idle" | "working" | "done";

function ConfirmSheet({
  open,
  entries,
  onCancel,
  onConfirm,
  reduce,
}: {
  open: boolean;
  entries: number;
  onCancel: () => void;
  onConfirm: () => void;
  reduce: boolean;
}) {
  const y = useRef(new Animated.Value(600)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<SheetPhase>("idle");
  const first = useRef(true);
  const btn = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!open) return;
    }
    if (open) {
      setPhase("idle");
      y.setValue(reduce ? 0 : 600);
      Animated.parallel([
        reduce ? Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }) : Animated.spring(y, { toValue: 0, stiffness: 340, damping: 34, useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 1, duration: reduce ? 120 : 300, easing: EASE_OUT, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(y, { toValue: 600, duration: reduce ? 0 : 260, easing: EASE_IN, useNativeDriver: true }),
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
        if (g.dy > 120 || g.vy > 0.9) onCancel();
        else Animated.spring(y, { toValue: 0, velocity: g.vy, stiffness: 320, damping: 30, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const confirm = () => {
    if (phase !== "idle") return;
    setPhase("working");
    setTimeout(() => {
      setPhase("done");
      onConfirm();
      if (!reduce)
        Animated.sequence([
          Animated.timing(btn, { toValue: 1.04, duration: 110, easing: EASE_OUT, useNativeDriver: true }),
          Animated.spring(btn, { toValue: 1, stiffness: 500, damping: 26, useNativeDriver: true }),
        ]).start();
      setTimeout(onCancel, 900);
    }, 900);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim }]}>
        <Pressable style={[StyleSheet.absoluteFill, s.scrim]} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View style={[s.sheetWrap, { transform: [{ translateY: y }] }]} {...pan.panHandlers} accessibilityViewIsModal>
        <View style={s.sheet}>
          <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(255,255,255,0.6)", "rgba(250,249,247,0.84)"]} style={StyleSheet.absoluteFill} />
          <View style={s.sheetEdge} pointerEvents="none" />
          <View style={s.grabber} />
          <View style={s.sheetIcon}>
            <LinearGradient colors={["#FFE3E3", "#FFD0D1"]} style={[StyleSheet.absoluteFill, { borderRadius: 26 }]} />
            <GlyphIcon name="trash" color={C.red} size={24} />
          </View>
          <Text style={s.sheetTitle}>Delete all {entries} entries?</Text>
          <Text style={s.sheetBody}>They wait in Recently Deleted on every device for 30 days, then they’re gone.</Text>
          <Animated.View style={{ alignSelf: "stretch", transform: [{ scale: btn }] }}>
            <SheetButton
              label={phase === "done" ? "Moved to Recently Deleted" : `Delete ${entries} entries`}
              onPress={confirm}
              destructive
              phase={phase}
              reduce={reduce}
            />
          </Animated.View>
          <SheetButton label="Cancel" onPress={onCancel} reduce={reduce} />
        </View>
      </Animated.View>
    </View>
  );
}

function SheetButton({ label, onPress, destructive, phase = "idle", reduce }: { label: string; onPress: () => void; destructive?: boolean; phase?: SheetPhase; reduce: boolean }) {
  const sc = useRef(new Animated.Value(1)).current;
  const fg = destructive ? "#FFFFFF" : C.ink;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduce && Animated.spring(sc, { toValue: 0.97, stiffness: 700, damping: 40, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, stiffness: 420, damping: 20, useNativeDriver: true }).start()}
      accessibilityRole="button"
      accessibilityLabel={phase === "working" ? "Deleting" : label}
      accessibilityState={{ busy: phase === "working", disabled: phase !== "idle" }}
      style={{ alignSelf: "stretch" }}
    >
      <Animated.View style={[s.sheetBtn, destructive ? s.sheetBtnRed : s.sheetBtnPlain, { transform: [{ scale: sc }] }]}>
        {destructive && (
          <LinearGradient
            colors={phase === "done" ? ["#4ACB8C", C.accent] : ["#F2676B", "#DC3D43"]}
            style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
          />
        )}
        {phase === "working" ? (
          <Spinner color={fg} />
        ) : (
          <View style={s.btnRow}>
            {phase === "done" && (
              <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
                <Path d="M5 12.5 10 17.5 19 7" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            )}
            <Text style={[s.sheetBtnText, { color: fg }]}>{label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function MobileSettings({
  appName = "Folio",
  version = "4.2 (1180)",
  profile = DEFAULT_PROFILE,
  initial,
  reminderTimes = DEFAULT_TIMES,
  sample = DEFAULT_SAMPLE,
  onChange,
  onDeleteAll,
  onDone,
}: MobileSettingsProps) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
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

  /* scroll-linked chrome */
  const scrollY = useRef(new Animated.Value(0)).current;
  const glass = useRef(new Animated.Value(0)).current;
  const small = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      glass.setValue(Math.min(Math.max((y - 6) / 36, 0), 1));
      small.setValue(Math.min(Math.max((y - 30) / 18, 0), 1));
    },
  });
  const titleScale = scrollY.interpolate({ inputRange: [-140, 0], outputRange: [1.12, 1], extrapolate: "clamp" });

  const done = useRef(new Animated.Value(1)).current;

  return (
    <View style={s.root}>
      <Animated.View
        style={[s.stage, { transform: [{ translateY: scrollY.interpolate({ inputRange: [-200, 0, 600], outputRange: [60, 0, -300], extrapolate: "clamp" }) }] }]}
        pointerEvents="none"
      >
        <StageWash />
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text accessibilityRole="header" style={[s.largeTitle, { transform: [{ scale: titleScale }], transformOrigin: "0% 50%" }]}>
          Settings
        </Animated.Text>

        <ProfileCard profile={profile} entries={deleted ? 0 : profile.entries} reduce={reduce} />

        <Group title="Reading">
          <View style={s.segPad}>
            <Segmented value={st.paper} onChange={(p) => set("paper", p)} reduce={reduce} />
          </View>
          <View style={s.sliderRow}>
            <View style={s.sliderHead}>
              <Tile name="text" />
              <Text style={[s.rowTitle, { flex: 1, marginLeft: 12 }]}>Text size</Text>
              <Text style={s.rowValue}>{st.textSize} pt</Text>
            </View>
            <View style={s.sliderLine}>
              <Text style={[s.aa, { fontSize: 13 }]}>A</Text>
              <View style={{ flex: 1, marginHorizontal: 6 }}>
                <SizeSlider value={st.textSize} onChange={(v) => set("textSize", v)} reduce={reduce} />
              </View>
              <Text style={[s.aa, { fontSize: 20 }]}>A</Text>
            </View>
          </View>
          <View style={s.previewPad}>
            <Preview paper={st.paper} size={st.textSize} sample={sample} reduce={reduce} />
          </View>
        </Group>

        <Group title="Writing" footer="Folio nudges once. If you’ve already written today, it stays quiet.">
          <Row
            icon="bell"
            first
            title="Daily reminder"
            role="switch"
            onPress={() => set("reminder", !st.reminder)}
            state={{ checked: st.reminder }}
            right={<Toggle value={st.reminder} onChange={(v) => set("reminder", v)} reduce={reduce} label="Daily reminder" />}
          />
          <Expand open={st.reminder} reduce={reduce}>
            <Row
              icon="clock"
              title="Reminder time"
              label={`Reminder time, ${st.reminderTime}${st.weekdaysOnly ? ", weekdays" : ", every day"}`}
              state={{ expanded: timeOpen }}
              onPress={() => setTimeOpen((o) => !o)}
              value={<SwapText style={s.rowValue} reduce={reduce}>{st.weekdaysOnly ? `${st.reminderTime}, weekdays` : st.reminderTime}</SwapText>}
              right={<RotChevron open={timeOpen} reduce={reduce} />}
            />
            <Expand open={timeOpen} reduce={reduce}>
              {/* Chips align with the text column; on narrow phones they take the full row. */}
              <View style={[s.times, width < 380 && { paddingLeft: 14 }]}>
                {reminderTimes.map((t) => (
                  <TimeChip key={t} label={t} selected={st.reminderTime === t} onPress={() => set("reminderTime", t)} reduce={reduce} />
                ))}
              </View>
              <View style={s.inlineToggle}>
                <Text style={[s.rowTitle, { flex: 1, fontSize: 15 }]}>Weekdays only</Text>
                <Toggle value={st.weekdaysOnly} onChange={(v) => set("weekdaysOnly", v)} reduce={reduce} label="Weekdays only" />
              </View>
            </Expand>
          </Expand>
          <Row
            icon="quote"
            title="Writing prompts"
            subtitle="One gentle question a day"
            role="switch"
            onPress={() => set("prompts", !st.prompts)}
            state={{ checked: st.prompts }}
            right={<Toggle value={st.prompts} onChange={(v) => set("prompts", v)} reduce={reduce} label="Writing prompts" />}
          />
        </Group>

        <Group title="Privacy & sync">
          <Row
            icon="face"
            first
            title="Lock with Face ID"
            role="switch"
            onPress={() => set("faceId", !st.faceId)}
            state={{ checked: st.faceId }}
            right={<Toggle value={st.faceId} onChange={(v) => set("faceId", v)} reduce={reduce} label="Lock with Face ID" />}
          />
          <Row
            icon="cloud"
            title="iCloud sync"
            role="switch"
            subtitle={
              <View style={s.syncLine}>
                <View style={[s.syncDot, { backgroundColor: st.sync ? C.accent : C.faint }]} />
                <SwapText style={s.rowSub} reduce={reduce}>
                  {st.sync ? "Synced 2 min ago · 3 devices" : "Paused · this iPhone only"}
                </SwapText>
              </View>
            }
            onPress={() => set("sync", !st.sync)}
            state={{ checked: st.sync }}
            right={<Toggle value={st.sync} onChange={(v) => set("sync", v)} reduce={reduce} label="iCloud sync" />}
          />
          <Row icon="export" title="Export journal" value="Markdown" chevron label="Export journal, Markdown" />
        </Group>

        <Group footer={deleted ? `${profile.entries} entries are in Recently Deleted until 8 November.` : "Entries go to Recently Deleted for 30 days first."}>
          <Row
            icon={deleted ? "restore" : "trash"}
            first
            title={deleted ? `Restore ${profile.entries} entries` : "Delete all entries"}
            titleColor={deleted ? C.accent : C.red}
            onPress={() => {
              if (deleted) setDeleted(false);
              else setSheet(true);
            }}
          />
        </Group>

        <Text style={s.colophon}>
          {appName} {version} · Made slowly in Lisbon
        </Text>
      </Animated.ScrollView>

      {/* ---------- glass nav bar ---------- */}
      <View style={s.nav} pointerEvents="box-none">
        <AnimatedBlurView intensity={100} tint="light" style={[StyleSheet.absoluteFill, { opacity: glass }]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glass }]}>
          <LinearGradient colors={["rgba(250,249,247,0.62)", "rgba(250,249,247,0.42)"]} style={StyleSheet.absoluteFill} />
          <View style={s.navHairline} />
        </Animated.View>
        <View style={s.navRow} pointerEvents="box-none">
          <Animated.Text
            style={[
              s.navTitle,
              { opacity: small, transform: [{ translateY: small.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            Settings
          </Animated.Text>
          <Pressable
            onPress={onDone}
            onPressIn={() => !reduce && Animated.spring(done, { toValue: 0.92, stiffness: 700, damping: 40, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(done, { toValue: 1, stiffness: 420, damping: 18, useNativeDriver: true }).start()}
            accessibilityRole="button"
            accessibilityLabel="Done"
            hitSlop={10}
            style={s.doneHit}
          >
            <Animated.View style={[s.done, { transform: [{ scale: done }] }]}>
              <Text style={s.doneText}>Done</Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>

      <ConfirmSheet
        open={sheet}
        entries={profile.entries}
        reduce={reduce}
        onCancel={() => setSheet(false)}
        onConfirm={() => {
          setDeleted(true);
          onDeleteAll?.();
        }}
      />
    </View>
  );
}

function RotChevron({ open, reduce }: { open: boolean; reduce: boolean }) {
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) v.setValue(open ? 1 : 0);
    else Animated.spring(v, { toValue: open ? 1 : 0, stiffness: 500, damping: 40, useNativeDriver: true }).start();
  }, [open, reduce, v]);
  return (
    <Animated.View style={{ marginLeft: 8, transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }}>
      <Chevron />
    </Animated.View>
  );
}

function TimeChip({ label, selected, onPress, reduce }: { label: string; selected: boolean; onPress: () => void; reduce: boolean }) {
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const sc = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(on, { toValue: selected ? 1 : 0, duration: reduce ? 0 : 200, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [selected, reduce, on]);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduce && Animated.spring(sc, { toValue: 0.94, stiffness: 700, damping: 40, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, stiffness: 420, damping: 16, useNativeDriver: true }).start()}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[s.chip, { transform: [{ scale: sc }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, s.chipOn, { opacity: on }]}>
          <LinearGradient colors={[C.accentHi, C.accent]} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
        </Animated.View>
        <Text style={s.chipText} numberOfLines={1}>
          {label}
        </Text>
        <Animated.Text style={[s.chipText, s.chipTextOn, { opacity: on }]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export default function MobileSettingsDemo() {
  return <MobileSettings />;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: "hidden", userSelect: "none" },
  stage: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  scroll: { paddingTop: TOP + NAV, paddingHorizontal: 16, paddingBottom: 48 },

  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.9, color: C.ink, marginLeft: 4, marginBottom: 14 },

  nav: { position: "absolute", top: 0, left: 0, right: 0, height: TOP + NAV },
  navHairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(40,36,30,0.16)" },
  navRow: { position: "absolute", left: 0, right: 0, bottom: 0, height: NAV, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 17, fontWeight: "600", color: C.ink, letterSpacing: -0.3 },
  doneHit: { position: "absolute", right: 12, top: 6, bottom: 6, justifyContent: "center" },
  done: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: "center", backgroundColor: "rgba(33,160,107,0.1)" },
  doneText: { fontSize: 15, fontWeight: "600", color: "#17855A" },

  /* profile */
  profile: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(40,30,20,0.08)",
    boxShadow: "0 1px 2px rgba(30,20,10,0.05), 0 10px 30px rgba(120,70,40,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
  },
  profileTop: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 14 },
  avatarWrap: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.4 },
  profileName: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5, color: C.ink },
  profileEmail: { fontSize: 14, color: C.sub, marginTop: 1 },
  planPill: { alignSelf: "flex-start", marginTop: 8, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3.5, overflow: "hidden" },
  planText: { fontSize: 12, fontWeight: "700", color: "#B4532F", letterSpacing: 0.1 },
  planDim: { fontWeight: "500", color: "#C98767" },
  stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  stat: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: C.sep },
  statVal: { fontSize: 18, fontWeight: "700", color: C.ink, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, color: C.sub, marginTop: 1 },

  /* groups */
  groupWrap: { marginTop: 26 },
  groupTitle: { fontSize: 13, fontWeight: "600", color: C.sub, letterSpacing: 0.2, marginLeft: 16, marginBottom: 7, textTransform: "uppercase" },
  groupFooter: { fontSize: 13, color: C.sub, marginTop: 8, marginHorizontal: 16, lineHeight: 18 },
  group: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(40,30,20,0.07)",
    boxShadow: "0 1px 2px rgba(30,20,10,0.04), 0 8px 24px rgba(30,20,10,0.05), inset 0 1px 0 rgba(255,255,255,1)",
  },

  row: { flexDirection: "row", alignItems: "center", paddingLeft: 14, minHeight: 52 },
  rowHl: { backgroundColor: "rgba(30,26,22,0.06)" },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, paddingRight: 14, paddingVertical: 11, minHeight: 52 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  rowTitle: { fontSize: 16, color: C.ink, letterSpacing: -0.3 },
  rowSub: { fontSize: 13, color: C.sub, letterSpacing: -0.1 },
  rowValue: { fontSize: 16, color: C.sub, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.5)",
  },

  /* toggle */
  toggle: { width: 51, height: 31, borderRadius: 16, marginLeft: 10 },
  toggleTrack: { borderRadius: 16, backgroundColor: C.track, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" },
  toggleFill: { borderRadius: 16, boxShadow: "inset 0 1px 1px rgba(0,0,0,0.08)" },
  knob: {
    position: "absolute",
    top: 2,
    left: 0,
    width: 27,
    height: 27,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.04)",
  },

  /* segmented + preview */
  segPad: { paddingHorizontal: 14, paddingTop: 14 },
  previewPad: { paddingHorizontal: 14, paddingBottom: 14 },
  seg: { flexDirection: "row", height: 36, borderRadius: 11, backgroundColor: "rgba(118,112,128,0.12)", padding: 2 },
  segThumb: {
    position: "absolute",
    top: 2,
    left: 2,
    bottom: 2,
    borderRadius: 9,
    boxShadow: "0 3px 8px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)",
  },
  segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segDivider: { borderLeftWidth: 0 },
  segLabel: { fontSize: 13.5, fontWeight: "500", color: C.sub },
  segLabelOn: { color: C.ink, fontWeight: "600" },
  swatch: { width: 11, height: 11, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.22)" },

  preview: { borderRadius: 14, overflow: "hidden", padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.08)" },
  previewLayer: { padding: 16 },
  previewDate: { fontSize: 11, fontWeight: "600", letterSpacing: 1.1, marginBottom: 6 },
  previewText: { fontFamily: "Georgia", letterSpacing: -0.1 },

  sliderRow: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  sliderHead: { flexDirection: "row", alignItems: "center" },
  sliderLine: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  aa: { width: 18, textAlign: "center", fontFamily: "Georgia", color: C.sub },
  slider: { height: 44, justifyContent: "center" },
  sliderTrack: { position: "absolute", left: 14, right: 14, height: 6, borderRadius: 3, backgroundColor: C.track, top: 19 },
  sliderTick: { position: "absolute", top: 2, width: 2, height: 2, marginLeft: -1, borderRadius: 1, backgroundColor: "rgba(0,0,0,0.18)" },
  sliderFill: { position: "absolute", left: 0, top: 19, height: 6, borderRadius: 3, overflow: "hidden" },
  sliderThumb: {
    position: "absolute",
    left: 0,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    boxShadow: "0 3px 8px rgba(0,0,0,0.16), 0 1px 1px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.05)",
  },
  bubble: { position: "absolute", left: -12, top: -34, width: 52, alignItems: "center" },
  bubbleBody: { backgroundColor: C.ink, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, boxShadow: "0 6px 16px rgba(0,0,0,0.2)" },
  bubbleText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bubbleTail: { width: 8, height: 8, backgroundColor: C.ink, transform: [{ rotate: "45deg" }], marginTop: -5 },

  expandInner: { position: "absolute", top: 0, left: 0, right: 0 },
  times: { flexDirection: "row", gap: 6, paddingLeft: 56, paddingRight: 14, paddingTop: 2, paddingBottom: 10 },
  chip: { height: 34, borderRadius: 12, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(118,112,128,0.1)" },
  chipOn: { borderRadius: 12, boxShadow: "0 4px 10px rgba(33,160,107,0.3)" },
  chipText: { fontSize: 13, fontWeight: "600", letterSpacing: -0.2, color: C.ink, fontVariant: ["tabular-nums"] },
  chipTextOn: { position: "absolute", color: "#FFFFFF" },
  inlineToggle: { flexDirection: "row", alignItems: "center", marginLeft: 56, paddingRight: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },

  syncLine: { flexDirection: "row", alignItems: "center" },
  syncDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },

  colophon: { textAlign: "center", fontSize: 12.5, color: C.faint, marginTop: 28 },

  /* sheet */
  scrim: { backgroundColor: "rgba(20,16,12,0.32)" },
  sheetWrap: { position: "absolute", left: 10, right: 10, bottom: 12 },
  sheet: {
    borderRadius: 34,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: "center",
    boxShadow: "0 30px 60px rgba(20,10,0,0.25), 0 2px 6px rgba(0,0,0,0.08)",
  },
  sheetEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    borderWidth: 1,
    borderTopColor: "rgba(255,255,255,0.95)",
    borderLeftColor: "rgba(255,255,255,0.6)",
    borderRightColor: "rgba(255,255,255,0.6)",
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(60,56,66,0.2)", marginBottom: 18 },
  sheetIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 21, fontWeight: "700", letterSpacing: -0.5, color: C.ink, textAlign: "center" },
  sheetBody: { fontSize: 15, lineHeight: 21, color: C.sub, textAlign: "center", marginTop: 8, marginBottom: 20, paddingHorizontal: 8 },
  sheetBtn: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 8 },
  sheetBtnRed: { boxShadow: "0 8px 20px rgba(229,72,77,0.3), inset 0 1px 0 rgba(255,255,255,0.3)" },
  sheetBtnPlain: { backgroundColor: "rgba(118,112,128,0.12)" },
  sheetBtnText: { fontSize: 16.5, fontWeight: "600", letterSpacing: -0.3 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
