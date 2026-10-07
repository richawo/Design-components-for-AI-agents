import { useEffect, useRef, useState, type ReactNode } from "react";
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
} from "react-native";

export type TabKey = "today" | "routes" | "club" | "you";

export type TabItem = { key: TabKey; label: string };

export type WeekDay = { day: string; km: number };
export type RouteItem = { name: string; area: string; km: number; climb: number; shape: number[] };
export type Runner = { name: string; km: number; you?: boolean };
export type PersonalBest = { label: string; time: string; date: string };

export type MobileTabBarProps = {
  tabs?: TabItem[];
  initialTab?: TabKey;
  runnerName?: string;
  weeklyGoalKm?: number;
  week?: WeekDay[];
  routes?: RouteItem[];
  club?: { name: string; members: number; runners: Runner[] };
  bests?: PersonalBest[];
  /** Fired when the raised centre button starts or stops a run. */
  onRecordChange?: (recording: boolean) => void;
};

const BG = "#0E0F0B";
const SURFACE = "#1A1B16";
const RAISED = "#23241E";
const LINE = "rgba(242,241,234,0.08)";
const TEXT = "#F2F1EA";
const MUTED = "rgba(242,241,234,0.56)";
const LIME = "#D4FF3A";
const native = Platform.OS !== "web";
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const DEFAULT_TABS: TabItem[] = [
  { key: "today", label: "Today" },
  { key: "routes", label: "Routes" },
  { key: "club", label: "Club" },
  { key: "you", label: "You" },
];

const DEFAULT_WEEK: WeekDay[] = [
  { day: "M", km: 6.2 },
  { day: "T", km: 8.0 },
  { day: "W", km: 0 },
  { day: "T", km: 5.1 },
  { day: "F", km: 4.3 },
  { day: "S", km: 0 },
  { day: "S", km: 8.8 },
];

const DEFAULT_ROUTES: RouteItem[] = [
  { name: "Rye Lane Loop", area: "Peckham", km: 5.2, climb: 38, shape: [0.7, 0.3, 0.55, 0.15, 0.4, 0.65, 0.35] },
  { name: "One Tree Hill Repeats", area: "Honor Oak", km: 7.8, climb: 141, shape: [0.8, 0.2, 0.7, 0.2, 0.75, 0.25, 0.6] },
  { name: "Canal to Burgess Park", area: "Camberwell", km: 10.4, climb: 22, shape: [0.5, 0.45, 0.5, 0.4, 0.45, 0.5, 0.42] },
  { name: "Thames Path Long Run", area: "Rotherhithe", km: 14.2, climb: 9, shape: [0.3, 0.55, 0.7, 0.6, 0.35, 0.5, 0.75] },
];

const DEFAULT_CLUB = {
  name: "Sunday Social",
  members: 41,
  runners: [
    { name: "Tomasz Wilk", km: 61.4 },
    { name: "Priya Raman", km: 54.0 },
    { name: "Adaeze Obi", km: 32.4, you: true },
    { name: "Jonah Feld", km: 29.9 },
    { name: "Mireille Gast", km: 21.7 },
  ],
};

const DEFAULT_BESTS: PersonalBest[] = [
  { label: "5K", time: "22:41", date: "Sep 14" },
  { label: "10K", time: "47:09", date: "Aug 03" },
  { label: "Half", time: "1:46:30", date: "Apr 27" },
];

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

