import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

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
  onTabChange?: (key: TabKey) => void;
  onAction?: (key: string) => void;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const C = {
  bg: "#09090C",
  text: "#F6F3EE",
  sub: "rgba(246,243,238,0.6)",
  faint: "rgba(246,243,238,0.38)",
  line: "rgba(255,255,255,0.07)",
  ember: "#FF6B3D",
  emberHi: "#FFA06A",
  emberLo: "#E5402F",
  volt: "#D9F36A",
  milk: "#F7F4EF",
  ink: "#121216",
};

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

const BAR_SIDE = 14;
const BAR_BOTTOM = 26;
const BAR_H = 68;
const FAB = 60;
const FAB_RISE = 18; // how far the centre action stands above the bar
const FAB_CENTRE = BAR_BOTTOM + BAR_H + FAB_RISE - FAB / 2; // from the bottom of the screen

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

/** A number that tweens to its target with tabular digits. */
function useTween(target: number, reduce: boolean, duration = 760) {
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

/* ------------------------------------------------------------------ */
/* Press: a Pressable whose surface springs down while held.           */
/* ------------------------------------------------------------------ */

type PressProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  label: string;
  role?: "button" | "tab" | "link";
  selected?: boolean;
  hint?: string;
};

function Press({ children, onPress, style, outerStyle, scaleTo = 0.97, label, role = "button", selected, hint }: PressProps) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number, fast: boolean) =>
    Animated.spring(scale, { toValue: v, stiffness: fast ? 700 : 420, damping: fast ? 40 : 22, mass: 1, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduce && to(scaleTo, true)}
      onPressOut={() => to(1, false)}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={outerStyle}
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

function Chevron({ color = C.faint }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <Path d="M9 5.5 15.5 12 9 18.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

/** Dither: a 4pt grid of faint dots that keeps gradients from banding. */
function Grain({ opacity = 0.05 }: { opacity?: number }) {
  const id = useSvgId("grain");
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden pointerEvents="none">
      <Defs>
        <Pattern id={id} width={4} height={4} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={0.55} fill="#FFFFFF" opacity={opacity} />
          <Circle cx={3} cy={3} r={0.45} fill="#000000" opacity={opacity * 1.4} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function Card({ children, style, pad = 18 }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  return (
    <View style={[s.card, { padding: pad }, style]}>
      <LinearGradient colors={["#1B1B21", "#141418", "#101013"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Grain opacity={0.025} />
      {children}
    </View>
  );
}

function Eyebrow({ children, color = C.faint }: { children: ReactNode; color?: string }) {
  return <Text style={[s.eyebrow, { color }]}>{children}</Text>;
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

function WeekHero({ km, baseKm, goal, week, reduce }: { km: number; baseKm: number; goal: number; week: WeekDay[]; reduce: boolean }) {
  const shown = useTween(km, reduce);
  const glow = useSvgId("heroGlow");
  const shade = useSvgId("heroShade");
  const ring = useSvgId("heroRing");
  const pct = Math.min(shown / goal, 1);
  const R = 38;
  const CIRC = 2 * Math.PI * R;
  const extra = shown - baseKm; // added today, grows today's bar while the total tweens
  const max = Math.max(...week.map((d) => d.km + (d.state === "today" ? Math.max(extra, 0) : 0)), 10);
  const left = Math.max(goal - shown, 0);

  return (
    <View style={s.hero}>
      <LinearGradient
        colors={["#FF8C52", "#F65F3A", "#DB3E36", "#A82A3C"]}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden pointerEvents="none">
        <Defs>
          <RadialGradient id={glow} cx="12%" cy="0%" r="75%">
            <Stop offset="0" stopColor="#FFD9A0" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#FFD9A0" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={shade} cx="100%" cy="100%" r="70%">
            <Stop offset="0" stopColor="#4A0F2A" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#4A0F2A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${glow})`} />
        <Rect width="100%" height="100%" fill={`url(#${shade})`} />
      </Svg>
      <Grain opacity={0.04} />

      <View style={s.heroTop}>
        <View style={{ flex: 1 }}>
          <Eyebrow color="rgba(255,255,255,0.72)">THIS WEEK</Eyebrow>
          <View style={s.heroNumRow}>
            <Text style={s.heroNum}>{shown.toFixed(1)}</Text>
            <Text style={s.heroUnit}>km</Text>
          </View>
          <Text style={s.heroSub}>
            {left > 0.05 ? `of ${goal} km · ${left.toFixed(1)} to go` : `Goal of ${goal} km reached`}
          </Text>
        </View>
        <View style={s.ringWrap}>
          <Svg width={92} height={92} viewBox="0 0 92 92" aria-hidden>
            <Defs>
              <SvgGradient id={ring} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="1" stopColor="#FFE7D6" />
              </SvgGradient>
            </Defs>
            <Circle cx={46} cy={46} r={R} stroke="rgba(255,255,255,0.2)" strokeWidth={9} fill="none" />
            <Circle
              cx={46}
              cy={46}
              r={R}
              stroke={`url(#${ring})`}
              strokeWidth={9}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - pct)}
              transform="rotate(-90 46 46)"
            />
          </Svg>
          <View style={[StyleSheet.absoluteFill, s.center]}>
            <Text style={s.ringPct}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
      </View>

      <View style={s.days} accessibilityLabel={`Daily distance: ${week.map((d) => `${d.day} ${d.km} km`).join(", ")}`}>
        {week.map((d, i) => {
          const value = d.km + (d.state === "today" ? Math.max(extra, 0) : 0);
          const h = d.state === "planned" ? 6 : Math.max(6, (value / max) * 40);
          return (
            <View key={i} style={s.dayCol}>
              <View style={s.dayTrack}>
                <View
                  style={[
                    s.dayBar,
                    { height: h },
                    d.state === "planned" && s.dayPlanned,
                    d.state === "today" && s.dayToday,
                  ]}
                />
              </View>
              <Text style={[s.dayLabel, d.state === "today" && { color: "#FFFFFF", fontWeight: "800" }]}>{d.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PaceTile() {
  const id = useSvgId("pace");
  const line = "M2 30 C14 26 18 32 28 24 S44 18 52 20 S66 10 78 12 S92 6 100 4";
  return (
    <Card style={{ flex: 1 }} pad={16}>
      <Eyebrow>AVG PACE</Eyebrow>
      <View style={s.tileNumRow}>
        <Text style={s.tileNum}>4:52</Text>
        <Text style={s.tileUnit}>/km</Text>
      </View>
      <View style={{ height: 34 }}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 102 34" preserveAspectRatio="none" aria-hidden>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.ember} stopOpacity={0.35} />
            <Stop offset="1" stopColor={C.ember} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Path d={`${line} L100 34 L2 34 Z`} fill={`url(#${id})`} />
        <Path d={line} stroke={C.emberHi} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      </Svg>
      </View>
      <Text style={s.tileFoot}>6 s faster than Sept</Text>
    </Card>
  );
}

function StreakTile() {
  return (
    <Card style={{ flex: 1 }} pad={16}>
      <Eyebrow>STREAK</Eyebrow>
      <View style={s.tileNumRow}>
        <Text style={s.tileNum}>12</Text>
        <Text style={s.tileUnit}>days</Text>
      </View>
      <View style={s.streakRow} accessibilityLabel="Ran on each of the last 12 days">
        {Array.from({ length: 14 }, (_, i) => {
          const on = i >= 2;
          return (
            <View
              key={i}
              style={[
                s.streakBar,
                on && { backgroundColor: `rgba(217,243,106,${0.28 + ((i - 2) / 11) * 0.5})` },
                i === 13 && s.streakNow,
              ]}
            />
          );
        })}
      </View>
      <Text style={s.tileFoot}>Longest since May</Text>
    </Card>
  );
}

function Avatar({ initials, hue, size = 26, ring = C.ink }: { initials: string; hue: [string, string]; size?: number; ring?: string }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]}>
      <LinearGradient colors={hue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
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
        <View style={[s.rowBetween, { marginTop: 10 }]}>
          <Text style={s.cardSub}>18 km easy · 5:30 /km</Text>
          <View style={s.avatars}>
            <Avatar initials="IO" hue={["#7FD1B9", "#2F8F7A"]} />
            <View style={{ marginLeft: -8 }}>
              <Avatar initials="TR" hue={["#F7C873", "#D88A2E"]} />
            </View>
            <View style={{ marginLeft: -8 }}>
              <Avatar initials="+4" hue={["#3A3A44", "#24242B"]} />
            </View>
          </View>
        </View>
      </Card>
    </Press>
  );
}

/** A drawn street map with a run traced on it. */
function RunMap({ route, height = 172, variant = 0 }: { route: string; height?: number; variant?: 0 | 1 }) {
  const id = useSvgId("map");
  return (
    <View style={{ height }}>
    <Svg width="100%" height={height} viewBox="0 0 360 172" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <Defs>
        <SvgGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={C.volt} />
          <Stop offset="0.25" stopColor={C.emberHi} />
          <Stop offset="1" stopColor={C.ember} />
        </SvgGradient>
        <RadialGradient id={`${id}g`} cx="70%" cy="40%" r="70%">
          <Stop offset="0" stopColor="#2A4D3D" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#2A4D3D" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={360} height={172} fill="#111816" />
      <Rect width={360} height={172} fill={`url(#${id}g)`} />
      {/* park */}
      <Path
        d={variant === 0 ? "M188 18c40-14 96-10 128 12s30 64-6 82-92 14-118-8-44-72-4-86z" : "M30 92c30-22 92-26 120-4s20 70-20 78-96 2-110-24-14-34 10-50z"}
        fill="#1B3528"
      />
      <Path
        d={variant === 0 ? "M214 40c28-8 62-4 80 10s14 40-10 50-60 6-74-8-20-46 4-52z" : "M54 110c22-12 58-12 74 2s8 40-18 44-56-4-62-20 0-20 6-26z"}
        fill="#22422F"
      />
      {/* river */}
      <Path d="M-10 150C60 120 90 140 150 118S250 70 300 92s60-8 80-20" stroke="#183A4E" strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M-10 150C60 120 90 140 150 118S250 70 300 92s60-8 80-20" stroke="#2B6687" strokeWidth={4} fill="none" opacity={0.55} strokeLinecap="round" />
      {/* streets */}
      <G stroke="rgba(255,255,255,0.07)" strokeWidth={1.4} fill="none">
        <Path d="M0 40h360M0 76h140M40 0v172M96 0v120M150 0l40 172M250 0v60M300 120v52M0 112l120-20M200 140h160" />
      </G>
      <G stroke="rgba(255,255,255,0.12)" strokeWidth={3} fill="none" strokeLinecap="round">
        <Path d="M-4 58C80 54 140 70 210 50S330 30 364 36M120 -4C126 60 108 120 118 176" />
      </G>
      {/* run */}
      <Path d={route} stroke={C.ember} strokeWidth={11} opacity={0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={route} stroke={`url(#${id}r)`} strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
    </View>
  );
}

const TEMPO_ROUTE = "M44 132C62 112 70 92 96 86S140 70 156 52 196 28 228 34s58 26 70 46-6 40-30 44-60-4-82 8";

function LastRun() {
  return (
    <Press label="Last run: Tuesday tempo, 12 kilometres in 58 minutes 24" style={s.pressCard} scaleTo={0.98}>
      <Card pad={0}>
        <View style={{ padding: 18, paddingBottom: 14 }}>
          <View style={s.rowBetween}>
            <Eyebrow>LAST RUN · TUE 7 OCT</Eyebrow>
            <Chevron />
          </View>
          <Text style={s.cardTitle}>Tuesday tempo</Text>
          <View style={s.statRow}>
            {[
              ["12.0", "km"],
              ["58:24", "time"],
              ["4:52", "/km"],
              ["+64", "m climb"],
            ].map(([v, l]) => (
              <View key={l}>
                <Text style={s.statVal}>{v}</Text>
                <Text style={s.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s.mapWrap}>
          <RunMap route={TEMPO_ROUTE} />
          <View style={[s.pin, { left: "11%", top: "73%" }]}>
            <View style={[s.pinCore, { backgroundColor: C.volt }]} />
          </View>
        </View>
      </Card>
    </Press>
  );
}

function TodayScreen({ name, initials, dateLine, km, baseKm, goal, week, reduce }: { name: string; initials: string; dateLine: string; km: number; baseKm: number; goal: number; week: WeekDay[]; reduce: boolean }) {
  return (
    <>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.dateLine}>{dateLine}</Text>
          <Text style={s.h1}>Morning, {name}</Text>
        </View>
        <Avatar initials={initials} hue={["#FFB487", "#E5583A"]} size={40} ring="rgba(255,255,255,0.14)" />
      </View>
      <WeekHero km={km} baseKm={baseKm} goal={goal} week={week} reduce={reduce} />
      <View style={s.tiles}>
        <PaceTile />
        <StreakTile />
      </View>
      <LastRun />
      <UpNext />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Routes, Club, You (light context for the other tabs)                */
/* ------------------------------------------------------------------ */

const ROUTES = [
  { name: "Canal to Victoria Park", km: "8.4", climb: "42", line: "M0 18 C10 16 18 12 28 14 S44 8 56 10 S72 16 84 12 S96 6 100 8" },
  { name: "Hackney Marshes loop", km: "10.2", climb: "18", line: "M0 14 C12 14 22 16 34 15 S56 12 68 14 S88 16 100 14" },
  { name: "Lea Valley out-and-back", km: "16.0", climb: "71", line: "M0 20 C14 18 20 8 34 6 S52 16 64 12 S84 2 100 6" },
  { name: "Clapton hill reps", km: "5.6", climb: "118", line: "M0 20 L14 6 L26 20 L40 6 L52 20 L66 6 L78 20 L92 6 L100 14" },
];

function Elevation({ d }: { d: string }) {
  const id = useSvgId("elev");
  return (
    <Svg width={84} height={26} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.ember} stopOpacity={0.4} />
          <Stop offset="1" stopColor={C.ember} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={`${d} L100 24 L0 24 Z`} fill={`url(#${id})`} />
      <Path d={d} stroke={C.emberHi} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function RoutesScreen() {
  return (
    <>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.dateLine}>NEAR HACKNEY · 14 SAVED</Text>
          <Text style={s.h1}>Routes</Text>
        </View>
      </View>
      <Press label="Featured route: Hackney Marshes loop" style={s.pressCard} scaleTo={0.98}>
        <Card pad={0}>
          <RunMap route="M70 100C50 82 58 60 88 54S136 38 156 26 224 10 262 24s46 42 20 60-78 22-118 20-72 12-94-4" height={190} variant={1} />
          <LinearGradient colors={["rgba(16,16,19,0)", "rgba(16,16,19,0.75)", "rgba(16,16,19,0.96)"]} locations={[0, 0.5, 1]} style={s.mapFade} />
          <View style={s.mapCaption}>
            <Eyebrow color="rgba(255,255,255,0.7)">FLAT · RIVERSIDE · LIT AFTER DARK</Eyebrow>
            <Text style={s.cardTitle}>Hackney Marshes loop</Text>
          </View>
        </Card>
      </Press>
      <Card pad={0}>
        {ROUTES.map((r, i) => (
          <Press key={r.name} label={`${r.name}, ${r.km} kilometres, ${r.climb} metres climb`} style={[s.listRow, i > 0 && s.listDivider]} scaleTo={0.985}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{r.name}</Text>
              <Text style={s.rowSub}>
                {r.km} km · ↑ {r.climb} m
              </Text>
            </View>
            <Elevation d={r.line} />
          </Press>
        ))}
      </Card>
    </>
  );
}

const LEADERS: { name: string; initials: string; km: number; hue: [string, string]; you?: boolean }[] = [
  { name: "Tomás Reyes", initials: "TR", km: 48.2, hue: ["#F7C873", "#D88A2E"] },
  { name: "Ife Okonjo", initials: "IO", km: 41.0, hue: ["#7FD1B9", "#2F8F7A"] },
  { name: "You", initials: "AD", km: 32.4, hue: ["#FFB487", "#E5583A"], you: true },
  { name: "Mira Kowalczyk", initials: "MK", km: 29.7, hue: ["#B9C6FF", "#5B6BD6"] },
  { name: "Jonah Pratt", initials: "JP", km: 24.1, hue: ["#E4E0D8", "#8F8A80"] },
];

function ClubScreen({ youKm, initials }: { youKm: number; initials: string }) {
  const rows = LEADERS.map((l) => (l.you ? { ...l, km: youKm, initials } : l)).sort((a, b) => b.km - a.km);
  return (
    <>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.dateLine}>HACKNEY HARRIERS · WEEK 41</Text>
          <Text style={s.h1}>Club</Text>
        </View>
      </View>
      <Card>
        <Eyebrow>NEW KUDOS</Eyebrow>
        <Text style={[s.cardTitle, { marginTop: 8 }]}>Ife and 2 others liked your tempo</Text>
        <Text style={[s.cardSub, { marginTop: 6 }]}>“4:52s in that wind? Sharp.” — Ife</Text>
      </Card>
      <Card pad={0}>
        <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 }}>
          <Eyebrow>THIS WEEK’S DISTANCE</Eyebrow>
        </View>
        {rows.map((r, i) => (
          <View key={r.name} style={[s.leadRow, r.you && s.leadYou]}>
            <Text style={s.leadRank}>{i + 1}</Text>
            <Avatar initials={r.initials} hue={r.hue} size={30} ring="rgba(255,255,255,0.1)" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.rowTitle, r.you && { color: C.emberHi }]}>{r.name}</Text>
              <View style={s.leadTrack}>
                <View style={[s.leadFill, { width: `${(r.km / 50) * 100}%`, backgroundColor: r.you ? C.ember : "rgba(255,255,255,0.28)" }]} />
              </View>
            </View>
            <Text style={s.leadKm}>{r.km.toFixed(1)}</Text>
          </View>
        ))}
        <View style={{ height: 8 }} />
      </Card>
    </>
  );
}

function YouScreen({ name, initials }: { name: string; initials: string }) {
  const ring = useSvgId("you");
  const prs: [string, string, string][] = [
    ["5K", "21:48", "Mar 2026"],
    ["10K", "45:12", "Jun 2026"],
    ["Half", "1:41:30", "Sep 2026"],
    ["Marathon", "—", "Brighton, April?"],
  ];
  return (
    <>
      <View style={[s.header, { alignItems: "center" }]}>
        <View style={s.youRing}>
          <Svg width={64} height={64} viewBox="0 0 64 64" style={StyleSheet.absoluteFill} aria-hidden>
            <Defs>
              <SvgGradient id={ring} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={C.volt} />
                <Stop offset="0.5" stopColor={C.emberHi} />
                <Stop offset="1" stopColor={C.emberLo} />
              </SvgGradient>
            </Defs>
            <Circle cx={32} cy={32} r={30.5} stroke={`url(#${ring})`} strokeWidth={2.5} fill="none" />
          </Svg>
          <Avatar initials={initials} hue={["#FFB487", "#E5583A"]} size={52} ring="transparent" />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.h1, { fontSize: 26 }]}>{name}</Text>
          <Text style={s.cardSub}>Running since March 2024 · 1,284 km</Text>
        </View>
      </View>
      <View style={s.prGrid}>
        {prs.map(([k, v, d]) => (
          <Card key={k} style={s.prTile} pad={16}>
            <Eyebrow>{k.toUpperCase()}</Eyebrow>
            <Text style={[s.tileNum, { marginTop: 8 }, v === "—" && { color: C.faint }]}>{v}</Text>
            <Text style={s.tileFoot}>{d}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <View style={s.rowBetween}>
          <Eyebrow>SHOES · FIELD TRAINER 3</Eyebrow>
          <Text style={s.statLabel}>412 / 650 km</Text>
        </View>
        <View style={s.shoeTrack}>
          <LinearGradient colors={[C.volt, C.emberHi, C.ember]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.shoeFill, { width: `${(412 / 650) * 100}%` }]} />
        </View>
        <Text style={[s.cardSub, { marginTop: 10 }]}>Good for about six more weeks. We’ll nag you.</Text>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Badge: digits roll, one tick of overshoot on arrival                 */
/* ------------------------------------------------------------------ */

function Badge({ count, reduce }: { count: number; reduce: boolean }) {
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

  const fmt = (n: number) => (n > 9 ? "9+" : String(n));
  const dir = pair.curr >= pair.prev ? 1 : -1;
  const showRoll = pair.curr > 0 && pair.prev > 0 && pair.prev !== pair.curr;
  return (
    <Animated.View pointerEvents="none" style={[s.badge, { transform: [{ scale }] }]}>
      <LinearGradient colors={["#FF8B57", C.emberLo]} style={[StyleSheet.absoluteFill, { borderRadius: 9 }]} />
      <View style={s.badgeClip}>
        {showRoll && (
          <Animated.Text
            style={[
              s.badgeText,
              s.badgeAbs,
              {
                opacity: roll.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" }),
                transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -11 * dir] }) }],
              },
            ]}
          >
            {fmt(pair.prev)}
          </Animated.Text>
        )}
        <Animated.Text
          style={[
            s.badgeText,
            showRoll && {
              opacity: roll,
              transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [11 * dir, 0] }) }],
            },
          ]}
        >
          {fmt(pair.curr > 0 ? pair.curr : pair.prev)}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Tab button: outline icon morphs into a filled one                   */
/* ------------------------------------------------------------------ */

function TabButton({ tab, selected, badge, onPress, reduce }: { tab: TabItem; selected: boolean; badge: number; onPress: () => void; reduce: boolean }) {
  const sel = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const fillId = useSvgId("tabFill");

  useEffect(() => {
    if (reduce) {
      Animated.timing(sel, { toValue: selected ? 1 : 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    // Selecting pops once (a single overshoot); deselecting settles flat.
    Animated.spring(sel, { toValue: selected ? 1 : 0, stiffness: selected ? 360 : 500, damping: selected ? 18 : 44, useNativeDriver: true }).start();
  }, [selected, reduce, sel]);

  const springPress = (v: number, fast: boolean) =>
    Animated.spring(press, { toValue: v, stiffness: fast ? 700 : 420, damping: fast ? 40 : 20, useNativeDriver: true }).start();

  const icon = TAB_ICON[tab.key];
  const outlineOpacity = sel.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" });
  const outlineScale = sel.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  const filledOpacity = sel.interpolate({ inputRange: [0.15, 0.7], outputRange: [0, 1], extrapolate: "clamp" });
  const filledScale = sel.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const lift = sel.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const a11y = badge > 0 ? `${tab.label}, ${badge} new` : tab.label;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !reduce && springPress(0.9, true)}
      onPressOut={() => springPress(1, false)}
      accessibilityRole="tab"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      style={s.tab}
    >
      <Animated.View style={[s.tabInner, { transform: [{ scale: press }, { translateY: lift }] }]}>
        <View style={s.iconBox}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: outlineOpacity, transform: [{ scale: outlineScale }] }]}>
            <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
              {icon.outline("rgba(246,243,238,0.66)")}
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: filledOpacity, transform: [{ scale: filledScale }] }]}>
            <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
              <Defs>
                <SvgGradient id={fillId} x1="0.2" y1="0" x2="0.8" y2="1">
                  <Stop offset="0" stopColor="#FFC08F" />
                  <Stop offset="0.5" stopColor={C.ember} />
                  <Stop offset="1" stopColor={C.emberLo} />
                </SvgGradient>
              </Defs>
              {icon.filled(`url(#${fillId})`)}
            </Svg>
          </Animated.View>
          <Badge count={badge} reduce={reduce} />
        </View>
        <View style={s.labelBox}>
          <Animated.Text style={[s.tabLabel, { opacity: outlineOpacity }]}>{tab.label}</Animated.Text>
          <Animated.Text style={[s.tabLabel, s.tabLabelOn, { opacity: filledOpacity }]}>{tab.label}</Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function MobileTabBar({
  tabs = DEFAULT_TABS,
  initialTab = "today",
  runnerName = "Adaeze Okafor",
  dateLine = "THU 9 OCT · WEEK 41",
  goalKm = 40,
  week = DEFAULT_WEEK,
  actions = DEFAULT_ACTIONS,
  onTabChange,
  onAction,
}: MobileTabBarProps) {
  const reduce = useReducedMotion();
  const firstName = runnerName.split(" ")[0];
  const initials = runnerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const baseKm = week.reduce((sum, d) => sum + d.km, 0);

  const [active, setActive] = useState<TabKey>(initialTab);
  const [shown, setShown] = useState<TabKey>(initialTab);
  const [badges, setBadges] = useState<Record<string, number>>(() => Object.fromEntries(tabs.map((t) => [t.key, t.badge ?? 0])));
  const [km, setKm] = useState(baseKm);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<QuickAction | null>(null);
  const [barW, setBarW] = useState(0);

  const fade = useRef(new Animated.Value(1)).current;
  const pending = useRef<TabKey>(initialTab);
  const rise = useRef(new Animated.Value(reduce ? 0 : 36)).current;
  const menu = useRef(new Animated.Value(0)).current;
  const items = useRef(actions.map(() => new Animated.Value(0))).current;
  const fabPress = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(-140)).current;
  const lensL = useRef(new Animated.Value(0)).current;
  const lensR = useRef(new Animated.Value(0)).current;
  const activeRef = useRef(active);
  activeRef.current = active;

  /* entrance: the bar and its action rise into place */
  useEffect(() => {
    Animated.spring(rise, { toValue: 0, stiffness: 260, damping: 28, delay: 120, useNativeDriver: true }).start();
  }, [rise]);

  /* lens geometry */
  const slot = barW / 5;
  const slotIndex = (k: TabKey) => {
    const i = tabs.findIndex((t) => t.key === k);
    return i < 2 ? i : i + 1; // slot 2 is the centre action
  };
  const LENS_INSET = 5;
  const prevSlot = useRef(slotIndex(initialTab));
  const placed = useRef(false);

  useEffect(() => {
    if (!barW) return;
    const to = slotIndex(active);
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
    const lead = { stiffness: 520, damping: 46, mass: 1 };
    const trail = { stiffness: 210, damping: 29, mass: 1 };
    Animated.parallel([
      Animated.spring(lensL, { toValue: l, ...(goingRight ? trail : lead), useNativeDriver: false }),
      Animated.spring(lensR, { toValue: r, ...(goingRight ? lead : trail), useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, barW, reduce]);

  const lensBase = Math.max(slot - LENS_INSET * 2, 1);
  const lensWidth = Animated.subtract(lensR, lensL);
  const lensSquash = lensWidth.interpolate({ inputRange: [lensBase, lensBase * 2.5], outputRange: [1, 0.86], extrapolate: "clamp" });

  /* ambient: a kudos arrives now and then while you're elsewhere */
  useEffect(() => {
    if (reduce) return;
    let n = 0;
    const id = setInterval(() => {
      if (n >= 3) return;
      if (activeRef.current === "club") return;
      n += 1;
      setBadges((b) => ({ ...b, club: Math.min((b.club ?? 0) + 1, 99) }));
    }, 6500);
    return () => clearInterval(id);
  }, [reduce]);

  /* opening Club reads the kudos */
  useEffect(() => {
    if (active !== "club" || !badges.club) return;
    const t = setTimeout(() => setBadges((b) => ({ ...b, club: 0 })), 650);
    return () => clearTimeout(t);
  }, [active, badges.club]);

  const select = (k: TabKey) => {
    if (open) toggleMenu(false);
    if (k === active) return;
    setActive(k);
    onTabChange?.(k);
    pending.current = k;
    Animated.timing(fade, { toValue: 0, duration: reduce ? 60 : 110, easing: EASE_IN, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setShown(pending.current);
      Animated.timing(fade, { toValue: 1, duration: reduce ? 120 : 280, easing: EASE_OUT, useNativeDriver: true }).start();
    });
  };

  /* quick actions */
  const toggleMenu = (next: boolean) => {
    setOpen(next);
    if (reduce) {
      Animated.timing(menu, { toValue: next ? 1 : 0, duration: 120, useNativeDriver: true }).start();
      items.forEach((v) => Animated.timing(v, { toValue: next ? 1 : 0, duration: 120, useNativeDriver: true }).start());
      return;
    }
    if (next) {
      Animated.spring(menu, { toValue: 1, stiffness: 380, damping: 26, useNativeDriver: true }).start();
      Animated.stagger(
        50,
        items.map((v) => Animated.spring(v, { toValue: 1, stiffness: 400, damping: 25, useNativeDriver: true })),
      ).start();
    } else {
      Animated.timing(menu, { toValue: 0, duration: 260, easing: Easing.bezier(0.45, 0, 0.55, 1), useNativeDriver: true }).start();
      Animated.stagger(
        30,
        [...items].reverse().map((v) => Animated.timing(v, { toValue: 0, duration: 170, easing: EASE_IN, useNativeDriver: true })),
      ).start();
    }
  };

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAction = (a: QuickAction) => {
    toggleMenu(false);
    onAction?.(a.key);
    if (a.addKm) setKm((k) => k + (a.addKm ?? 0));
    setToast(a);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastY.stopAnimation();
    Animated.spring(toastY, { toValue: 0, stiffness: 340, damping: 30, delay: 120, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastY, { toValue: -140, duration: 240, easing: EASE_IN, useNativeDriver: true }).start();
    }, 2800);
  };
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const fabDown = () => !reduce && Animated.spring(fabPress, { toValue: 1, stiffness: 700, damping: 40, useNativeDriver: true }).start();
  const fabUp = () => Animated.spring(fabPress, { toValue: 0, stiffness: 420, damping: 18, useNativeDriver: true }).start();

  const onBar = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  const screen = (() => {
    switch (shown) {
      case "routes":
        return <RoutesScreen />;
      case "club":
        return <ClubScreen youKm={km} initials={initials} />;
      case "you":
        return <YouScreen name={runnerName} initials={initials} />;
      default:
        return <TodayScreen name={firstName} initials={initials} dateLine={dateLine} km={km} baseKm={baseKm} goal={goalKm} week={week} reduce={reduce} />;
    }
  })();

  const ARC_R = 118;
  const angles = actions.length === 1 ? [90] : actions.map((_, i) => 150 - (i * 120) / (actions.length - 1));

  return (
    <View style={s.root}>
      {/* ambient light at the top of the stage */}
      <View style={s.stageGlow} pointerEvents="none">
        <Stage />
      </View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: menu.interpolate({ inputRange: [0, 1], outputRange: [1, reduce ? 1 : 0.965] }) }] },
        ]}
      >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: fade,
            transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <ScrollView key={shown} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {screen}
        </ScrollView>
      </Animated.View>
      </Animated.View>

      {/* ---------- the glass bar ---------- */}
      <Animated.View style={[s.barShadow, { transform: [{ translateY: rise }] }]}>
        <View style={s.bar} onLayout={onBar}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Grain opacity={0.05} />
          {/* hairline: bright on top, fading down the sides */}
          <View style={s.hairline} pointerEvents="none" />

          {barW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[s.lens, { left: lensL, width: lensWidth, transform: [{ scaleY: lensSquash }] }]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.17)", "rgba(255,255,255,0.07)"]}
                style={[StyleSheet.absoluteFill, { borderRadius: 27 }]}
              />
            </Animated.View>
          )}

          <View style={s.tabsRow}>
            {tabs.slice(0, 2).map((t) => (
              <TabButton key={t.key} tab={t} selected={active === t.key} badge={badges[t.key] ?? 0} onPress={() => select(t.key)} reduce={reduce} />
            ))}
            <View style={s.tab} />
            {tabs.slice(2, 4).map((t) => (
              <TabButton key={t.key} tab={t} selected={active === t.key} badge={badges[t.key] ?? 0} onPress={() => select(t.key)} reduce={reduce} />
            ))}
          </View>
        </View>
      </Animated.View>

      {/* ---------- scrim + quick actions ---------- */}
      <Animated.View pointerEvents={open ? "auto" : "none"} style={[StyleSheet.absoluteFill, { opacity: menu }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleMenu(false)} accessibilityRole="button" accessibilityLabel="Close quick actions">
          <LinearGradient
            colors={["rgba(9,9,12,0.42)", "rgba(9,9,12,0.78)", "rgba(9,9,12,0.94)"]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.scrimGlow}>
            <ScrimGlow />
          </View>
        </Pressable>
      </Animated.View>

      <View pointerEvents="box-none" style={[s.arc, { bottom: FAB_CENTRE }]}>
        {actions.map((a, i) => {
          const rad = (angles[i] * Math.PI) / 180;
          const x = Math.cos(rad) * ARC_R;
          const y = -Math.sin(rad) * ARC_R;
          const v = items[i];
          return (
            <Animated.View
              key={a.key}
              pointerEvents={open ? "auto" : "none"}
              style={[
                s.arcItem,
                {
                  opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
                  transform: [
                    // Reduced motion: items appear in place, opacity only.
                    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? x : 0, x] }) },
                    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? y : 0, y] }) },
                    { scale: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 1 : 0.35, 1] }) },
                  ],
                },
              ]}
            >
              <Press label={a.label} onPress={() => runAction(a)} scaleTo={0.9} style={s.arcBtn}>
                <LinearGradient colors={["#FFFFFF", "#F3EFE8", "#E4DED4"]} locations={[0, 0.5, 1]} style={[StyleSheet.absoluteFill, { borderRadius: 29 }]} />
                <ActionGlyph icon={a.icon} color={C.ink} />
              </Press>
              <Text style={s.arcLabel} numberOfLines={1}>
                {a.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      {/* ---------- centre action ---------- */}
      <Animated.View pointerEvents="box-none" style={[s.fabWrap, { transform: [{ translateY: rise }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            s.fabGlow,
            {
              opacity: fabPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
              transform: [{ scale: fabPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }, { translateY: fabPress.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
        <Pressable
          onPress={() => toggleMenu(!open)}
          onPressIn={fabDown}
          onPressOut={fabUp}
          accessibilityRole="button"
          accessibilityLabel={open ? "Close quick actions" : "Start an activity"}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
        >
          <Animated.View
            style={[
              s.fab,
              {
                transform: [
                  { translateY: fabPress.interpolate({ inputRange: [0, 1], outputRange: [0, 2.5] }) },
                  { scale: fabPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
                ],
              },
            ]}
          >
            <LinearGradient colors={["#FFA36B", C.ember, C.emberLo]} locations={[0, 0.5, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: menu }]}>
              <LinearGradient colors={["#FFFFFF", "#F1ECE4", "#DDD6CB"]} style={StyleSheet.absoluteFill} />
            </Animated.View>
            {/* specular cap */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <FabSheen />
            </View>
            <Animated.View style={{ transform: [{ rotate: menu.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "135deg"] }) }] }}>
              <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
                <Path d="M12 5v14M5 12h14" stroke={C.ink} strokeWidth={2.2} strokeLinecap="round" opacity={0.92} />
              </Svg>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: menu.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: "clamp" }) }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
                  <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
                </Svg>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* ---------- toast ---------- */}
      <Animated.View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={[s.toastWrap, { transform: [{ translateY: toastY }] }]}
      >
        <View style={s.toast}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(40,40,46,0.55)", "rgba(22,22,26,0.7)"]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0)"]} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
          <View style={s.toastIcon}>
            <LinearGradient colors={["#FFA36B", C.emberLo]} style={[StyleSheet.absoluteFill, { borderRadius: 15 }]} />
            {toast && <ActionGlyph icon={toast.icon} color="#FFFFFF" size={17} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.toastTitle}>{toast?.toast}</Text>
            <Text style={s.toastDetail} numberOfLines={1}>
              {toast?.detail}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function FabSheen() {
  const id = useSvgId("sheen");
  return (
    <Svg width="100%" height="100%" aria-hidden>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="8%" rx="55%" ry="45%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function Stage() {
  const id = useSvgId("stage");
  return (
    <Svg width="100%" height="100%" aria-hidden>
      <Defs>
        <RadialGradient id={id} cx="85%" cy="0%" r="70%">
          <Stop offset="0" stopColor="#FF6B3D" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#FF6B3D" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function ScrimGlow() {
  const id = useSvgId("scrim");
  return (
    <Svg width="100%" height="100%" aria-hidden>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="100%" r="60%">
          <Stop offset="0" stopColor="#FF6B3D" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#FF6B3D" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export default function MobileTabBarDemo() {
  return <MobileTabBar />;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  stageGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 360 },
  scroll: { paddingTop: 58, paddingHorizontal: 16, paddingBottom: 150, gap: 12 },
  center: { alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4, marginBottom: 6 },
  dateLine: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, color: C.faint, marginBottom: 6 },
  h1: { fontSize: 32, fontWeight: "700", letterSpacing: -1, color: C.text },

  eyebrow: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.3, fontWeight: "600" },

  card: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 30px rgba(0,0,0,0.35)",
  },
  pressCard: { borderRadius: 24 },
  cardTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: C.text, marginTop: 6 },
  cardSub: { fontSize: 14, color: C.sub, letterSpacing: -0.1 },

  hero: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 20,
    paddingBottom: 16,
    boxShadow: "0 18px 40px rgba(229,64,47,0.28), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)",
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroNumRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  heroNum: { fontSize: 58, fontWeight: "700", letterSpacing: -2.4, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  heroUnit: { fontSize: 20, fontWeight: "600", color: "rgba(255,255,255,0.78)", marginLeft: 6 },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.82)", marginTop: 2, fontVariant: ["tabular-nums"] },
  ringWrap: { width: 92, height: 92 },
  ringPct: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", fontVariant: ["tabular-nums"], letterSpacing: -0.4 },
  days: { flexDirection: "row", marginTop: 18, gap: 8 },
  dayCol: { flex: 1, alignItems: "center" },
  dayTrack: { height: 40, width: "100%", justifyContent: "flex-end" },
  dayBar: { width: "100%", borderRadius: 6, backgroundColor: "rgba(255,255,255,0.55)" },
  dayToday: { backgroundColor: "#FFFFFF", boxShadow: "0 0 14px rgba(255,255,255,0.45)" },
  dayPlanned: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderStyle: "dashed" },
  dayLabel: { fontFamily: MONO, fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginTop: 6, fontWeight: "600" },

  tiles: { flexDirection: "row", gap: 12 },
  tileNumRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8, marginBottom: 8 },
  tileNum: { fontSize: 28, fontWeight: "700", letterSpacing: -1, color: C.text, fontVariant: ["tabular-nums"] },
  tileUnit: { fontSize: 13, color: C.sub, marginLeft: 4, fontWeight: "600" },
  tileFoot: { fontSize: 12, color: C.faint, marginTop: 8 },
  streakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 34, paddingBottom: 2 },
  streakBar: { width: 6, height: 26, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)" },
  streakNow: { backgroundColor: C.volt, boxShadow: "0 0 10px rgba(217,243,106,0.6)" },

  avatars: { flexDirection: "row" },
  avatar: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarText: { color: "#FFFFFF", fontWeight: "800", letterSpacing: -0.2 },

  statRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  statVal: { fontSize: 17, fontWeight: "700", color: C.text, fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
  statLabel: { fontSize: 12, color: C.faint, marginTop: 2 },
  mapWrap: { height: 172, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.06)" },
  pin: { position: "absolute", width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 7, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" },
  pinCore: { width: 7, height: 7, borderRadius: 4 },
  mapFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  mapCaption: { position: "absolute", left: 18, right: 18, bottom: 16 },

  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 12 },
  listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  rowTitle: { fontSize: 15.5, fontWeight: "600", color: C.text, letterSpacing: -0.2 },
  rowSub: { fontSize: 13, color: C.sub, marginTop: 3, fontVariant: ["tabular-nums"] },

  leadRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 10 },
  leadYou: { backgroundColor: "rgba(255,107,61,0.08)" },
  leadRank: { width: 22, fontFamily: MONO, fontSize: 12, color: C.faint },
  leadTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 6, overflow: "hidden" },
  leadFill: { height: 4, borderRadius: 2 },
  leadKm: { width: 52, textAlign: "right", fontSize: 15, fontWeight: "700", color: C.text, fontVariant: ["tabular-nums"] },

  youRing: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  prTile: { width: "47.5%", flexGrow: 1 },
  shoeTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", marginTop: 14, overflow: "hidden" },
  shoeFill: { height: 8, borderRadius: 4 },

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
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
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
    top: 7,
    bottom: 7,
    borderRadius: 27,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.04), 0 4px 14px rgba(0,0,0,0.25)",
  },
  tabsRow: { flex: 1, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabInner: { alignItems: "center", justifyContent: "center", paddingTop: 2 },
  iconBox: { width: 26, height: 26 },
  labelBox: { height: 14, marginTop: 3, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.1, color: "rgba(246,243,238,0.6)" },
  tabLabelOn: { position: "absolute", color: "#FFFFFF", fontWeight: "700" },

  badge: {
    position: "absolute",
    top: -5,
    left: 15,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(229,64,47,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
  },
  badgeClip: { height: 18, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", fontVariant: ["tabular-nums"], lineHeight: 18 },
  badgeAbs: { position: "absolute" },

  fabWrap: { position: "absolute", left: 0, right: 0, bottom: FAB_CENTRE - FAB / 2, alignItems: "center" },
  fabGlow: {
    position: "absolute",
    top: 8,
    width: FAB - 6,
    height: FAB - 6,
    borderRadius: FAB,
    boxShadow: "0 14px 30px rgba(255,92,50,0.55), 0 8px 16px rgba(0,0,0,0.3)",
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 6px rgba(140,20,20,0.3)",
  },

  scrimGlow: { position: "absolute", left: 0, right: 0, bottom: 0, height: 420 },
  arc: { position: "absolute", left: 0, right: 0, height: 0, alignItems: "center" },
  arcItem: { position: "absolute", top: -29, width: 110, marginLeft: -55, left: "50%", alignItems: "center" },
  arcBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 26px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.08)",
  },
  arcLabel: { marginTop: 8, fontSize: 12.5, fontWeight: "600", color: "#FFFFFF", letterSpacing: -0.1 },

  toastWrap: { position: "absolute", top: 52, left: 16, right: 16 },
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
  toastIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  toastTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.2 },
  toastDetail: { fontSize: 12.5, color: "rgba(255,255,255,0.68)", marginTop: 1 },
});
