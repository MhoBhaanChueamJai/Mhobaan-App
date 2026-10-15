import React from 'react';
import type { FC } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Hello from '../../../assets/mascot/prakob-01-hello.svg';
import Assess from '../../../assets/mascot/prakob-02-assess.svg';
import Cheer from '../../../assets/mascot/prakob-03-cheer.svg';
import Rest from '../../../assets/mascot/prakob-04-rest.svg';
import Confused from '../../../assets/mascot/prakob-05-confused.svg';
import Search from '../../../assets/mascot/prakob-06-search.svg';
import Relief from '../../../assets/mascot/prakob-07-relief.svg';
import Reminder from '../../../assets/mascot/prakob-08-reminder.svg';
import Earth from '../../../assets/mascot/prakob-element-earth.svg';
import Water from '../../../assets/mascot/prakob-element-water.svg';
import Wind from '../../../assets/mascot/prakob-element-wind.svg';
import Fire from '../../../assets/mascot/prakob-element-fire.svg';
// ชั้นสำหรับ animation (scripts/split-mascot.py)
import EarthStill from '../../../assets/mascot/prakob-element-earth-still.svg';
import EarthHead from '../../../assets/mascot/prakob-element-earth-head.svg';
import WaterStill from '../../../assets/mascot/prakob-element-water-still.svg';
import WaterWaveBack from '../../../assets/mascot/prakob-element-water-wave-back.svg';
import WaterWaveFront from '../../../assets/mascot/prakob-element-water-wave-front.svg';
import WaterHead from '../../../assets/mascot/prakob-element-water-head.svg';
import WindStill from '../../../assets/mascot/prakob-element-wind-still.svg';
import WindGust from '../../../assets/mascot/prakob-element-wind-gust.svg';
import WindLeaf1 from '../../../assets/mascot/prakob-element-wind-leaf-1.svg';
import WindLeaf2 from '../../../assets/mascot/prakob-element-wind-leaf-2.svg';
import WindLeaf3 from '../../../assets/mascot/prakob-element-wind-leaf-3.svg';
import WindHead from '../../../assets/mascot/prakob-element-wind-head.svg';
import FireStill from '../../../assets/mascot/prakob-element-fire-still.svg';
import FireFlameBack from '../../../assets/mascot/prakob-element-fire-flame-back.svg';
import FireFlameMid from '../../../assets/mascot/prakob-element-fire-flame-mid.svg';
import FireFlameFront from '../../../assets/mascot/prakob-element-fire-flame-front.svg';
import FireSparks from '../../../assets/mascot/prakob-element-fire-sparks.svg';
import FireHead from '../../../assets/mascot/prakob-element-fire-head.svg';

/**
 * น้องประคบ — mascot ของแอป (assets/mascot · แก้ภาพใน Figma แล้ว export ทับชื่อเดิม)
 * ใช้: ต้อนรับ · สำเร็จ · หน้าว่าง · ไม่พบข้อมูล · ผลธาตุเจ้าเรือน
 * ❌ ไม่ใช้ในหน้าคำเตือนอันตราย / สัญญาณอันตราย และไม่ใช้แทนลูกบอล AI ในแชท
 */
const POSES = {
  hello: Hello,
  assess: Assess,
  cheer: Cheer,
  rest: Rest,
  confused: Confused,
  search: Search,
  relief: Relief,
  reminder: Reminder,
  ดิน: Earth,
  น้ำ: Water,
  ลม: Wind,
  ไฟ: Fire,
} satisfies Record<string, FC<SvgProps>>;
export type MascotPose = keyof typeof POSES;

export function Mascot({ pose, size = 140 }: { pose: MascotPose; size?: number }) {
  const Art = POSES[pose];
  // ภาพประกอบ ไม่ใช่เนื้อหา — โปรแกรมอ่านหน้าจอข้าม
  return <Art width={size} height={size} accessible={false} importantForAccessibility="no-hide-descendants" />;
}

/* ---------------------------------------------------------------- น้องประคบของธาตุ แบบขยับ */

/**
 * ภาพนิ่ง + ชั้นที่ขยับ วางซ้อนกันบนผืนผ้าใบ 240×240 เดียวกัน (แยกด้วย scripts/split-mascot.py)
 * ท่าตามลักษณะธาตุ:
 *   ดิน  ต้นอ่อนโยกช้า (สงบ)
 *   น้ำ  คลื่น 2 ชั้นเลื่อนสวนกัน · ดอกบัวลอยโยก
 *   ลม   สายลมพัดไหว · ใบไม้ปลิว · กังหันหมุน
 *   ไฟ   เปลวไฟ 3 ชั้นไหวคนละจังหวะ · ประกายลอยขึ้น · เปลวเทียนไหว
 * ตั้งค่า "ลดการเคลื่อนไหว" ในเครื่อง → ภาพนิ่ง
 */
