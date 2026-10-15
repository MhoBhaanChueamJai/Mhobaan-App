import React from 'react';
import { distanceKm, kmText, locate, myLocation, onLocation } from '../../services/location';
import { isCloud, readAvailability } from '../../services/clinicBridge';
import { onAvailability } from '../../services/cloudBridge';
import { Linking, Pressable, View } from 'react-native';
import { AppBar, Badge, Button, BottomSheet, ChipSection, Icon, Screen, Text, useTheme, ScreenSkeleton, useScreenData, Mascot } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useNavigation } from '@react-navigation/native';
import { useNav } from '../../navigation/types';
import { PlacesMap } from './places/PlacesMap';
import { BRIDGE_PLACE, anyoneSlots, dayLabel, liveTherapists } from '../../data/booking';

/* ============================================================ หน่วยบริการสำหรับส่งต่อ
 * เลือกหน่วยบริการก่อนนัด/ส่งต่อคนไข้: ระยะทาง · คิวว่างวันนี้ · ใช้สิทธิบัตรทองได้ไหม · มีแพทย์แผนไทยร่วมดูแลไหม
 * สิทธิบัตรทอง: นวด ประคบ อบ ฟื้นฟูหลังคลอด (health profile 2568 หน้า 21)
 * โหมดส่งต่อ (พบสัญญาณอันตราย): แสดงโรงพยาบาลใกล้ที่สุดแทน รพ.สต.
 * ⚠️ ต้นแบบ: ข้อมูลหน่วยบริการเป็นตัวอย่าง (สมมติ)
 */
export interface Place {
  id: string;
  name: string;
  area: string;
  km: number;
  slots: string[];
  uc: boolean;
  /** มีแพทย์แผนไทยร่วมดูแล (รับเคสส่งต่อ/ร่วมรักษากับหมอพื้นบ้าน) */
  therapy: boolean;
  /** clinic = รพ.สต./แพทย์แผนไทย · hospital = ส่งต่อแพทย์ (กรณีพบสัญญาณอันตราย) */
  kind: 'clinic' | 'hospital';
  /** บริการเสริมที่มี (ใช้จับคู่กับแนวทางการรักษา) */
  services: string[];
  /** เบอร์โทรหน่วยบริการ (ตัวอย่าง) — เลื่อน/ยกเลิกนัดของการรักษาทำผ่านหน่วยบริการ */
  phone?: string;
  /** พิกัด (ตัวอย่าง: พื้นที่จริงใน จ.ขอนแก่น) */
  lat: number;
  lng: number;
}

/** ตำแหน่งบ้านพ่อหมอ บ้านโนนทอง ต.บ้านค้อ (ตัวอย่าง · ต่อ GPS จริงภายหลัง) */
export const MY_LOCATION = { lat: 16.4652, lng: 102.8031 };

const PLACE_LIST: Place[] = [
  { id: 'skv', phone: '043-241-234', name: 'รพ.สต.บ้านค้อ', area: 'ต.บ้านค้อ อ.เมือง', km: 3.2, slots: ['13:00', '15:30'], uc: true, therapy: true, kind: 'clinic', services: ['นวดเส้น', 'ประคบ', 'อบ', 'พอก'], lat: 16.4851, lng: 102.8102 },
  { id: 'ari', phone: '043-242-567', name: 'รพ.สต.หนองแวง', area: 'ต.บ้านค้อ อ.เมือง', km: 7.4, slots: ['10:30', '17:00'], uc: true, therapy: true, kind: 'clinic', services: ['นวดเส้น', 'ประคบ', 'แช่'], lat: 16.5097, lng: 102.7854 },
  { id: 'spa', phone: '081-345-9012', name: 'กลุ่มหมอพื้นบ้าน บ้านโคกสี', area: 'ต.โคกสี อ.เมือง', km: 6.1, slots: ['14:00'], uc: false, therapy: false, kind: 'clinic', services: ['นวดเส้น'], lat: 16.4410, lng: 102.8376 },
  { id: 'hsp1', phone: '043-009-900', name: 'โรงพยาบาลขอนแก่น', area: 'ถ.ศรีจันทร์ อ.เมือง', km: 24, slots: [], uc: true, therapy: false, kind: 'hospital', services: [], lat: 16.4290, lng: 102.8466 },
  { id: 'hsp2', phone: '043-431-047', name: 'โรงพยาบาลน้ำพอง', area: 'ต.น้ำพอง อ.น้ำพอง', km: 18, slots: [], uc: true, therapy: false, kind: 'hospital', services: [], lat: 16.7015, lng: 102.8510 },
];
/** คิวว่างวันนี้ = จากตารางที่หน่วยบริการลงไว้จริง (ไม่ใช่ค่าตายตัว) → รายการ/แผนที่/หน้านัดตรงกัน */
// "ว่างวันนี้" คำนวณทุกครั้งที่อ่าน → หน่วยบริการที่เชื่อมหลังบ้าน (เปิดอยู่) แสดงเวลาว่างจริง ไม่ใช่ค่าตอนเปิดแอป
export const PLACES: Place[] = PLACE_LIST.map((p) =>
  p.kind === 'clinic' ? Object.defineProperty({ ...p }, 'slots', { enumerable: true, get: () => anyoneSlots(p.id).filter((f) => f.day === 0).map((f) => f.time) }) : p,
);

