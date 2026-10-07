import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

export type OnboardingSlide = {
  /** Short uppercase kicker above the headline. */
  kicker: string;
  title: string;
  body: string;
  /** Page wash behind the slide. Colours blend as you swipe. */
  background: string;
  /** Accent used by the illustration. */
  accent: string;
  /** Which drawn illustration to show. */
  art: "seed" | "chain" | "steps";
};

export type MobileOnboardingProps = {
  brand?: string;
  slides?: OnboardingSlide[];
  skipLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Called by "Get started" and by Skip on the last slide. */
  onFinish?: () => void;
};

const INK = "#1A1712";
const CREAM = "#FFF8EE";

const DEFAULT_SLIDES: OnboardingSlide[] = [
  {
    kicker: "Start small",
    title: "Start embarrassingly small.",
    body: "Floss one tooth. Read one page. Grove counts a two-minute win exactly the same as a heroic one.",
    background: "#FFDCC4",
    accent: "#FF5B24",
    art: "seed",
  },
  {
    kicker: "Keep going",
    title: "Bend the chain. Don’t break it.",
    body: "Missed a day? Spend a rest token and your streak survives. Life happens; the habit doesn’t have to end.",
    background: "#D4E5CC",
    accent: "#1F6B45",
    art: "chain",
  },
  {
    kicker: "Look back",
    title: "Your future self says thanks.",
    body: "Every Sunday at 6pm you’ll get one honest page: what stuck, what slipped, and one thing to try next week.",
    background: "#F6E2A2",
    accent: "#D9441E",
    art: "steps",
  },
];

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