type ThaiElementKey = 'ดิน' | 'น้ำ' | 'ลม' | 'ไฟ';
type Motion = 'sway' | 'bob' | 'spin' | 'slide' | 'gust' | 'drift' | 'flicker' | 'flame' | 'rise';
interface Layer {
  art: FC<SvgProps>;
  /** จุดหมุน/ย่อ (พิกัดบนผืน 240) */
  pivot: [number, number];
  motion: Motion;
  /** ระยะ (ms) ต่อรอบ */
  dur: number;
  /** แรง (องศา / px บนผืน 240) */
  amp: number;
  /** เริ่มช้ากว่า (ms) — ให้แต่ละชั้นไม่ขยับพร้อมกัน */
  delay?: number;
}
const ANIM: Record<ThaiElementKey, { still: FC<SvgProps>; layers: Layer[] }> = {
  ดิน: { still: EarthStill, layers: [{ art: EarthHead, pivot: [120, 62], motion: 'sway', dur: 1800, amp: 6 }] },
  น้ำ: {
    still: WaterStill,
    layers: [
      { art: WaterWaveBack, pivot: [120, 220], motion: 'slide', dur: 2200, amp: 4, delay: 600 },
      { art: WaterWaveFront, pivot: [120, 228], motion: 'slide', dur: 1800, amp: -5 },
      { art: WaterHead, pivot: [120, 62], motion: 'bob', dur: 1400, amp: 3 },
    ],
  },
  ลม: {
    still: WindStill,
    layers: [
      { art: WindGust, pivot: [140, 190], motion: 'gust', dur: 1600, amp: 6 },
      { art: WindLeaf1, pivot: [34, 92], motion: 'drift', dur: 2000, amp: 7 },
      { art: WindLeaf2, pivot: [212, 132], motion: 'drift', dur: 2300, amp: -6, delay: 500 },
      { art: WindLeaf3, pivot: [184, 40], motion: 'drift', dur: 1900, amp: 5, delay: 900 },
      { art: WindHead, pivot: [120, 26], motion: 'spin', dur: 2400, amp: 0 },
    ],
  },
  ไฟ: {
    still: FireStill,
    layers: [
      { art: FireFlameBack, pivot: [120, 240], motion: 'flame', dur: 900, amp: 0.1 },
      { art: FireFlameMid, pivot: [120, 240], motion: 'flame', dur: 760, amp: 0.12, delay: 200 },
      { art: FireFlameFront, pivot: [120, 240], motion: 'flame', dur: 640, amp: 0.14, delay: 120 },
      { art: FireSparks, pivot: [120, 190], motion: 'rise', dur: 1400, amp: 10 },
      { art: FireHead, pivot: [120, 31], motion: 'flicker', dur: 840, amp: 0 },
    ],
  },
};

function useReduceMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const ease = Easing.inOut(Easing.sin);
/** ไฟ: จังหวะไม่สม่ำเสมอ (สัดส่วนของรอบ) */
const FLICKER = [
  [0.7, 0.17],
  [0.2, 0.13],
  [1, 0.2],
  [0.4, 0.14],
  [0.9, 0.18],
  [0, 0.18],
] as const;

function loopOf(v: Animated.Value, l: Layer) {
  const t = (toValue: number, duration: number, easing = ease) => Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });
  const body =
    l.motion === 'spin' || l.motion === 'rise'
      ? Animated.sequence([t(1, l.dur, Easing.linear), t(0, 0, Easing.linear)])
      : l.motion === 'flicker' || l.motion === 'flame'
        ? Animated.sequence(FLICKER.map(([to, share]) => t(to, l.dur * share)))
        : Animated.sequence([t(1, l.dur), t(0, l.dur)]);
  const loop = Animated.loop(body);
  return l.delay ? Animated.sequence([Animated.delay(l.delay), loop]) : loop;
}

function transformOf(v: Animated.Value, l: Layer, k: number) {
  const r = (a: number, b: number) => v.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const deg = (a: number, b: number) => v.interpolate({ inputRange: [0, 1], outputRange: [`${a}deg`, `${b}deg`] });
  switch (l.motion) {
    case 'sway':
      return [{ rotate: deg(-l.amp, l.amp) }];
    case 'bob':
      return [{ translateY: r(0, -l.amp * k) }, { rotate: deg(-4, 4) }];
    case 'spin':
      return [{ rotate: deg(0, 360) }];
    case 'slide':
      return [{ translateX: r(-l.amp * k, l.amp * k) }];
    case 'gust':
      return [{ translateX: r(-l.amp * k, l.amp * k) }];
    case 'drift':
      return [{ translateX: r(0, l.amp * k) }, { translateY: r(0, -Math.abs(l.amp) * 0.6 * k) }, { rotate: deg(-10, 14) }];
    case 'flame':
      return [{ scaleY: r(1 - l.amp, 1 + l.amp) }];
    case 'flicker':
      return [{ scaleY: r(0.9, 1.14) }, { scaleX: r(1.04, 0.92) }];
    case 'rise':
      return [{ translateY: r(0, -l.amp * k) }];
  }
}

export function ElementMascotAnimated({ element, size = 140 }: { element: ThaiElementKey; size?: number }) {
  const { still: Still, layers } = ANIM[element];
  const reduce = useReduceMotion();
  const values = React.useMemo(() => layers.map(() => new Animated.Value(0)), [layers]);
  React.useEffect(() => {
    values.forEach((v) => v.setValue(0));
    if (reduce) return;
    const loops = layers.map((l, i) => loopOf(values[i], l));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [layers, values, reduce]);
  const k = size / 240;
  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Still width={size} height={size} />
      {layers.map((l, i) => {
        const Art = l.art;
        const v = values[i];
        // ประกายไฟ / สายลม: จางเป็นจังหวะ
        const opacity = l.motion === 'rise' ? v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }) : l.motion === 'gust' ? v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] }) : 1;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity, transformOrigin: [l.pivot[0] * k, l.pivot[1] * k, 0], transform: transformOf(v, l, k) }}
          >
            <Art width={size} height={size} />
          </Animated.View>
        );
      })}
    </View>
  );
}