/**
 * ใช้งานจริง (cloud): รายการ = หน่วยบริการที่ใช้ระบบหมอบ้านเชื่อมใจเท่านั้น — ชื่อ ที่อยู่ เบอร์ พิกัด จากหน้าตั้งค่าของหน่วยบริการ
 * ระยะทางคำนวณจากตำแหน่งจริงของผู้ใช้ · หน่วยบริการตัวอย่างอื่น (สมมติ) ไม่แสดง
 */
export function syncLivePlaces() {
  if (!isCloud()) return;
  const a = readAvailability();
  if (!a) {
    PLACES.splice(0, PLACES.length);
    return;
  }
  const c = a.clinic;
  const base = PLACE_LIST.find((p) => p.id === BRIDGE_PLACE)!;
  const live = { ...base, name: c?.name ?? a.clinicName ?? base.name, area: c?.address ?? '', phone: c?.phone, lat: c?.lat ?? NaN, lng: c?.lng ?? NaN } as Place;
  Object.defineProperty(live, 'slots', { enumerable: true, get: () => anyoneSlots(BRIDGE_PLACE).filter((f) => f.day === 0).map((f) => f.time) });
  Object.defineProperty(live, 'km', { enumerable: true, get: () => distanceKm(c?.lat, c?.lng) });
  PLACES.splice(0, PLACES.length, live);
}
if (isCloud()) {
  syncLivePlaces();
  onAvailability(syncLivePlaces);
}

/** แนะนำที่ใกล้ที่สุด: ร่วมรักษา = มีแพทย์แผนไทย + บัตรทอง + มีคิว · ส่งต่อแพทย์ = โรงพยาบาล */
// หน่วยบริการที่เชื่อมหลังบ้าน (มีเวลาว่างจริง) มาก่อน แม้วันนี้เต็มแล้ว — นัดแล้วหน่วยบริการเห็นทันที
export const nearestClinic = () =>
  (liveTherapists() && anyoneSlots(BRIDGE_PLACE).length ? PLACES.find((p) => p.id === BRIDGE_PLACE) : undefined) ??
  PLACES.filter((p) => p.kind === 'clinic' && p.therapy && p.uc && p.slots.length).sort((a, b) => a.km - b.km)[0] ??
  // ยังไม่มีเวลาว่างที่ไหนเลย (เช่น ยังไม่ได้เวลาว่างจริง) → หน่วยบริการที่ใกล้ที่สุด (ไม่ให้การ์ดว่าง/ล่ม)
  PLACES.filter((p) => p.kind === 'clinic' && p.therapy).sort((a, b) => a.km - b.km)[0];
/** คิวว่างถัดไปของสถานที่ เป็นป้าย ("13:00" วันนี้ · "พรุ่งนี้ 09:00") */
export const nextSlotLabels = (placeId: string, n = 3) => anyoneSlots(placeId).slice(0, n).map((f) => (f.day === 0 ? f.time : `${dayLabel(f.day)} ${f.time}`));
export const nearestHospital = () => PLACES.filter((p) => p.kind === 'hospital').sort((a, b) => a.km - b.km)[0];
/** บริการเสริมที่แนวทางการรักษาใช้ (จากชื่อวิธีรักษา) */
export const neededServices = (methods: string[]) => ['ประคบ', 'พอก', 'แช่', 'อบ'].filter((x) => methods.some((m) => m.includes(x)));
/**
 * แนะนำหน่วยบริการตามแนวทาง (ใช้ในแชทนัดกับ AI):
 * 1) ต้องมีแพทย์แผนไทยร่วมดูแล (health profile 2568 หน้า 34) · มีคิวว่าง
 * 2) เรียงตามบริการที่ตรงแนวทางมากสุด → ใช้บัตรทองได้ → ใกล้สุด
 * เหตุผลที่แนะนำส่งกลับไปแสดงในการ์ด
 */
export function rankPlaces(methods: string[], limit = 3): { place: Place; reason: string }[] {
  const need = neededServices(methods);
  return PLACES.filter((p) => p.kind === 'clinic' && p.therapy && p.slots.length)
    .map((p) => {
      const has = need.filter((x) => p.services.includes(x));
      return { p, has, score: has.length * 10 + (p.uc ? 3 : 0) - p.km };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p, has }) => ({ place: p, reason: ['มีแพทย์แผนไทย', ...(has.length ? [`มีบริการ${has.join(' ')}`] : []), ...(p.uc ? ['ใช้บัตรทองได้'] : [])].join(' ') }));
}