export function MobileOnboarding({
  brand = "grove",
  slides = DEFAULT_SLIDES,
  skipLabel = "Skip",
  nextLabel = "Next",
  finishLabel = "Get started",
  onFinish,
}: MobileOnboardingProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const reduced = useReducedMotion();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const w = size.w;
  const last = slides.length - 1;

  useEffect(() => {
    if (!w) return;
    const id = scrollX.addListener(({ value }) => {
      const i = Math.max(0, Math.min(last, Math.round(value / w)));
      setIndex((prev) => (prev === i ? prev : i));
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, w, last]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  const goTo = (i: number) => scroller.current?.scrollTo({ x: i * w, animated: !reduced });

  const next = () => {
    if (index < last) goTo(index + 1);
    else {
      setDone(true);
      onFinish?.();
    }
  };

  const inputs = slides.map((_, i) => i * (w || 1));
  const background =
    slides.length > 1
      ? scrollX.interpolate({ inputRange: inputs, outputRange: slides.map((s) => s.background), extrapolate: "clamp" })
      : slides[0]?.background;

  // The round Next button grows into a full-width "Get started" pill across the last swipe.
  const fullWidth = Math.max(64, w - 48);
  const lastStart = Math.max(0, last - 1) * (w || 1);
  const lastEnd = last * (w || 1);
  const ctaWidth = scrollX.interpolate({ inputRange: [lastStart, lastEnd], outputRange: [64, fullWidth], extrapolate: "clamp" });
  const ctaLabel = scrollX.interpolate({ inputRange: [lastStart + (lastEnd - lastStart) * 0.6, lastEnd], outputRange: [0, 1], extrapolate: "clamp" });
  const dotsFade = scrollX.interpolate({ inputRange: [lastStart, lastStart + (lastEnd - lastStart) * 0.5], outputRange: [1, 0], extrapolate: "clamp" });
  const skipFade = scrollX.interpolate({ inputRange: [lastStart, lastEnd], outputRange: [1, 0], extrapolate: "clamp" });

  const compact = size.h > 0 && size.h < 760;
  const artSize = Math.min(w - 48, compact ? 260 : 312);

  return (
    <Animated.View style={[styles.root, { backgroundColor: background }]} onLayout={onLayout}>
      <View style={styles.topBar}>
        <View style={styles.brand} accessibilityRole="header">
          <View style={styles.brandMark}>
            <View style={[styles.leaf, { transform: [{ rotate: "-45deg" }] }]} />
          </View>
          <Text style={styles.brandText}>{brand}</Text>
        </View>
        <Animated.View style={{ opacity: skipFade }} pointerEvents={index === last ? "none" : "auto"}>
          <Pressable
            onPress={() => goTo(last)}
            accessibilityRole="button"
            accessibilityLabel={`${skipLabel} to the last slide`}
            hitSlop={8}
            style={({ pressed }) => [styles.skip, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.skipText}>{skipLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>

      {w > 0 ? (
        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          style={styles.pager}
        >
          {slides.map((s, i) => {
            const shift = (factor: number) =>
              scrollX.interpolate({
                inputRange: [(i - 1) * w, i * w, (i + 1) * w],
                outputRange: [w * factor, 0, -w * factor],
                extrapolate: "clamp",
              });
            const textFade = scrollX.interpolate({
              inputRange: [(i - 0.6) * w, i * w, (i + 0.6) * w],
              outputRange: [0, 1, 0],
              extrapolate: "clamp",
            });
            return (
              <View key={s.title} style={[styles.slide, { width: w }]} accessibilityLabel={`Slide ${i + 1} of ${slides.length}`}>
                <View style={[styles.artWrap, compact && { paddingTop: 4 }]} accessible={false} importantForAccessibility="no-hide-descendants">
                  <Art kind={s.art} accent={s.accent} size={artSize} shift={shift} />
                </View>
                <Animated.View style={[styles.copy, { opacity: textFade, transform: [{ translateX: shift(0.18) }] }]}>
                  <Text style={styles.kicker}>
                    {String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")} — {s.kicker}
                  </Text>
                  <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
                    {s.title}
                  </Text>
                  <Text style={styles.body}>{s.body}</Text>
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>
      ) : (
        <View style={styles.pager} />
      )}

      <View style={styles.footer}>
        <Animated.View style={[styles.dots, { opacity: dotsFade }]} accessibilityLabel={`Slide ${index + 1} of ${slides.length}`}>
          {slides.map((s, i) => {
            const range = [(i - 1) * (w || 1), i * (w || 1), (i + 1) * (w || 1)];
            const dotW = scrollX.interpolate({ inputRange: range, outputRange: [8, 28, 8], extrapolate: "clamp" });
            const dotO = scrollX.interpolate({ inputRange: range, outputRange: [0.22, 1, 0.22], extrapolate: "clamp" });
            return (
              <Pressable
                key={s.title}
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityLabel={`Go to slide ${i + 1}`}
                accessibilityState={{ selected: i === index }}
                hitSlop={{ top: 18, bottom: 18, left: 4, right: 4 }}
              >
                <Animated.View style={[styles.dot, { width: dotW, opacity: dotO }]} />
              </Pressable>
            );
          })}
        </Animated.View>

        <Animated.View style={[styles.ctaWrap, { width: ctaWidth }]}>
          <Pressable
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={index === last ? finishLabel : nextLabel}
            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Animated.Text numberOfLines={1} style={[styles.ctaText, { opacity: ctaLabel }]}>
              {done ? "Welcome to Grove" : finishLabel}
            </Animated.Text>
            <View style={styles.arrowSlot}>
              <Arrow />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function Arrow() {
  return (
    <View style={styles.arrow}>
      <View style={styles.arrowShaft} />
      <View style={[styles.arrowHead, { top: 3, transform: [{ rotate: "45deg" }] }]} />
      <View style={[styles.arrowHead, { top: 9, transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

type Shift = (factor: number) => Animated.AnimatedInterpolation<number>;

function Art({ kind, accent, size, shift }: { kind: OnboardingSlide["art"]; accent: string; size: number; shift: Shift }) {
  if (kind === "chain") return <ChainArt accent={accent} size={size} shift={shift} />;
  if (kind === "steps") return <StepsArt accent={accent} size={size} shift={shift} />;
  return <SeedArt accent={accent} size={size} shift={shift} />;
}

/** Slide 1: a tiny seed inside rings of growth, with a "2 min" ticket. */
function SeedArt({ accent, size, shift }: { accent: string; size: number; shift: Shift }) {
  const rings = [1, 0.78, 0.56];
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, { transform: [{ translateX: shift(0.12) }] }]}>
        {rings.map((r, i) => (
          <View
            key={r}
            style={{
              position: "absolute",
              width: size * r,
              height: size * r,
              borderRadius: size,
              borderWidth: i === 0 ? 1.5 : 2,
              borderColor: INK,
              opacity: i === 0 ? 0.18 : 0.32,
              borderStyle: i === 0 ? "dashed" : "solid",
            }}
          />
        ))}
        <View style={{ width: size * 0.36, height: size * 0.36, borderRadius: size, backgroundColor: CREAM }} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, { transform: [{ translateX: shift(0.3) }] }]}>
        {/* a sprout on a mound of soil */}
        <View style={{ width: size * 0.36, height: size * 0.36 }}>
          <View style={{ position: "absolute", left: "24%", width: "52%", top: "60%", height: "20%", backgroundColor: accent, borderTopLeftRadius: size, borderTopRightRadius: size }} />
          <View style={{ position: "absolute", left: size * 0.18 - 1.5, top: "30%", width: 3, height: "31%", borderRadius: 2, backgroundColor: INK }} />
          <View style={{ position: "absolute", right: "50%", top: "33%", width: "22%", height: "12%", backgroundColor: INK, borderTopLeftRadius: size, borderBottomRightRadius: size }} />
          <View style={{ position: "absolute", left: "50%", top: "22%", width: "24%", height: "13%", backgroundColor: accent, borderTopRightRadius: size, borderBottomLeftRadius: size }} />
        </View>
      </Animated.View>
      {/* ticket */}
      <Animated.View style={[styles.ticket, { top: size * 0.06, right: -4, transform: [{ translateX: shift(0.55) }, { rotate: "3deg" }] }]}>
        <Text style={styles.ticketBig}>2</Text>
        <Text style={styles.ticketSmall}>MIN{"\n"}COUNTS</Text>
      </Animated.View>
      <Animated.View style={{ position: "absolute", left: size * 0.04, bottom: size * 0.1, transform: [{ translateX: shift(0.45) }] }}>
        <View style={[styles.chip, { backgroundColor: INK }]}>
          <View style={[styles.chipDot, { backgroundColor: accent }]} />
          <Text style={[styles.chipText, { color: CREAM }]}>Day 1</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** Slide 2: a calendar card with a streak, one day saved by a rest token. */
function ChainArt({ accent, size, shift }: { accent: string; size: number; shift: Shift }) {
  const cell = Math.floor((size * 0.78 - 6 * 8) / 7);
  const rows = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 2, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0],
  ];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <View style={[{ width: size, height: size }, styles.center]}>
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.9,
          height: size * 0.72,
          borderRadius: 28,
          backgroundColor: accent,
          transform: [{ translateX: shift(0.1) }, { rotate: "2deg" }],
        }}
      />
      <Animated.View style={[styles.calendar, { width: size * 0.9, transform: [{ translateX: shift(0.22) }, { rotate: "-3deg" }] }]}>
        <View style={styles.calHead}>
          <Text style={styles.calMonth}>October</Text>
          <Text style={styles.calMeta}>Read 10 pages</Text>
        </View>
        <View style={styles.calRow}>
          {days.map((d, i) => (
            <Text key={`${d}${i}`} style={[styles.calDay, { width: cell }]}>
              {d}
            </Text>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={styles.calRow}>
            {row.map((v, c) => (
              <View
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: cell,
                  backgroundColor: v === 1 ? INK : "transparent",
                  borderWidth: v === 1 ? 0 : 2,
                  borderColor: v === 2 ? accent : "rgba(26,23,18,0.16)",
                  borderStyle: v === 2 ? "dashed" : "solid",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {v === 2 ? <View style={{ width: cell * 0.32, height: cell * 0.32, borderRadius: cell, backgroundColor: accent }} /> : null}
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
      <Animated.View style={[styles.sticker, { backgroundColor: CREAM, right: 0, bottom: size * 0.02, transform: [{ translateX: shift(0.5) }, { rotate: "-3deg" }] }]}>
        <Text style={[styles.stickerNum, { color: accent }]}>24</Text>
        <Text style={styles.stickerLabel}>DAY STREAK</Text>
      </Animated.View>
    </View>
  );
}

/** Slide 3: a staircase of weeks climbing to a flag. */
function StepsArt({ accent, size, shift }: { accent: string; size: number; shift: Shift }) {
  const steps = [0.22, 0.36, 0.5, 0.66];
  const barW = size * 0.17;
  const gap = size * 0.04;
  const total = steps.length * barW + (steps.length - 1) * gap;
  const left = (size - total) / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size,
          backgroundColor: accent,
          top: size * 0.02,
          left: size * 0.06,
          transform: [{ translateX: shift(0.1) }],
        }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shift(0.28) }] }]}>
        <View style={{ position: "absolute", left: size * 0.04, right: size * 0.04, bottom: size * 0.06, height: 3, borderRadius: 2, backgroundColor: INK }} />
        {steps.map((h, i) => (
          <View
            key={h}
            style={{
              position: "absolute",
              left: left + i * (barW + gap),
              bottom: size * 0.06 + 3,
              width: barW,
              height: size * h,
              borderTopLeftRadius: barW / 2,
              borderTopRightRadius: barW / 2,
              backgroundColor: i === steps.length - 1 ? INK : CREAM,
              borderWidth: i === steps.length - 1 ? 0 : 2,
              borderColor: INK,
              alignItems: "center",
              paddingTop: 10,
            }}
          >
            <Text style={[styles.stepLabel, { color: i === steps.length - 1 ? CREAM : INK }]}>W{i + 1}</Text>
          </View>
        ))}
      </Animated.View>
      {/* flag on the last step */}
      <Animated.View
        style={{
          position: "absolute",
          left: left + 3 * (barW + gap) + barW / 2 - 1.5,
          bottom: size * 0.06 + 3 + size * 0.66,
          transform: [{ translateX: shift(0.28) }],
        }}
      >
        <View style={{ width: 3, height: size * 0.17, backgroundColor: INK, borderRadius: 2 }} />
        <View style={{ position: "absolute", left: 3, top: 0, width: size * 0.13, height: size * 0.08, backgroundColor: accent, borderTopRightRadius: 4, borderBottomRightRadius: 14 }} />
      </Animated.View>
      <Animated.View style={{ position: "absolute", left: 0, top: size * 0.41, transform: [{ translateX: shift(0.5) }, { rotate: "-2deg" }] }}>
        <View style={[styles.chip, { backgroundColor: CREAM }]}>
          <Text style={[styles.chipText, { color: INK }]}>+18% this month</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 54, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: { height: 48, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  leaf: { width: 12, height: 12, backgroundColor: CREAM, borderTopLeftRadius: 12, borderBottomRightRadius: 12 },
  brandText: { fontSize: 22, fontWeight: "800", letterSpacing: -0.9, color: INK },
  skip: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: "flex-end", justifyContent: "center" },
  skipText: { fontSize: 16, fontWeight: "600", color: INK, opacity: 0.7 },
  pager: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: 24 },
  artWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8 },
  copy: { paddingBottom: 20 },
  kicker: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: INK, opacity: 0.6, marginBottom: 14 },
  title: { fontSize: 40, lineHeight: 40, fontWeight: "800", letterSpacing: -1.8, color: INK, marginBottom: 14 },
  titleCompact: { fontSize: 34, lineHeight: 35, letterSpacing: -1.4 },
  body: { fontSize: 16, lineHeight: 24, color: INK, opacity: 0.74, maxWidth: 340 },
  footer: { height: 64, marginHorizontal: 24, marginBottom: 34, marginTop: 8, flexDirection: "row", alignItems: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { height: 8, borderRadius: 4, backgroundColor: INK },
  ctaWrap: { position: "absolute", right: 0, top: 0, height: 64 },
  cta: { flex: 1, borderRadius: 32, backgroundColor: INK, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
  ctaText: { position: "absolute", left: 28, right: 64, color: CREAM, fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  arrowSlot: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  arrow: { width: 20, height: 14 },
  arrowShaft: { position: "absolute", left: 0, right: 1, top: 6, height: 2.5, borderRadius: 2, backgroundColor: CREAM },
  arrowHead: { position: "absolute", right: 0, width: 10, height: 2.5, borderRadius: 2, backgroundColor: CREAM },
  ticket: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: INK, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  ticketBig: { color: CREAM, fontSize: 30, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  ticketSmall: { color: CREAM, fontSize: 10, lineHeight: 12, fontWeight: "700", letterSpacing: 1.2, opacity: 0.8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: "700", letterSpacing: -0.1 },
  calendar: { backgroundColor: CREAM, borderRadius: 24, padding: 18, gap: 8, borderWidth: 2, borderColor: INK },
  calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  calMonth: { fontSize: 18, fontWeight: "800", letterSpacing: -0.6, color: INK },
  calMeta: { fontSize: 12, fontWeight: "600", color: INK, opacity: 0.55 },
  calRow: { flexDirection: "row", justifyContent: "space-between" },
  calDay: { textAlign: "center", fontSize: 10, fontWeight: "700", color: INK, opacity: 0.45, letterSpacing: 0.5 },
  sticker: { position: "absolute", width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: INK },
  stickerNum: { fontSize: 32, lineHeight: 34, fontWeight: "800", letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
  stickerLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2, color: INK },
  stepLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
});

export default function MobileOnboardingDemo() {
  return <MobileOnboarding />;
}
