import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { elevation, fontFamily, radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import EarthSoil from '../../../assets/mascot/icon-element-earth-soil.svg';
import { ElementMascotAnimated } from './Mascot';

/**
 * ElementPill — pill ธาตุเจ้าเรือน ตามแบบ ThaiWell back-office (b3__el บนหน้าหุ่น 3D)
 * พื้นขาวโปร่ง · ไอคอนธาตุ = น้องประคบของธาตุนั้นบนวงกลมสีพาสเทล (assets/mascot/icon-element-*.svg — ดิน ต้นอ่อน · น้ำ หยดน้ำ · ลม สายลม · ไฟ เปลวไฟ)
 * ชื่อธาตุสีธาตุบรรทัดเดียว (ป้าย เช่น ธาตุเจ้าเรือน อ่านทาง screen reader)
 */
export type ThaiElement = 'ดิน' | 'น้ำ' | 'ลม' | 'ไฟ';

/** สีธาตุ (ELEMENT_INFO ของ back-office) */
export const ELEMENT_COLOR: Record<ThaiElement, string> = {
  ดิน: '#8A5A2B',
  น้ำ: '#2F6FA3',
  ลม: '#5F7F86',
  ไฟ: '#C2482B',
};

const ICON: Record<ThaiElement, string[]> = {
  ไฟ: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  ดิน: ['m8 3 4 8 5-5 5 15H2L8 3z'],
  น้ำ: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  ลม: ['M12.8 19.6A2 2 0 1 0 14 16H2', 'M17.5 8a2.5 2.5 0 1 1 2 4H2', 'M9.8 4.4A2 2 0 1 1 11 8H2'],
};

export function ElementIcon({ element, size = 15, color = '#FFFFFF' }: { element: ThaiElement; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {ICON[element].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

/** พื้นพาสเทลของธาตุ (ชุดเดียวกับวงกลมไอคอนธาตุ assets/mascot/icon-element-*.svg) */
export const ELEMENT_PASTEL: Record<ThaiElement, string> = { ดิน: '#F1E3D3', น้ำ: '#DDF0FB', ลม: '#E1F2EF', ไฟ: '#FCDCC8' };

/**
 * ไอคอนธาตุ (วงกลมพาสเทล + น้องประคบทั้งตัว ของบนหัวขยับ) — ป้ายธาตุหน้าแรก · ป้ายที่รูปโปรไฟล์ · การ์ดธาตุในข้อมูลส่วนตัว
 * ตำแหน่ง/ขนาดชุดเดียวกับ assets/mascot/icon-element-*.svg (ผืน 96: ย่อ 0.38 · เลื่อน x 2.4 · y ดิน -0.9 / อื่น 5.8 ให้ฐานชิดขอบล่าง)
 * ธาตุดิน: แถบดินวางทับด้านล่าง (กองดินในภาพแคบกว่าวง)
 */
export function ElementMascotIcon({ element, size = 26 }: { element: ThaiElement; size?: number }) {
  const u = size / 96;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ELEMENT_PASTEL[element], overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 2.4 * u, top: (element === 'ดิน' ? -0.9 : 5.8) * u }}>
        <ElementMascotAnimated element={element} size={240 * 0.38 * u} />
      </View>
      {element === 'ดิน' ? <EarthSoil width={size} height={size} style={{ position: 'absolute', left: 0, top: 0 }} /> : null}
    </View>
  );
}

/** ยังไม่รู้ธาตุ (ยังไม่ได้ทำแบบประเมิน) → สีกลาง · ไอคอน + · "ประเมินธาตุ" */
const ASK_COLOR = '#5B6B60';

export function ElementPill({ element, label = 'ธาตุเจ้าเรือน', onPress }: { element: ThaiElement | null; label?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const c = element ? ELEMENT_COLOR[element] : ASK_COLOR;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={element ? `${label} ธาตุ${element}` : 'ประเมินธาตุเจ้าเรือน'}
      disabled={!onPress}
      onPress={onPress}
      // ขนาด/ระยะชุดเดียวกับป้ายอื่นบนหุ่น (BodyTagPill): สูง 30 · วงกลม 24 เว้นขอบ 3 · ห่างข้อความ 4 · พื้นขาวทึบ ไม่มีเส้นขอบ · เงาระดับ 1
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[1], height: 30, paddingLeft: 3, paddingRight: space[3], borderRadius: radius.full, backgroundColor: colors.surface.default, opacity: pressed ? 0.7 : 1, ...elevation[1] })}
    >
      {element ? (
        <ElementMascotIcon element={element} size={24} />
      ) : (
        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c }}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
        </View>
      )}
      {/* บรรทัดเดียว (ไม่เด่นกว่าแท็บ) · ไทยมีสระบน/ล่าง → lineHeight ~1.5 เท่า ไม่ให้ถูกตัด · ป้ายเต็มอ่านได้ทาง screen reader */}
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 18, color: c }}>{element ? `ธาตุ${element}` : 'ประเมินธาตุ'}</Text>
    </Pressable>
  );
}