/** โทรหาหน่วยบริการตามชื่อ (ไม่พบ = หน่วยบริการหลัก) */
// หน่วยบริการที่ใช้ระบบ (ข้อมูลจริง) ก่อน · ไม่พบ = หน่วยบริการหลัก
const placeByName = (name?: string) => PLACES.find((x) => x.name === name) ?? PLACE_LIST.find((x) => x.name === name) ?? PLACES.find((x) => x.id === BRIDGE_PLACE) ?? (isCloud() ? { ...PLACE_LIST[0], phone: '' } : PLACE_LIST[0]);
export const callClinic = (name?: string) => {
  const p = placeByName(name);
  if (p.phone) Linking.openURL(`tel:${p.phone.replace(/-/g, '')}`).catch(() => {});
};
export const clinicPhone = (name?: string) => placeByName(name).phone ?? '';

/** นำทางด้วยแอปแผนที่ (ต้นแบบ: ค้นตามชื่อ) */
// มีพิกัด → นำทางไปจุดนั้นตรง ๆ · ไม่มี → ค้นจากชื่อ + ที่อยู่
export const openMap = (p: Place) =>
  Linking.openURL(Number.isFinite(p.lat) && Number.isFinite(p.lng) ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.area}`)}`);
/** หาโรงพยาบาลใกล้ตัวใน Google Maps (ใช้งานจริงไม่มีรายชื่อโรงพยาบาลในแอป) */
export const searchHospitals = () => {
  const me = myLocation();
  return Linking.openURL(me ? `https://www.google.com/maps/search/%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%9E%E0%B8%A2%E0%B8%B2%E0%B8%9A%E0%B8%B2%E0%B8%A5/@${me.lat},${me.lng},14z` : 'https://www.google.com/maps/search/?api=1&query=%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%9E%E0%B8%A2%E0%B8%B2%E0%B8%9A%E0%B8%B2%E0%B8%A5%E0%B9%83%E0%B8%81%E0%B8%A5%E0%B9%89%E0%B8%89%E0%B8%B1%E0%B8%99');
};

const FILTERS = ['ว่างวันนี้', 'บัตรทอง', 'แพทย์แผนไทย'];