export function MobileTabBar({
  tabs = DEFAULT_TABS,
  initialTab = "today",
  runnerName = "Adaeze",
  weeklyGoalKm = 40,
  week = DEFAULT_WEEK,
  routes = DEFAULT_ROUTES,
  club = DEFAULT_CLUB,
  bests = DEFAULT_BESTS,
  onRecordChange,
}: MobileTabBarProps) {
  const [active, setActive] = useState<TabKey | "record">(initialTab);
  const [recording, setRecording] = useState(false);
  const [barW, setBarW] = useState(0);
  const reduced = useReducedMotion();

  // Five slots: two tabs, the raised button, two tabs.
  const slots: (TabItem | "record")[] = [tabs[0], tabs[1], "record", tabs[2], tabs[3]];
  const slot = barW / 5;
  const activeSlot = slots.findIndex((s) => (s === "record" ? active === "record" : s.key === active));

  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorOn = useRef(new Animated.Value(1)).current;
  const screen = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!barW || activeSlot < 0) return;
    const to = activeSlot * slot + slot / 2 - 10;
    if (!placed.current || reduced) {
      indicatorX.setValue(to);
      placed.current = true;
    } else {
      Animated.spring(indicatorX, { toValue: to, useNativeDriver: native, stiffness: 320, damping: 24, mass: 0.9 }).start();
    }
    Animated.timing(indicatorOn, { toValue: active === "record" ? 0 : 1, duration: 180, useNativeDriver: native }).start();
  }, [activeSlot, slot, barW, reduced, active, indicatorX, indicatorOn]);

  const select = (key: TabKey | "record") => {
    if (key === "record" && active === "record") {
      const next = !recording;
      setRecording(next);
      onRecordChange?.(next);
      return;
    }
    if (key === active) return;
    setActive(key);
    if (reduced) return;
    screen.setValue(0);
    Animated.timing(screen, { toValue: 1, duration: 320, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: native }).start();
  };

  const onBarLayout = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  let body: ReactNode;
  if (active === "routes") body = <RoutesScreen routes={routes} />;
  else if (active === "club") body = <ClubScreen club={club} />;
  else if (active === "you") body = <YouScreen name={runnerName} bests={bests} />;
  else if (active === "record") body = <RecordScreen recording={recording} reduced={reduced} />;
  else body = <TodayScreen name={runnerName} week={week} goal={weeklyGoalKm} />;

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.screen,
          { opacity: screen, transform: [{ translateY: screen.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      </Animated.View>

      <View style={styles.barWrap} pointerEvents="box-none">
        <View style={styles.bar} onLayout={onBarLayout} accessibilityRole="tablist">
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { opacity: indicatorOn, transform: [{ translateX: indicatorX }] }]}
          />
          {slots.map((s, i) =>
            s === "record" ? (
              <View key="record" style={styles.slot} />
            ) : (
              <TabButton key={s.key} item={s} active={active === s.key} onPress={() => select(s.key)} index={i} reduced={reduced} />
            ),
          )}
        </View>
        <RecordButton recording={recording} armed={active === "record"} onPress={() => select("record")} />
      </View>
    </View>
  );
}

function TabButton({ item, active, onPress, reduced }: { item: TabItem; active: boolean; onPress: () => void; index: number; reduced: boolean }) {
  const t = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) t.setValue(active ? 1 : 0);
    else Animated.spring(t, { toValue: active ? 1 : 0, useNativeDriver: native, stiffness: 300, damping: 22 }).start();
  }, [active, reduced, t]);
  const color = active ? LIME : MUTED;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.slot, pressed && { opacity: 0.6 }]}
    >
      <Animated.View style={{ transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }}>
        <TabIcon kind={item.key} color={color} />
      </Animated.View>
      <Animated.Text
        style={[
          styles.tabLabel,
          { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
        ]}
      >
        {item.label}
      </Animated.Text>
    </Pressable>
  );
}

function RecordButton({ recording, armed, onPress }: { recording: boolean; armed: boolean; onPress: () => void }) {
  const label = armed ? (recording ? "Stop run" : "Start run") : "Record a run";
  return (
    <View style={styles.recordWell} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: armed }}
        style={({ pressed }) => [styles.recordBtn, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        {recording ? (
          <View style={styles.stopGlyph} />
        ) : (
          <View style={styles.playGlyph} />
        )}
      </Pressable>
    </View>
  );
}

/* ——— Icons, drawn from Views ——— */

function TabIcon({ kind, color }: { kind: TabKey; color: string }) {
  if (kind === "today") {
    // a sun-dial: ring with a needle
    return (
      <View style={styles.icon}>
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color, alignItems: "center" }}>
          <View style={{ width: 2, height: 7, marginTop: 3, borderRadius: 1, backgroundColor: color }} />
          <View style={{ position: "absolute", top: 8, left: 7.5, width: 6, height: 2, borderRadius: 1, backgroundColor: color }} />
        </View>
      </View>
    );
  }
  if (kind === "routes") {
    // a map pin
    return (
      <View style={styles.icon}>
        <View
          style={{
            width: 16,
            height: 16,
            marginTop: -3,
            borderWidth: 2,
            borderColor: color,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 1,
            transform: [{ rotate: "45deg" }],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
        </View>
      </View>
    );
  }
  if (kind === "club") {
    // a podium
    return (
      <View style={[styles.icon, { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 2, paddingBottom: 2 }]}>
        <View style={{ width: 5, height: 9, borderRadius: 1.5, backgroundColor: color }} />
        <View style={{ width: 5, height: 16, borderRadius: 1.5, backgroundColor: color }} />
        <View style={{ width: 5, height: 12, borderRadius: 1.5, backgroundColor: color }} />
      </View>
    );
  }
  // you: head and shoulders
  return (
    <View style={[styles.icon, { alignItems: "center" }]}>
      <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: color, marginTop: 1 }} />
      <View style={{ width: 16, height: 8, marginTop: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0, borderColor: color }} />
    </View>
  );
}

