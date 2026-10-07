import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type LayoutChangeEvent,
} from "react-native";

export type Appearance = "light" | "dark" | "auto";

export type SettingsProfile = {
  name: string;
  email: string;
  plan: string;
  /** Shown beside the plan row, e.g. "Renews 2 March". */
  renews: string;
  stats: { value: string; label: string }[];
};

export type MobileSettingsProps = {
  appName?: string;
  version?: string;
  profile?: SettingsProfile;
  initialAppearance?: Appearance;
  onAppearanceChange?: (value: Appearance) => void;
  onSignOut?: () => void;
};

/* ——— Palette: warm linen by day, espresso by night ——— */

const LIGHT = {
  bg: "#F4EEE4",
  card: "#FFFCF7",
  ink: "#2B2420",
  sub: "#857868",
  line: "#ECE3D6",
  chip: "#F1E8DB",
  accent: "#C4572E",
  accentSoft: "#F5DFD2",
  track: "#E3D8C8",
  thumb: "#FFFFFF",
  danger: "#B4321F",
};
type Palette = typeof LIGHT;
const DARK: Palette = {
  bg: "#191512",
  card: "#241F1B",
  ink: "#F3EBE0",
  sub: "#A69885",
  line: "#342D27",
  chip: "#2F2823",
  accent: "#E2794C",
  accentSoft: "#3D2A20",
  track: "#3D352E",
  thumb: "#FBF6EF",
  danger: "#F07A62",
};
type Key = keyof Palette;
type Col = (k: Key) => Animated.AnimatedInterpolation<string | number>;

const ThemeCtx = createContext<Col>(() => new Animated.Value(0).interpolate({ inputRange: [0, 1], outputRange: [LIGHT.ink, LIGHT.ink] }));
const useCol = () => useContext(ThemeCtx);

const native = Platform.OS !== "web";

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