export function PlacesScreen({ route }: { route?: { params?: { mode?: 'doctor' } } }) {
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData('places');
  const nav = useNav();
  const { colors } = useTheme();
  const doctor = route?.params?.mode === 'doctor';
  // แท็บจำ params ไว้ → ล้างโหมดส่งต่อแพทย์เมื่อกดแท็บส่งต่อเอง (ไม่ล้างตอนเปิดรายละเอียดโรงพยาบาลแล้วย้อนกลับมา)
  const tabNav = useNavigation();
  React.useEffect(
    () => (tabNav as unknown as { addListener: (e: string, cb: () => void) => () => void }).addListener('tabPress', () => (tabNav as unknown as { setParams: (p: object) => void }).setParams({ mode: undefined })),
    [tabNav],
  );
  const [filters, setFilters] = React.useState<string[]>([]);
  // ตำแหน่งผู้ใช้ (ระยะทางจริง) + ข้อมูลหน่วยบริการจากระบบ → วาดใหม่เมื่อได้มา
  const [, refresh] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    void locate();
    const a = onLocation(refresh);
    const b = onAvailability(refresh);
    return () => {
      a();
      b();
    };
  }, []);
  const [picked, setPicked] = React.useState<string | null>(null);
  const list = PLACES.filter((p) => (doctor ? p.kind === 'hospital' : p.kind === 'clinic'))
    .filter(
      (p) => doctor || ((!filters.includes('ว่างวันนี้') || p.slots.length > 0) && (!filters.includes('บัตรทอง') || p.uc) && (!filters.includes('แพทย์แผนไทย') || p.therapy)),
    )
    .sort((a, b) => a.km - b.km);

  return (
    <Screen header={<AppBar title={doctor ? 'ส่งต่อโรงพยาบาล' : 'หน่วยบริการส่งต่อ'} onBack={doctor ? () => nav.goBack() : undefined} />}>
      {loading ? (
        <ScreenSkeleton variant="list" count={4} />
      ) : (
      <>
      {/* แผนที่ 3 มิติ (MapLibre + OpenFreeMap · ฟรี) · แตะหมุด = เลื่อนไปการ์ดนั้น */}
      <PlacesMap
        places={list.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind, slots: p.slots.length }))}
        me={isCloud() ? myLocation() : MY_LOCATION}
        selected={picked ?? undefined}
        onPick={setPicked}
      />
      {doctor ? null : <ChipSection options={FILTERS} value={filters} onChange={setFilters} />}

      {/* ใช้งานจริง: โรงพยาบาลค้นใน Google Maps · ยังไม่มีหน่วยบริการเชื่อมระบบ → บอกตรง ๆ */}
      {isCloud() && doctor ? <Button label="ค้นหาโรงพยาบาลใกล้ฉันใน Google Maps" iconLeft="navigation" onPress={() => void searchHospitals()} /> : null}
      {isCloud() && !doctor && !list.length ? (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
          <Mascot pose="search" size={140} />
          <Text variant="bodySm" tone="secondary" align="center">
            ยังไม่มีหน่วยบริการที่เชื่อมระบบในพื้นที่
          </Text>
        </View>
      ) : null}
      {/* การ์ดหน่วยบริการ: ชื่อ + ระยะทาง/ตำบล (รายละเอียด คิว สิทธิ ผู้ดูแล → หน้ารายละเอียด) */}
      {list.map((p) => {
        const on = picked === p.id;
        const hosp = p.kind === 'hospital';
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name} ${kmText(p)} ดูรายละเอียด`}
            onPress={() => nav.navigate('PlaceDetail', { id: p.id })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              padding: space[3],
              borderRadius: 20,
              backgroundColor: colors.surface.default,
              borderWidth: on ? 2 : 1,
              borderColor: on ? colors.brand.primary : colors.border.subtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hosp ? colors.status.danger.bg : colors.brand.subtle }}>
              <Icon name={hosp ? 'plus-square' : 'map-pin'} color={hosp ? colors.status.danger.fg : colors.brand.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelLg" numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                {p.area}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text variant="labelMd">{kmText(p)}</Text>
              <Icon name="chevron-right" size="sm" color={colors.text.tertiary} />
            </View>
          </Pressable>
        );
      })}
      </>
      )}
    </Screen>
  );
}

/**
 * หน่วยบริการทั้งหมดแบบ bottom sheet — เปิดจากแชทนัดกับ AI (ไม่ต้องออกจากแชท)
 * พื้นหลังจางขึ้นอยู่กับที่ (ไม่เลื่อน) · เฉพาะ sheet เลื่อนขึ้น · ปัดลง/แตะพื้นหลัง/✕ = ปิด
 * เลือกที่ → ปิด sheet แล้วแชทถามผู้ดูแลต่อ
 */
export function PlacesSheet({ visible, onClose, onPick, recommendedId }: { visible: boolean; onClose: () => void; onPick: (placeId: string) => void; recommendedId?: string }) {
  const { colors } = useTheme();
  const [filters, setFilters] = React.useState<string[]>([]);
  const list = PLACES.filter((p) => p.kind === 'clinic')
    .filter((p) => (!filters.includes('ว่างวันนี้') || p.slots.length > 0) && (!filters.includes('บัตรทอง') || p.uc) && (!filters.includes('แพทย์แผนไทย') || p.therapy))
    .sort((a, b) => (a.id === recommendedId ? -1 : b.id === recommendedId ? 1 : a.km - b.km));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="หน่วยบริการทั้งหมด" subtitle={`${list.length} แห่งใกล้คุณ`} header={<ChipSection options={FILTERS} value={filters} onChange={setFilters} />}>
          {list.map((p) => {
            const rec = p.id === recommendedId;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`เลือก ${p.name}`}
                onPress={() => onPick(p.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: space[3],
                  padding: space[4],
                  borderRadius: 24,
                  backgroundColor: colors.surface.default,
                  borderWidth: rec ? 2 : 1,
                  borderColor: rec ? colors.brand.primary : colors.border.subtle,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                })}
              >
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: p.therapy ? colors.brand.subtle : colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={p.therapy ? 'plus-circle' : 'map-pin'} color={p.therapy ? colors.brand.primary : colors.text.secondary} />
                </View>
                <View style={{ flex: 1, gap: space[2] }}>
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Text variant="labelLg" numberOfLines={1} style={{ flex: 1 }}>
                        {p.name}
                      </Text>
                      {rec ? <Badge label="แนะนำ" tone="brand" /> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon name="navigation" size="xs" color={colors.text.tertiary} />
                      <Text variant="caption" tone="secondary">
                        {kmText(p)} {p.area}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
                    {p.therapy ? <Badge label="แพทย์แผนไทย" tone="brand" /> : <Badge label="หมอพื้นบ้าน" tone="neutral" />}
                    {p.uc ? <Badge label="บัตรทอง" tone="success" /> : null}
                  </View>
                  {p.slots.length ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Text variant="caption" tone="tertiary">
                        ว่างวันนี้
                      </Text>
                      {p.slots.map((t) => (
                        <View key={t} style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.surface.sunken }}>
                          <Text variant="labelSm">{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
    </BottomSheet>
  );
}