/* ——— Screens ——— */

function Kicker({ children }: { children: ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

function TodayScreen({ name, week, goal }: { name: string; week: WeekDay[]; goal: number }) {
  const total = week.reduce((a, d) => a + d.km, 0);
  const max = Math.max(...week.map((d) => d.km), 1);
  const pct = Math.min(1, total / goal);
  const todayIndex = week.length - 1;
  return (
    <View>
      <Kicker>Tue 7 Oct · Week 41</Kicker>
      <Text style={styles.h1} accessibilityRole="header">
        Morning, {name}.
      </Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>This week</Text>
          <Text style={styles.cardMeta}>{Math.round(pct * 100)}% of {goal} km</Text>
        </View>
        <View style={styles.bigRow}>
          <Text style={styles.bigNum}>{total.toFixed(1)}</Text>
          <Text style={styles.bigUnit}>km</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={styles.chart} accessibilityLabel={`Daily distance this week, ${week.map((d) => `${d.km} km`).join(", ")}`}>
          {week.map((d, i) => (
            <View key={i} style={styles.chartCol}>
              <View style={styles.chartBarArea}>
                {d.km > 0 ? (
                  <View style={[styles.chartBar, { height: `${(d.km / max) * 100}%`, backgroundColor: i === todayIndex ? LIME : RAISED }]} />
                ) : (
                  <View style={styles.restDot} />
                )}
              </View>
              <Text style={[styles.chartDay, i === todayIndex && { color: LIME }]}>{d.day}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.card, styles.nextCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Next up · 6:30 pm</Text>
          <Text style={styles.nextTitle}>Tempo Tuesday</Text>
          <Text style={styles.nextMeta}>6 × 800 m at 4:25/km, 90 s jog between</Text>
        </View>
        <View style={styles.nextBadge}>
          <Text style={styles.nextBadgeNum}>6</Text>
          <Text style={styles.nextBadgeX}>× 800</Text>
        </View>
      </View>
      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>Shoes · Field Trainer 3</Text>
          <Text style={[styles.cardMeta, { color: TEXT }]}>412 / 650 km</Text>
        </View>
        <View style={styles.shoeTrack}>
          {Array.from({ length: 26 }, (_, i) => (
            <View key={i} style={[styles.shoeTick, { backgroundColor: i < Math.round((412 / 650) * 26) ? TEXT : RAISED }]} />
          ))}
        </View>
        <Text style={styles.nextMeta}>Good for about six more weeks. We’ll nag you.</Text>
      </View>
    </View>
  );
}

function RouteLine({ shape }: { shape: number[] }) {
  // A polyline drawn from rotated segments inside a 96 × 56 box.
  const W = 96;
  const H = 56;
  const pts = shape.map((y, i) => ({ x: 8 + (i * (W - 16)) / (shape.length - 1), y: 8 + y * (H - 16) }));
  return (
    <View style={styles.routeArt}>
      {pts.slice(1).map((p, i) => {
        const a = pts[i];
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: (a.x + p.x) / 2 - len / 2,
              top: (a.y + p.y) / 2 - 1.5,
              width: len + 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: LIME,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      <View style={[styles.routeDot, { left: pts[0].x - 4, top: pts[0].y - 4, backgroundColor: TEXT }]} />
      <View style={[styles.routeDot, { left: pts[pts.length - 1].x - 4, top: pts[pts.length - 1].y - 4, borderWidth: 2, borderColor: LIME, backgroundColor: SURFACE }]} />
    </View>
  );
}

function RoutesScreen({ routes }: { routes: RouteItem[] }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Loops", "Hills", "Flat", "Long"];
  return (
    <View>
      <Kicker>Saved · {routes.length} routes</Kicker>
      <Text style={styles.h1} accessibilityRole="header">
        Routes near you.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: 8 }}>
        {filters.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            style={[styles.chip, filter === f && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f && { color: BG }]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ gap: 10 }}>
        {routes.map((r) => (
          <Pressable
            key={r.name}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}, ${r.km} kilometres, ${r.climb} metres of climb`}
            style={({ pressed }) => [styles.card, styles.routeCard, pressed && { backgroundColor: RAISED }]}
          >
            <RouteLine shape={r.shape} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeName}>{r.name}</Text>
              <Text style={styles.routeArea}>{r.area}</Text>
              <View style={styles.routeStats}>
                <Text style={styles.routeStat}>{r.km.toFixed(1)} km</Text>
                <View style={styles.sep} />
                <Text style={styles.routeStat}>↑ {r.climb} m</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function initials(n: string) {
  return n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

function ClubScreen({ club }: { club: { name: string; members: number; runners: Runner[] } }) {
  const max = Math.max(...club.runners.map((r) => r.km), 1);
  return (
    <View>
      <Kicker>{club.members} runners · October</Kicker>
      <Text style={styles.h1} accessibilityRole="header">
        {club.name}.
      </Text>
      <View style={[styles.card, { paddingVertical: 6 }]}>
        {club.runners.map((r, i) => (
          <View key={r.name} style={[styles.runner, i > 0 && styles.runnerLine]}>
            <Text style={[styles.rank, i === 0 && { color: LIME }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={[styles.avatar, r.you && { backgroundColor: LIME }]}>
              <Text style={[styles.avatarText, r.you && { color: BG }]}>{initials(r.name)}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.runnerName}>
                {r.name}
                {r.you ? <Text style={{ color: LIME }}>  you</Text> : null}
              </Text>
              <View style={styles.runnerTrack}>
                <View style={[styles.runnerFill, { width: `${(r.km / max) * 100}%`, backgroundColor: r.you ? LIME : "rgba(242,241,234,0.28)" }]} />
              </View>
            </View>
            <Text style={styles.runnerKm}>{r.km.toFixed(1)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>Kilometres this month. Resets Saturday 1 Nov.</Text>
      <View style={[styles.card, styles.meetCard]}>
        <View style={styles.meetDate}>
          <Text style={styles.meetDay}>11</Text>
          <Text style={styles.meetMonth}>OCT</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeName}>Saturday shakeout</Text>
          <Text style={styles.routeArea}>8:00 am · Rye gate · 6 km easy</Text>
          <View style={styles.faces}>
            {["TW", "PR", "JF", "MG"].map((n, i) => (
              <View key={n} style={[styles.face, { marginLeft: i ? -6 : 0 }]}>
                <Text style={styles.faceText}>{n}</Text>
              </View>
            ))}
            <Text style={[styles.routeArea, { marginLeft: 8, marginTop: 0 }]}>+10 going</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function YouScreen({ name, bests }: { name: string; bests: PersonalBest[] }) {
  return (
    <View>
      <Kicker>Member since March 2023</Kicker>
      <Text style={styles.h1} accessibilityRole="header">
        {name} Obi.
      </Text>
      <View style={styles.statGrid}>
        {[
          { v: "1,284", l: "km this year" },
          { v: "142", l: "runs" },
          { v: "5:12", l: "avg pace /km" },
          { v: "11", l: "week streak" },
        ].map((s) => (
          <View key={s.l} style={[styles.card, styles.statCell]}>
            <Text style={styles.statNum}>{s.v}</Text>
            <Text style={styles.statLabel}>{s.l}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.cardLabel, { marginTop: 22, marginBottom: 10 }]}>Personal bests</Text>
      <View style={[styles.card, { paddingVertical: 4 }]}>
        {bests.map((b, i) => (
          <View key={b.label} style={[styles.pbRow, i > 0 && styles.runnerLine]}>
            <Text style={styles.pbLabel}>{b.label}</Text>
            <Text style={styles.pbDate}>{b.date}</Text>
            <Text style={styles.pbTime}>{b.time}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecordScreen({ recording, reduced }: { recording: boolean; reduced: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const km = (seconds * 0.0031).toFixed(2);
  return (
    <View>
      <View style={styles.gpsRow}>
        <View style={styles.gpsDotWrap}>
          <Animated.View
            style={[
              styles.gpsPulse,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] },
            ]}
          />
          <View style={styles.gpsDot} />
        </View>
        <Text style={styles.kickerInline}>GPS locked · ±4 m</Text>
      </View>
      <Text style={styles.h1} accessibilityRole="header">
        {recording ? "Running." : "Ready when you are."}
      </Text>
      <View style={[styles.card, { alignItems: "flex-start", paddingVertical: 24 }]} accessibilityLiveRegion="polite">
        <Text style={styles.cardLabel}>Distance</Text>
        <View style={styles.bigRow}>
          <Text style={[styles.bigNum, { fontSize: 76, lineHeight: 80 }]}>{km}</Text>
          <Text style={styles.bigUnit}>km</Text>
        </View>
        <View style={styles.recordStats}>
          <View>
            <Text style={styles.cardLabel}>Time</Text>
            <Text style={styles.recordStat}>
              {mm}:{ss}
            </Text>
          </View>
          <View>
            <Text style={styles.cardLabel}>Pace</Text>
            <Text style={styles.recordStat}>{recording && seconds > 5 ? "5:23" : "—"}</Text>
          </View>
          <View>
            <Text style={styles.cardLabel}>Heart</Text>
            <Text style={styles.recordStat}>{recording ? 142 + (seconds % 7) : 64}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>Workout loaded</Text>
          <Text style={styles.cardMeta}>Tempo Tuesday</Text>
        </View>
        <View style={styles.blocks}>
          <View style={[styles.block, { flex: 3, backgroundColor: recording ? LIME : RAISED }]} />
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={{ flex: 3.4, flexDirection: "row", gap: 3 }}>
              <View style={[styles.block, { flex: 2.4, backgroundColor: "rgba(212,255,58,0.38)", height: 34 }]} />
              <View style={[styles.block, { flex: 1, backgroundColor: RAISED }]} />
            </View>
          ))}
          <View style={[styles.block, { flex: 3, backgroundColor: RAISED }]} />
        </View>
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={styles.blockLabel}>Warm-up 10:00</Text>
          <Text style={styles.blockLabel}>6 × 800 m</Text>
          <Text style={styles.blockLabel}>Cool-down</Text>
        </View>
      </View>
      <Text style={styles.footnote}>{recording ? "Tap the square to finish and save." : "Tap the lime button to start. Auto-pause is on."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  screen: { flex: 1 },
  scroll: { paddingTop: 62, paddingHorizontal: 20, paddingBottom: 140 },
  kicker: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: MUTED, marginBottom: 10 },
  kickerInline: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: MUTED },
  h1: { fontSize: 34, lineHeight: 36, fontWeight: "800", letterSpacing: -1.4, color: TEXT, marginBottom: 22 },
  card: { backgroundColor: SURFACE, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: LINE },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontSize: 12, fontWeight: "600", color: MUTED, letterSpacing: 0.2 },
  cardMeta: { fontSize: 12, fontWeight: "600", color: LIME, fontVariant: ["tabular-nums"] },
  bigRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 6 },
  bigNum: { fontSize: 64, lineHeight: 66, fontWeight: "800", letterSpacing: -3, color: TEXT, fontVariant: ["tabular-nums"] },
  bigUnit: { fontSize: 18, fontWeight: "700", color: MUTED, marginBottom: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: RAISED, marginTop: 12, overflow: "hidden" },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: LIME },
  chart: { flexDirection: "row", gap: 8, marginTop: 22, height: 116 },
  chartCol: { flex: 1, alignItems: "center", gap: 8 },
  chartBarArea: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  chartBar: { width: "100%", borderRadius: 8, minHeight: 8 },
  restDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RAISED, marginBottom: 1 },
  chartDay: { fontSize: 11, fontWeight: "700", color: MUTED },
  nextCard: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 14 },
  nextTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: TEXT, marginTop: 6 },
  nextMeta: { fontSize: 14, lineHeight: 20, color: MUTED, marginTop: 4 },
  nextBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: LIME, alignItems: "center", justifyContent: "center" },
  nextBadgeNum: { fontSize: 22, lineHeight: 24, fontWeight: "800", color: BG, letterSpacing: -0.8 },
  nextBadgeX: { fontSize: 10, fontWeight: "800", color: BG, letterSpacing: 0.3 },
  routeCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 14 },
  routeArt: { width: 96, height: 56, borderRadius: 14, backgroundColor: RAISED, overflow: "hidden" },
  routeDot: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  routeName: { fontSize: 16, fontWeight: "700", color: TEXT, letterSpacing: -0.3 },
  routeArea: { fontSize: 13, color: MUTED, marginTop: 2 },
  routeStats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  routeStat: { fontFamily: MONO, fontSize: 12, color: TEXT, fontVariant: ["tabular-nums"] },
  sep: { width: 3, height: 3, borderRadius: 2, backgroundColor: MUTED },
  runner: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  runnerLine: { borderTopWidth: 1, borderTopColor: LINE },
  rank: { width: 20, fontFamily: MONO, fontSize: 12, color: MUTED, fontVariant: ["tabular-nums"] },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: RAISED, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "800", color: TEXT, letterSpacing: 0.2 },
  runnerName: { fontSize: 15, fontWeight: "600", color: TEXT },
  runnerTrack: { height: 4, borderRadius: 2, backgroundColor: RAISED, overflow: "hidden" },
  runnerFill: { height: 4, borderRadius: 2 },
  runnerKm: { width: 44, textAlign: "right", fontSize: 15, fontWeight: "700", color: TEXT, fontVariant: ["tabular-nums"] },
  footnote: { fontSize: 13, color: MUTED, marginTop: 14, lineHeight: 19 },
  shoeTrack: { flexDirection: "row", gap: 3, marginTop: 14, marginBottom: 10, height: 18 },
  shoeTick: { flex: 1, borderRadius: 2 },
  chips: { marginBottom: 14, marginHorizontal: -20, paddingHorizontal: 20, flexGrow: 0 },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(242,241,234,0.16)", justifyContent: "center" },
  chipOn: { backgroundColor: LIME, borderColor: LIME },
  chipText: { fontSize: 14, fontWeight: "700", color: TEXT },
  meetCard: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  meetDate: { width: 56, height: 64, borderRadius: 16, backgroundColor: LIME, alignItems: "center", justifyContent: "center" },
  meetDay: { fontSize: 24, lineHeight: 26, fontWeight: "800", color: BG, letterSpacing: -0.8 },
  meetMonth: { fontSize: 10, fontWeight: "800", color: BG, letterSpacing: 1.2 },
  faces: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  face: { width: 30, height: 30, borderRadius: 15, backgroundColor: RAISED, borderWidth: 2, borderColor: SURFACE, alignItems: "center", justifyContent: "center" },
  faceText: { fontSize: 10, fontWeight: "800", color: TEXT },
  blocks: { flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 16 },
  block: { height: 18, borderRadius: 4 },
  blockLabel: { fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: 0.4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCell: { flexBasis: "47%", flexGrow: 1, paddingVertical: 16 },
  statNum: { fontSize: 30, fontWeight: "800", letterSpacing: -1.2, color: TEXT, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13, color: MUTED, marginTop: 2 },
  pbRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  pbLabel: { width: 56, fontSize: 15, fontWeight: "800", color: LIME },
  pbDate: { flex: 1, fontSize: 13, color: MUTED },
  pbTime: { fontSize: 20, fontWeight: "700", color: TEXT, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  gpsDotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME },
  gpsPulse: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: LIME },
  recordStats: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch", marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: LINE },
  recordStat: { fontSize: 24, fontWeight: "700", color: TEXT, letterSpacing: -0.6, marginTop: 4, fontVariant: ["tabular-nums"] },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 26 },
  bar: {
    height: 68,
    borderRadius: 34,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: "rgba(242,241,234,0.1)",
    flexDirection: "row",
    alignItems: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  slot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 44 },
  indicator: { position: "absolute", top: -1, left: 0, width: 20, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: LIME },
  icon: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 11, fontWeight: "700", color: LIME, letterSpacing: 0.2 },
  recordWell: { position: "absolute", left: 0, right: 0, bottom: 50, alignItems: "center" },
  recordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: LIME,
    borderWidth: 6,
    borderColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: BG,
  },
  stopGlyph: { width: 18, height: 18, borderRadius: 4, backgroundColor: BG },
});

export default function MobileTabBarDemo() {
  return <MobileTabBar />;
}