export function MobileSettings({
  appName = "Folio",
  version = "4.12 (2210)",
  profile = {
    name: "Inês Marlowe",
    email: "ines@marlowe.studio",
    plan: "Folio Plus",
    renews: "Renews 2 March",
    stats: [
      { value: "412", label: "entries" },
      { value: "38", label: "day streak" },
      { value: "96k", label: "words" },
    ],
  },
  initialAppearance = "light",
  onAppearanceChange,
  onSignOut,
}: MobileSettingsProps) {
  const system = useColorScheme();
  const reduced = useReducedMotion();
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const dark = appearance === "dark" || (appearance === "auto" && system === "dark");
  const t = useRef(new Animated.Value(dark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(t, { toValue: dark ? 1 : 0, duration: reduced ? 0 : 420, useNativeDriver: false }).start();
  }, [dark, reduced, t]);

  const col: Col = (k) => t.interpolate({ inputRange: [0, 1], outputRange: [LIGHT[k], DARK[k]] });

  const [toggles, setToggles] = useState({ reminder: true, prompts: true, faceId: false, cellular: true });
  const flip = (k: keyof typeof toggles) => setToggles((s) => ({ ...s, [k]: !s[k] }));

  const choose = (v: Appearance) => {
    setAppearance(v);
    onAppearanceChange?.(v);
  };

  return (
    <ThemeCtx.Provider value={col}>
      <Animated.View style={[styles.root, { backgroundColor: col("bg") }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Animated.Text style={[styles.title, { color: col("ink") }]} accessibilityRole="header">
              Settings
            </Animated.Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} style={({ pressed }) => [styles.done, pressed && { opacity: 0.5 }]}>
              <Animated.Text style={[styles.doneText, { color: col("accent") }]}>Done</Animated.Text>
            </Pressable>
          </View>

          <ProfileCard profile={profile} />

          <Group title="Appearance">
            <View style={styles.segmentRow}>
              <Segmented value={appearance} onChange={choose} reduced={reduced} />
              <Animated.Text style={[styles.hint, { color: col("sub") }]}>
                {appearance === "auto" ? `Following your phone — ${system === "dark" ? "dark" : "light"} right now.` : appearance === "dark" ? "Easier on the eyes after midnight." : "Ink on linen, like a good notebook."}
              </Animated.Text>
            </View>
            <Row icon={<GlyphIcon glyph="Aa" />} label="Text size" value="Comfortable" />
            <Row icon={<AppIconGlyph />} label="App icon" value="Linen" last />
          </Group>

          <Group title="Writing">
            <Row icon={<BellIcon />} label="Daily reminder" detail="8:30 pm on weekdays" right={<Switch value={toggles.reminder} onChange={() => flip("reminder")} label="Daily reminder" reduced={reduced} />} />
            <Row icon={<NotebookIcon />} label="Default notebook" value="Morning pages" />
            <Row icon={<GlyphIcon glyph="“" big />} label="Writing prompts" detail="One gentle question a day" right={<Switch value={toggles.prompts} onChange={() => flip("prompts")} label="Writing prompts" reduced={reduced} />} last />
          </Group>

          <Group title="Privacy & data">
            <Row icon={<LockIcon />} label="Lock with Face ID" right={<Switch value={toggles.faceId} onChange={() => flip("faceId")} label="Lock with Face ID" reduced={reduced} />} />
            <Row icon={<GlyphIcon glyph="⇅" />} label="Sync on mobile data" right={<Switch value={toggles.cellular} onChange={() => flip("cellular")} label="Sync on mobile data" reduced={reduced} />} />
            <Row icon={<GlyphIcon glyph="↗" />} label="Export journal" value="Markdown" last />
          </Group>

          <Group title="Account">
            <Row icon={<GlyphIcon glyph="◆" small />} label={profile.plan} value={profile.renews} />
            <Row icon={<GlyphIcon glyph="?" />} label="Help & feedback" last />
          </Group>

          <Animated.View style={[styles.card, styles.signOutCard, { backgroundColor: col("card"), borderColor: col("line") }]}>
            <Pressable onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sign out" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.55 }]}>
              <Animated.Text style={[styles.signOutText, { color: col("danger") }]}>Sign out</Animated.Text>
            </Pressable>
          </Animated.View>

          <Animated.Text style={[styles.footer, { color: col("sub") }]}>
            {appName} {version}
            {"\n"}Written, slowly, in Lisbon.
          </Animated.Text>
        </ScrollView>
      </Animated.View>
    </ThemeCtx.Provider>
  );
}

/* ——— Pieces ——— */

function ProfileCard({ profile }: { profile: SettingsProfile }) {
  const col = useCol();
  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <Animated.View style={[styles.card, styles.profile, { backgroundColor: col("card"), borderColor: col("line") }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${profile.name}, edit profile`} style={({ pressed }) => [styles.profileTop, pressed && { opacity: 0.7 }]}>
        <Animated.View style={[styles.avatar, { backgroundColor: col("accentSoft") }]}>
          <Animated.Text style={[styles.avatarText, { color: col("accent") }]}>{initials}</Animated.Text>
          <Animated.View style={[styles.avatarBadge, { backgroundColor: col("accent"), borderColor: col("card") }]}>
            <Text style={styles.avatarBadgeText}>+</Text>
          </Animated.View>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Animated.Text style={[styles.name, { color: col("ink") }]}>{profile.name}</Animated.Text>
          <Animated.Text style={[styles.email, { color: col("sub") }]}>{profile.email}</Animated.Text>
          <Animated.View style={[styles.planPill, { backgroundColor: col("accentSoft") }]}>
            <Animated.Text style={[styles.planText, { color: col("accent") }]}>{profile.plan}</Animated.Text>
          </Animated.View>
        </View>
        <Chevron />
      </Pressable>
      <Animated.View style={[styles.stats, { borderTopColor: col("line") }]}>
        {profile.stats.map((s, i) => (
          <Animated.View key={s.label} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: col("line") }]}>
            <Animated.Text style={[styles.statValue, { color: col("ink") }]}>{s.value}</Animated.Text>
            <Animated.Text style={[styles.statLabel, { color: col("sub") }]}>{s.label}</Animated.Text>
          </Animated.View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const col = useCol();
  return (
    <View style={styles.group}>
      <Animated.Text style={[styles.groupTitle, { color: col("sub") }]} accessibilityRole="header">
        {title}
      </Animated.Text>
      <Animated.View style={[styles.card, { backgroundColor: col("card"), borderColor: col("line") }]}>{children}</Animated.View>
    </View>
  );
}

function Row({ icon, label, detail, value, right, last }: { icon: ReactNode; label: string; detail?: string; value?: string; right?: ReactNode; last?: boolean }) {
  const col = useCol();
  const content = (
    <>
      <Animated.View style={[styles.iconChip, { backgroundColor: col("chip") }]}>{icon}</Animated.View>
      <Animated.View style={[styles.rowBody, !last && { borderBottomWidth: 1, borderBottomColor: col("line") }]}>
        <View style={{ flex: 1 }}>
          <Animated.Text style={[styles.rowLabel, { color: col("ink") }]}>{label}</Animated.Text>
          {detail ? <Animated.Text style={[styles.rowDetail, { color: col("sub") }]}>{detail}</Animated.Text> : null}
        </View>
        {right ?? (
          <View style={styles.rowRight}>
            {value ? (
              <Animated.Text numberOfLines={1} style={[styles.rowValue, { color: col("sub") }]}>
                {value}
              </Animated.Text>
            ) : null}
            <Chevron />
          </View>
        )}
      </Animated.View>
    </>
  );
  if (right) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
}

function Switch({ value, onChange, label, reduced }: { value: boolean; onChange: () => void; label: string; reduced: boolean }) {
  const col = useCol();
  const v = useRef(new Animated.Value(value ? 1 : 0)).current;
  const press = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) v.setValue(value ? 1 : 0);
    else Animated.spring(v, { toValue: value ? 1 : 0, stiffness: 380, damping: 26, mass: 0.8, useNativeDriver: false }).start();
  }, [value, reduced, v]);
  const squash = (to: number) => Animated.spring(press, { toValue: to, stiffness: 500, damping: 30, useNativeDriver: false }).start();
  const offTrack = col("track");
  const onTrack = col("accent");
  return (
    <Pressable
      onPress={onChange}
      onPressIn={() => squash(1)}
      onPressOut={() => squash(0)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={styles.switchHit}
    >
      <View style={styles.switchTrack}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: offTrack }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: onTrack, opacity: v }]} />
        <Animated.View
          style={[
            styles.switchThumb,
            {
              backgroundColor: col("thumb"),
              width: press.interpolate({ inputRange: [0, 1], outputRange: [26, 32] }),
              left: Animated.add(
                v.interpolate({ inputRange: [0, 1], outputRange: [3, 23] }),
                Animated.multiply(press, v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] })),
              ),
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

function Segmented({ value, onChange, reduced }: { value: Appearance; onChange: (v: Appearance) => void; reduced: boolean }) {
  const col = useCol();
  const options: { key: Appearance; label: string }[] = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "auto", label: "Auto" },
  ];
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = options.findIndex((o) => o.key === value);
  const seg = (w - 8) / 3;
  const placed = useRef(false);
  useEffect(() => {
    if (!w) return;
    const to = idx * seg;
    if (!placed.current || reduced) {
      x.setValue(to);
      placed.current = true;
    } else Animated.spring(x, { toValue: to, stiffness: 340, damping: 30, useNativeDriver: native }).start();
  }, [idx, seg, w, reduced, x]);
  return (
    <Animated.View
      style={[styles.segment, { backgroundColor: col("chip") }]}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance"
    >
      {w > 0 ? (
        <Animated.View style={[styles.segmentThumb, { width: seg, transform: [{ translateX: x }] }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.segmentThumbFill, { backgroundColor: col("card") }]} />
        </Animated.View>
      ) : null}
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          accessibilityRole="radio"
          accessibilityLabel={o.label}
          accessibilityState={{ checked: value === o.key }}
          style={styles.segmentItem}
        >
          <SegmentGlyph kind={o.key} active={value === o.key} />
          <Animated.Text style={[styles.segmentText, { color: value === o.key ? col("ink") : col("sub") }]}>{o.label}</Animated.Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

/* ——— Icons drawn from Views ——— */

function SegmentGlyph({ kind, active }: { kind: Appearance; active: boolean }) {
  const col = useCol();
  const c = active ? col("accent") : col("sub");
  if (kind === "light") {
    return (
      <View style={styles.segGlyph}>
        {[0, 45, 90, 135].map((r) => (
          <Animated.View key={r} style={{ position: "absolute", width: 14, height: 1.6, borderRadius: 1, backgroundColor: c, transform: [{ rotate: `${r}deg` }] }} />
        ))}
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c, borderWidth: 1.5, borderColor: col("card") }} />
      </View>
    );
  }
  if (kind === "dark") {
    return (
      <View style={styles.segGlyph}>
        <Animated.View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c }} />
        <Animated.View style={{ position: "absolute", width: 9, height: 9, borderRadius: 5, top: 0, right: 0, backgroundColor: active ? col("card") : col("chip") }} />
      </View>
    );
  }
  return (
    <View style={styles.segGlyph}>
      <Animated.View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.6, borderColor: c, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", left: 4.4, top: 0, bottom: 0, right: 0, backgroundColor: c }} />
      </Animated.View>
    </View>
  );
}

function Chevron() {
  const col = useCol();
  return <Animated.View style={[styles.chevron, { borderColor: col("sub") }]} />;
}

function GlyphIcon({ glyph, big, small }: { glyph: string; big?: boolean; small?: boolean }) {
  const col = useCol();
  return (
    <Animated.Text style={[styles.glyph, big && styles.glyphBig, small && styles.glyphSmall, { color: col("ink") }]} accessible={false}>
      {glyph}
    </Animated.Text>
  );
}

function BellIcon() {
  const col = useCol();
  return (
    <View style={styles.iconBox}>
      <Animated.View style={{ width: 12, height: 11, marginTop: 1, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 1.8, borderBottomWidth: 0, borderColor: col("ink") }} />
      <Animated.View style={{ width: 16, height: 1.8, borderRadius: 1, backgroundColor: col("ink") }} />
      <Animated.View style={{ width: 4, height: 3, marginTop: 1, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: col("ink") }} />
    </View>
  );
}

function NotebookIcon() {
  const col = useCol();
  return (
    <View style={styles.iconBox}>
      <Animated.View style={{ width: 13, height: 16, borderRadius: 2.5, borderWidth: 1.8, borderColor: col("ink"), paddingLeft: 3, paddingTop: 3, gap: 2 }}>
        <Animated.View style={{ width: 5, height: 1.6, borderRadius: 1, backgroundColor: col("ink") }} />
        <Animated.View style={{ width: 4, height: 1.6, borderRadius: 1, backgroundColor: col("ink") }} />
      </Animated.View>
      <Animated.View style={{ position: "absolute", left: 6, top: 3, width: 1.8, height: 16, backgroundColor: col("ink") }} />
    </View>
  );
}

function LockIcon() {
  const col = useCol();
  return (
    <View style={styles.iconBox}>
      <Animated.View style={{ width: 9, height: 7, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 1.8, borderBottomWidth: 0, borderColor: col("ink") }} />
      <Animated.View style={{ width: 14, height: 10, borderRadius: 2.5, backgroundColor: col("ink"), alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ width: 2, height: 3.5, borderRadius: 1, backgroundColor: col("chip") }} />
      </Animated.View>
    </View>
  );
}

function AppIconGlyph() {
  const col = useCol();
  return (
    <View style={styles.iconBox}>
      <Animated.View style={{ width: 15, height: 15, borderRadius: 4.5, borderWidth: 1.8, borderColor: col("ink"), alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: col("accent") }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, paddingHorizontal: 4 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "800", letterSpacing: -1.5 },
  done: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  doneText: { fontSize: 17, fontWeight: "700" },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  profile: { padding: 0 },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontWeight: "800", letterSpacing: -0.8 },
  avatarBadge: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatarBadgeText: { color: "#fff", fontSize: 14, lineHeight: 15, fontWeight: "800" },
  name: { fontSize: 21, fontWeight: "800", letterSpacing: -0.6 },
  email: { fontSize: 14, marginTop: 2 },
  planPill: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  planText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
  stats: { flexDirection: "row", borderTopWidth: 1 },
  stat: { flex: 1, paddingVertical: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.6, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, marginTop: 1 },
  group: { marginTop: 26 },
  groupTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 8, marginLeft: 6 },
  segmentRow: { padding: 14, paddingBottom: 12, gap: 10 },
  hint: { fontSize: 13, lineHeight: 18, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 14, minHeight: 56 },
  iconChip: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingRight: 14, paddingVertical: 12, gap: 10 },
  rowLabel: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  rowDetail: { fontSize: 13, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, maxWidth: "62%" },
  rowValue: { fontSize: 15, flexShrink: 1 },
  chevron: { width: 8, height: 8, borderRightWidth: 2, borderTopWidth: 2, transform: [{ rotate: "45deg" }], marginRight: 3 },
  glyph: { fontSize: 15, fontWeight: "800", letterSpacing: -0.4 },
  glyphBig: { fontSize: 26, lineHeight: 30, marginTop: 8 },
  glyphSmall: { fontSize: 11 },
  iconBox: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  switchHit: { minHeight: 44, justifyContent: "center" },
  switchTrack: { width: 52, height: 32, borderRadius: 16 },
  switchThumb: {
    position: "absolute",
    top: 3,
    height: 26,
    borderRadius: 13,
    ...Platform.select({
      web: { boxShadow: "0 2px 6px rgba(43,36,32,0.22)" },
      default: { shadowColor: "#2B2420", shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    }),
  },
  segment: { flexDirection: "row", borderRadius: 14, padding: 4, height: 48 },
  segmentThumb: { position: "absolute", top: 4, left: 4, bottom: 4 },
  segmentThumbFill: {
    borderRadius: 10,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(43,36,32,0.12), 0 4px 12px rgba(43,36,32,0.08)" },
      default: { shadowColor: "#2B2420", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    }),
  },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  segmentText: { fontSize: 14, fontWeight: "700" },
  segGlyph: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  signOutCard: { marginTop: 26 },
  signOut: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  signOutText: { fontSize: 16, fontWeight: "700" },
  footer: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 18 },
});

export default function MobileSettingsDemo() {
  return <MobileSettings />;
}
