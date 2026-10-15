import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppBar, BottomSheet, Button, Icon, InfoRow, Panel, ProfileAvatar, RowLink, Screen, StatTile, Tag, TINT, Text, useHideTabs, useTheme, Mascot } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { PLACES, callClinic, clinicPhone } from './PlacesScreen';
import { isCloud, isoToLabel } from '../../services/clinicBridge';
import { anyoneSlots, dayLabel, therapistsAt, type ServiceId } from '../../data/booking';
import { caseClinic, serviceMismatch, useAllAppointments } from '../../state/appointments';
import { ANY_THERAPIST, AnyTherapistCard, THERAPIST_CARD_W, TherapistCard } from './places/TherapistCard';

/* ============================================================ นัดคนไข้
 * ต่อจากการบันทึกกับหมอบ้าน AI: สรุปอาการคนไข้ + ข้อควรระวัง → เลือกกรรมวิธี (แนะนำจากแนวทาง) → วันเวลา → ผู้ดูแล → ยืนยัน
 * กรรมวิธีที่พ่อหมอได้รับรอง: นวดเส้น ย่ำขาง ประคบ ยาพอก อบสมุนไพร (หนังสือรับรอง ม.บ.3)
 * ค่าครู/ค่ายา: แล้วแต่ศรัทธา หรือค่ายาตามจริง
 */

/**
 * ชื่อ/เวลาตามหลังบ้าน (s2 · s5 · s3 · s1 · s4) · เพื่อการรักษาอยู่บน
 * style = กรรมวิธีของหมอพื้นบ้าน (คำว่า "เพื่อการรักษา"/"ร่วมประคบ" ใช้ตรวจบริการไม่ตรงผลประเมิน — อย่าลบ)
 */
export const SERVICES: { value: ServiceId; label: string; uc: boolean; style: string }[] = [
  { value: 'royal', label: 'นวดเส้นเพื่อการรักษา · 60 นาที', uc: true, style: 'นวดเส้น/นวดจับเส้น โดยพ่อหมอ' },
  { value: 'royal+compress', label: 'นวดเส้นร่วมประคบสมุนไพร · 90 นาที', uc: true, style: 'นวดเส้น + ประคบปูเลย ขมิ้นชัน' },
  { value: 'compress', label: 'ประคบสมุนไพร · 60 นาที', uc: true, style: 'ลูกประคบปูเลย (ไพล) อุ่น' },
  { value: 'relax', label: 'อบสมุนไพร · 45 นาที', uc: false, style: 'อบไอน้ำสมุนไพร ค่ายาตามจริง' },
  { value: 'foot', label: 'ย่ำขาง · 30 นาที', uc: false, style: 'ย่ำขางที่เท้า ค่ายาตามจริง' },
];
export const THERAPISTS = [
  { value: 't2', label: 'พ่อหมอสมบัติ ศรีสุข', description: 'หมอพื้นบ้าน ม.บ.3' },
  { value: 't1', label: 'น้องแก้ว ศรีสุข', description: 'ผู้ช่วยบันทึก (ลูกหลาน)' },
];
const CLINIC = 'รพ.สต.บ้านค้อ';

const WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/**
 * ปฏิทินบนหน้านัด (วางบนหน้า ไม่อยู่ในการ์ด · ที่เดียวที่เลือกวัน) → เวลาของวันนั้นขึ้นด้านล่าง → ผู้ดูแล
 * สัปดาห์ / เดือน (สลับได้) · ปัดซ้ายขวาเปลี่ยนสัปดาห์/เดือน (ไม่มีลูกศร) · แตะหัว "ตุลาคม 2569 ▾" = bottom sheet เลือกเดือน/ปี
 * ช่วงตามที่หมอลงตาราง · วันมีคิว = จุด · ไม่มีคิว/ผ่านไปแล้ว = จางกดไม่ได้ · วันนี้ = ตัวเลขสีแบรนด์ · เลือก = วงกลมเขียว
 */
function InlineCalendar({ counts, last, value, onPick }: { /** วัน (offset) → จำนวนรอบว่าง */ counts: Map<number, number>; last: number; value: number | null; onPick: (offset: number) => void }) {
  const { colors } = useTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(today);
  lastDate.setDate(today.getDate() + Math.max(0, last));
  const dateOf = (off: number) => {
    const v = new Date(today);
    v.setDate(today.getDate() + off);
    return v;
  };
  const offOf = (dt: Date) => Math.round((dt.getTime() - today.getTime()) / 86400000);
  const monthIdx = (dt: Date) => (dt.getFullYear() - today.getFullYear()) * 12 + dt.getMonth() - today.getMonth();
  // สัปดาห์ (อา.–ส.) นับจากสัปดาห์นี้
  const weekIdx = (off: number) => Math.floor((off + today.getDay()) / 7);
  const maxM = Math.max(0, monthIdx(lastDate));
  const maxW = Math.max(0, weekIdx(Math.max(0, last)));
  const firstOpen = [...counts.keys()].sort((x, y) => x - y)[0];
  const start = value ?? firstOpen ?? 0;
  const [view, setView] = React.useState<'week' | 'month'>('week');
  const [page, setPage] = React.useState(() => weekIdx(start));
  const [sheet, setSheet] = React.useState(false);
  const [year, setYear] = React.useState(today.getFullYear());
  const [width, setWidth] = React.useState(0);
  const pager = React.useRef<ScrollView>(null);
  const cellW = `${100 / 7}%` as const;
  const pages = view === 'week' ? maxW + 1 : maxM + 1;
  const weekStart = (wi: number) => dateOf(wi * 7 - today.getDay());
  const monthFirst = (mi: number) => new Date(today.getFullYear(), today.getMonth() + mi, 1);
  // หัว: เดือนของหน้าที่เห็น (สัปดาห์ = วันแรกในสัปดาห์ที่ยังไม่ผ่าน)
  const headDate = view === 'week' ? (weekStart(page) < today ? today : weekStart(page)) : monthFirst(page);
  const goTo = (p: number, animated = true) => {
    setPage(p);
    if (width) pager.current?.scrollTo({ x: p * width, animated });
  };
  // ไปหน้าตามขนาดจริงเมื่อวัดความกว้างได้/สลับมุมมอง
  React.useEffect(() => {
    if (width) pager.current?.scrollTo({ x: page * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, view]);
  const switchView = (v: 'week' | 'month') => {
    if (v === view) return;
    // สลับแล้วยังอยู่ช่วงเดิม: สัปดาห์ → เดือนของสัปดาห์นั้น · เดือน → สัปดาห์ของวันที่เลือก (ในเดือนนี้) ไม่งั้นสัปดาห์แรกของเดือน
    const p = v === 'month' ? monthIdx(headDate) : value !== null && monthIdx(dateOf(value)) === page ? weekIdx(value) : Math.max(0, weekIdx(offOf(monthFirst(page))));
    setPage(p);
    setView(v);
  };
  const pickMonth = (idx: number) => {
    setSheet(false);
    goTo(view === 'month' ? idx : Math.max(0, weekIdx(offOf(monthFirst(idx)))));
  };
  const grid = (cells: (Date | null)[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 }}>
      {cells.map((dt, i) => {
        if (!dt) return <View key={`e${i}`} style={{ width: cellW, height: 46 }} />;
        const off = offOf(dt);
        const can = (counts.get(off) ?? 0) > 0;
        const on = value === off;
        return (
          <View key={off} style={{ width: cellW, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !can }}
              accessibilityLabel={`${dt.getDate()} ${MONTH_FULL[dt.getMonth()]}${can ? '' : ' ไม่มีคิว'}`}
              disabled={!can}
              onPress={() => onPick(off)}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand.primary : 'transparent' }}
            >
              <Text variant={can || off === 0 ? 'labelMd' : 'bodyMd'} color={on ? '#FFFFFF' : off === 0 ? colors.brand.primary : can ? colors.text.primary : colors.text.tertiary} style={can || on ? undefined : { opacity: 0.45 }}>
                {dt.getDate()}
              </Text>
              {can && !on ? <View style={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand.primary }} /> : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
  const cellsOf = (p: number): (Date | null)[] => {
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => dateOf(p * 7 - today.getDay() + i));
    const f = monthFirst(p);
    return [...Array.from({ length: f.getDay() }, () => null), ...Array.from({ length: new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate() }, (_, i) => new Date(f.getFullYear(), f.getMonth(), i + 1))];
  };
  const seg = (v: 'week' | 'month', label: string) => (
    <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: view === v }} onPress={() => switchView(v)} style={{ paddingHorizontal: space[3], height: 30, borderRadius: radius.full, justifyContent: 'center', backgroundColor: view === v ? colors.surface.default : 'transparent' }}>
      <Text variant="labelSm" color={view === v ? colors.text.primary : colors.text.secondary}>
        {label}
      </Text>
    </Pressable>
  );
  const yearBtn = (icon: 'chevron-left' | 'chevron-right', disabled: boolean, onPress: () => void, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.sunken, opacity: disabled ? 0.3 : 1 }}>
      <Icon name={icon} size="sm" color={colors.text.primary} />
    </Pressable>
  );
  return (
    <View style={{ gap: space[3] }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {/* หัว: เดือน/ปี (แตะ = เลือกเดือน) · สัปดาห์|เดือน */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* ปุ่มเดือน: ทรงเดียว สูงเท่ากับตัวสลับ สัปดาห์|เดือน ด้านขวา (คู่กันในแถวเดียว ไม่ลอย) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`เลือกเดือน ตอนนี้ ${MONTH_FULL[headDate.getMonth()]} ${headDate.getFullYear() + 543}`}
          onPress={() => (setYear(headDate.getFullYear()), setSheet(true))}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 36, paddingHorizontal: space[3], borderRadius: radius.full, backgroundColor: colors.surface.sunken, opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="calendar" size="xs" color={colors.text.secondary} />
          <Text variant="labelMd">
            {MONTH_FULL[headDate.getMonth()]} {headDate.getFullYear() + 543}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', padding: 3, borderRadius: radius.full, backgroundColor: colors.surface.sunken }}>
          {seg('week', 'สัปดาห์')}
          {seg('month', 'เดือน')}
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_SHORT.map((wd) => (
          <Text key={wd} variant="caption" tone="tertiary" style={{ width: cellW, textAlign: 'center' }}>
            {wd}
          </Text>
        ))}
      </View>
      {/* ปัดซ้ายขวา = สัปดาห์/เดือน ก่อน-ถัดไป */}
      {width ? (
        <ScrollView
          key={view}
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width }}
          contentOffset={{ x: page * width, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {Array.from({ length: pages }, (_, p) => (
            <View key={p} style={{ width }}>
              {grid(cellsOf(p))}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* เลือกเดือน (bottom sheet) · เปลี่ยนปีได้ · เดือนที่หมอยังไม่ลงตาราง = กดไม่ได้ */}
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="เลือกเดือน" heightRatio={0.55}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {yearBtn('chevron-left', year <= today.getFullYear(), () => setYear(year - 1), 'ปีก่อน')}
          <Text variant="titleMd">{year + 543}</Text>
          {yearBtn('chevron-right', year >= lastDate.getFullYear(), () => setYear(year + 1), 'ปีถัดไป')}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space[3] }}>
          {MONTH_SHORT.map((label, mi) => {
            const idx = (year - today.getFullYear()) * 12 + mi - today.getMonth();
            const can = idx >= 0 && idx <= maxM;
            const on = idx === monthIdx(headDate);
            return (
              <View key={label} style={{ width: '33.33%', alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: !can }}
                  accessibilityLabel={`${MONTH_FULL[mi]} ${year + 543}`}
                  disabled={!can}
                  onPress={() => pickMonth(idx)}
                  style={{ width: '90%', height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand.primary : colors.surface.sunken, opacity: can ? 1 : 0.35 }}
                >
                  <Text variant="labelMd" color={on ? '#FFFFFF' : colors.text.primary}>
                    {label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

type BookingParams = { clinic?: string; therapist?: string; day?: string; time?: string; service?: ServiceId; caseId?: string; draftId?: string; looseId?: string };
/** คนไข้ที่นัด: ใบการรักษา / ใบร่าง / นัดคนไข้ใหม่ที่มีอยู่ (เลื่อน) / คนไข้ใหม่ (นัดเพิ่ม) */
type Topic = { key: string; caseId?: string; draftId?: string; looseId?: string; title: string; sub?: string };

export function BookingScreen({ route }: { route?: { params?: BookingParams } }) {
  const nav = useNav();
  const pre = route?.params;
  useHideTabs(true);
  const { colors } = useTheme();
  const { log, newPatient, setCareStage, drafts, activeDraftId, upsertDraft, cases, looseBookings, addLooseBooking, updateLooseBooking, setCaseAppointment, issueQueue, requestBooking, bookCase } = useJourney();
  const allAppts = useAllAppointments();
  // หน่วยบริการที่เลือกมา (หน้าส่งต่อ) · คนไข้ที่รักษาอยู่ใช้ที่เดิมเสมอ (ดูด้านล่าง)
  // ใช้งานจริง: ชื่อหน่วยบริการตามที่ตั้งไว้ (ตรงกับหน้าส่งต่อ)
  const pickedClinic = pre?.clinic ?? (isCloud() ? PLACES[0]?.name : undefined) ?? CLINIC;

  /* ---------- นัดให้คนไข้คนไหน ---------- */
  // ระบุมาแล้ว (จากการ์ดของเรื่องนั้น) → ไม่ต้องเลือก · ไม่ระบุ → เลือกในหน้านี้ (ไม่เดาจากใบที่ประเมินล่าสุด)
  const topics: Topic[] = [
    ...drafts.map((d) => ({
      key: `d:${d.id}`,
      draftId: d.id,
      title: d.guide?.areas && d.guide.areas.length > 1 ? `${d.guide.areas[0].region ?? d.guide.areas[0].symptom} +${d.guide.areas.length - 1}` : d.title,
      sub: d.booking ? `มีนัด ${d.booking.date} ${d.booking.time}` : d.assessedOn ? `บันทึก ${isoToLabel(d.assessedOn)}` : 'บันทึกแล้ว',
    })),
    // คนไข้ที่รักษาอยู่ → นัดได้เฉพาะที่เดิม (บอกไว้ในตัวเลือก)
    // คนไข้ที่รักษาอยู่ไม่อยู่ในรายการนี้: นัดครั้งถัดไปมาจากแผนการรักษา · นัดคนไข้ใหม่เพิ่มได้
    // นัดคนไข้ใหม่ที่นัดไว้แล้ว → เลือก = เลื่อนนัดนั้น
    ...looseBookings.map((b) => ({ key: `l:${b.id}`, looseId: b.id, title: `นัดคนไข้ใหม่ ${b.date} ${b.time}`, sub: `เลื่อนนัดนี้ · ${b.clinic}` })),
    // คนไข้ใหม่ (ยังไม่ได้บันทึกอาการ) → นัดเพิ่มได้หลายนัด ไม่ทับนัดเดิม
    { key: 'new', title: newPatient && !looseBookings.length ? 'ยังไม่ได้บันทึกอาการ' : 'คนไข้ใหม่', sub: looseBookings.length ? 'นัดเพิ่ม · เล่าอาการกับ AI ทีหลัง' : 'นัดก่อน เล่าอาการกับ AI ทีหลัง' },
  ];
  const fixed = !!(pre?.caseId || pre?.draftId || pre?.looseId);
  /**
   * นัดใหม่ (ไม่ได้มาจากการ์ดของคนไข้) → เลือกได้เฉพาะคนไข้ที่บันทึกแล้วยังไม่นัด + คนไข้ใหม่
   * ไม่แสดง: คนไข้ที่นัดแล้ว/ยังไม่บันทึก (เลื่อนนัดจากการ์ดนัด) · ควรส่งต่อแพทย์ก่อน (นัดรักษาไม่ได้) · รักษาอยู่ (นัดตามแผน)
   */
  const pickable = topics.filter((t) => t.key === 'new' || (t.draftId && drafts.some((d) => d.id === t.draftId && !d.booking && !d.red && d.stage === 'assessed')));
  const initialKey = pre?.caseId
    ? `c:${pre.caseId}`
    : pre?.draftId
      ? `d:${pre.draftId}`
      : pre?.looseId
        ? `l:${pre.looseId}`
        : (pickable.find((t) => t.draftId === activeDraftId) ?? pickable[0])?.key;
  const [topicKey, setTopicKey] = React.useState(initialKey ?? 'new');
  const topic = topics.find((t) => t.key === topicKey) ?? topics[0];
  const draft = drafts.find((d) => d.id === topic?.draftId);
  const tc = cases.find((c) => c.id === topic?.caseId);
  const loose = looseBookings.find((b) => b.id === topic?.looseId);
  const red = !!draft?.red;
  // คนไข้ที่รักษาอยู่: นัดครั้งถัดไปต้องที่เดิม (ไม่ใช่หน่วยบริการที่เปิดดูมา)
  const clinic = tc ? caseClinic(tc) : pickedClinic;
  const clinicLocked = !!tc && pickedClinic !== clinic && !!pre?.clinic;
  // นัดเดิมของคนไข้นี้ → การยืนยันคือ "เลื่อนนัด" (แทนที่ ไม่ซ้อน) · คนไข้ใหม่ = นัดเพิ่ม
  const current = tc && tc.appointment.date !== '-' ? { date: tc.appointment.date, time: tc.appointment.time } : draft?.booking ?? loose ?? null;

  /* ---------- กรรมวิธี ---------- */
  // ใบการรักษา = กรรมวิธีเพื่อรักษา (ไม่รวมอบสมุนไพร) · ข้อควรระวังเรื่องอบ/ประคบ → ไม่แนะนำประคบ
  const caution = draft?.caution ?? '';
  /**
   * กรรมวิธีที่แนะนำของคนไข้นั้น — ตามแนวทางการรักษา (วิธีมีประคบ = นวดเส้น + ประคบ) เว้นแต่ข้อควรระวังให้งดประคบ/อบ
   * การรักษาที่ทำอยู่ = ตามแผนเดิม · คนไข้ใหม่ (ยังไม่บันทึก) = ไม่มีคำแนะนำ
   */
  const recommendedFor = (d?: typeof draft, c?: typeof tc): ServiceId | undefined => {
    if (c) return c.plan.includes('ประคบ') ? 'royal+compress' : 'royal';
    if (!d) return undefined;
    const noCompress = /อบ|ประคบ/.test(d.caution ?? '');
    const withCompress = d.guide ? d.guide.methods.some((m) => m.includes('ประคบ')) : true;
    return withCompress && !noCompress ? 'royal+compress' : 'royal';
  };
  const recommended: ServiceId = recommendedFor(draft, tc) ?? 'royal';
  const hasRecommendation = !!recommendedFor(draft, tc);
  const services = tc ? SERVICES.filter((x) => x.value !== 'relax') : SERVICES;
  const [service, setService] = React.useState<ServiceId>(pre?.service ?? recommended);

  // ผู้ดูแลของหน่วยบริการนี้ที่ลงตารางกรรมวิธีที่เลือก (แบบ shift.services หลังบ้าน)
  // เลือกตามลำดับ วัน → เวลา → ผู้ดูแล (เฉพาะคนที่ว่างเวลานั้น) — ข้อมูลไม่ยาวขึ้นตามจำนวนรอบ
  const place = PLACES.find((x) => x.name === clinic);
  const staff = place ? therapistsAt(place.id, service) : [];
  // คิวว่างรวมทุกคนที่ทำกรรมวิธีนี้ (วัน|เวลา → ใครว่าง)
  const anySlots = place ? anyoneSlots(place.id, service) : [];
  // ผู้ที่ดูแลอยู่ (คนไข้ที่รักษา) / คนเดิมของนัดที่เลื่อน → เลือกไว้ให้ก่อนถ้าว่าง
  const preferred = staff.find((x) => x.name === (pre?.therapist ?? tc?.therapist))?.id;
  const offsetOf = (label?: string) => (label ? anySlots.find((f) => dayLabel(f.day) === label)?.day ?? null : null);
  const [day, setDay] = React.useState<number | null>(() => offsetOf(pre?.day));
  const [time, setTime] = React.useState<string | null>(() => (offsetOf(pre?.day) !== null ? pre?.time ?? null : null));
  const [who, setWho] = React.useState<string>(() => (pre?.therapist === 'ไม่ระบุแพทย์' ? ANY_THERAPIST : preferred ?? ANY_THERAPIST));
  const freeAt = (d: number | null, t: string | null, v = service) => (place && d !== null && t ? anyoneSlots(place.id, v).find((f) => f.day === d && f.time === t)?.who ?? [] : []);
  const pick = day !== null && time ? { id: who, day: dayLabel(day), time } : null;
  const any = who === ANY_THERAPIST;
  const picked = staff.find((x) => x.id === who);
  const slotOk = (id: string, d: number | null, t: string | null, v = service) => {
    const free = freeAt(d, t, v);
    return free.length > 0 && (id === ANY_THERAPIST || free.some((x) => x.id === id));
  };
  const pickDay = (d: number) => {
    // เปลี่ยนวัน = เลือกเวลาใหม่เสมอ (ไม่พาเวลาเดิมข้ามวันโดยไม่รู้ตัว)
    if (d !== day) setTime(null);
    setDay(d);
    revealNext();
  };
  const pickTime = (t: string, d = day) => {
    setTime(t);
    revealNext();
    const free = freeAt(d, t);
    // คนที่เลือกไว้ไม่ว่างเวลานี้ → คนที่ดูแลอยู่ (ถ้าว่าง) → ไม่ระบุ
    if (who !== ANY_THERAPIST && !free.some((x) => x.id === who)) setWho(preferred && free.some((x) => x.id === preferred) ? preferred : ANY_THERAPIST);
  };
  // วันที่มีในตาราง (วันนี้ → วันสุดท้ายที่มีคิว) · เวลาของวันที่เลือก
  // วันที่หมอลงตารางไกลสุด · จำนวนรอบว่างต่อวัน (ปฏิทิน)
  const lastDay = anySlots.length ? Math.max(...anySlots.map((f) => f.day)) : -1;
  const dayCounts = new Map<number, number>();
  for (const f of anySlots) dayCounts.set(f.day, (dayCounts.get(f.day) ?? 0) + 1);
  const timesOf = (d: number) => [...new Set(anySlots.filter((f) => f.day === d).map((f) => f.time))].sort();
  // เลือกผู้ดูแล → เลื่อนการ์ดที่เลือกมาชิดซ้าย (แบบแถบเลือกคนไข้) · เลือกให้อัตโนมัติก็เลื่อนตาม
  const whoRef = React.useRef<ScrollView>(null);
  // เลือกวัน/เวลา → เลื่อนหน้าลงให้เห็นขั้นถัดไป (เวลา · ผู้ดูแล อยู่ท้ายหน้า) ไม่ต้องเลื่อนเอง
  const pageRef = React.useRef<ScrollView>(null);
  const revealNext = () => setTimeout(() => pageRef.current?.scrollToEnd({ animated: true }), 80);
  React.useEffect(() => {
    if (day === null || !time) return;
    const i = who === ANY_THERAPIST ? 0 : freeAt(day, time).findIndex((x) => x.id === who) + 1;
    if (i < 0) return;
    const id = setTimeout(() => whoRef.current?.scrollTo({ x: i * (THERAPIST_CARD_W + space[3]), animated: true }), 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, day, time]);
  const pickService = (v: ServiceId) => {
    setService(v);
    if (!slotOk(who, day, time, v)) {
      if (!freeAt(day, time, v).length) setTime(null);
      else setWho(ANY_THERAPIST);
    }
  };
  const pickTopic = (k: string) => {
    setTopicKey(k);
    const t = topics.find((x) => x.key === k);
    const c = cases.find((x) => x.id === t?.caseId);
    const d = drafts.find((x) => x.id === t?.draftId);
    // เลือกคนไข้ที่บันทึกแล้ว → กรรมวิธีตามแนวทางของคนไข้นั้น (เปลี่ยนเองได้) · ใบการรักษาไม่รวมอบสมุนไพร
    const rec = recommendedFor(d, c);
    if (rec && rec !== service) pickService(rec);
  };
  // เวลาชนกับนัดอื่นของเรา (ไม่นับนัดเดิมของคนไข้นี้ที่กำลังเลื่อน) → นัดซ้อนเวลาเดียวกันไม่ได้
  const selfKey = tc ? `c:${tc.id}` : draft ? `d:${draft.id}` : loose ? `l:${loose.id}` : '';
  const clash = pick ? allAppts.find((a) => a.key !== selfKey && a.date === pick.day && a.time === pick.time) : undefined;
  const ready = !red && !!pick && (any || !!picked) && slotOk(who, day, time) && !clash;

  const confirm = () => {
    const svc = SERVICES.find((x) => x.value === service)!;
    if (!pick || !ready) return;
    // ไม่ระบุผู้ดูแล → จัดคนแรกที่ว่างช่วงนั้น
    const staffer = any ? freeAt(day, time)[0] : picked;
    if (!staffer) return;
    const today = pick.day === 'วันนี้';
    const queue = today ? issueQueue() : undefined;
    // นัดจากแอป = คำขอนัด → รอเจ้าหน้าที่หน่วยบริการยืนยัน (เลขคิวออกตอนยืนยัน)
    const bk = { date: pick.day, time: pick.time, service: svc.label, therapist: staffer.name, clinic, queue: tc ? queue : undefined, visit: tc ? tc.course.done + 1 : 1, status: tc ? undefined : ('pending' as const) };
    const label = `${pick.day} ${pick.time}`;
    if (tc) bookCase(tc.id, { today, date: pick.day, time: pick.time, queue, clinic, therapist: staffer.name }, svc.label);
    else if (draft) {
      upsertDraft({ ...draft, stage: 'booked', booking: bk });
      requestBooking({ draftId: draft.id }, label);
    } else if (loose) {
      updateLooseBooking(loose.id, bk);
      requestBooking({ looseId: loose.id }, label);
    } else requestBooking({ looseId: addLooseBooking(bk) }, label);
    if (newPatient && !tc) setCareStage('booked');
    const named = tc || draft;
    log('พ่อหมอ', `${current ? 'เลื่อนนัด' : 'นัดคนไข้'} ${pick.day} ${pick.time} · ${svc.label} · ${staffer.name}${any ? ' (ไม่ระบุผู้ดูแล)' : ''}${named ? ` · ${topic!.title}` : ''}`);
    nav.replace('BookingDone', { ...bk, topic: named ? topic!.title : undefined, caution: caution || undefined, moved: !!current, pending: !tc });
  };

  // นัดของคนไข้ที่รักษาอยู่ = ตามแผน (หน่วยบริการนัด/เลื่อน/ยกเลิกให้) → ในแอปดูได้อย่างเดียว ติดต่อหน่วยบริการ
  const lockedCase = pre?.caseId ? cases.find((c) => c.id === pre.caseId) : undefined;
  if (lockedCase) {
    const has = lockedCase.appointment.date !== '-';
    return (
      <Screen header={<AppBar onBack={() => nav.goBack()} title="นัดของการรักษา" />} footer={<Button label={`ติดต่อหน่วยบริการ ${clinicPhone(caseClinic(lockedCase))}`} iconLeft="phone" onPress={() => callClinic(caseClinic(lockedCase))} />}>
        <Panel icon="calendar" tint={TINT.amber} title={has ? `มีนัด ${lockedCase.appointment.date} ${lockedCase.appointment.time}` : 'รอนัดครั้งถัดไปตามแผน'}>
          <Text variant="bodySm" tone="secondary">
            {has ? 'นัดของการรักษาเลื่อนหรือยกเลิกได้ที่หน่วยบริการ แก้ไขแล้วจะแจ้งเตือนในแอป' : 'แอปจะเตือนเมื่อถึงวันนัดติดตามคนไข้ครั้งถัดไป'}
          </Text>
        </Panel>
      </Screen>
    );
  }
  // นัดเดิมกรรมวิธีไม่ตรงผลประเมิน → หน้านี้คือ "เปลี่ยนกรรมวิธี" (ไม่ใช่แค่เลื่อนเวลา)
  const wrongService = !!draft?.booking && !draft.keepService && !!serviceMismatch(draft.booking.service, draft.caution);
  const title = wrongService ? 'เปลี่ยนกรรมวิธี' : current ? 'เลื่อนนัด' : tc ? `นัดครั้งที่ ${Math.min(tc.course.total, tc.course.done + 1)}` : 'นัดคนไข้';
  return (
    <Screen
      scrollRef={pageRef}
      header={<AppBar onBack={() => nav.goBack()} title={title} />}
      footer={<Button label={red ? 'ควรส่งต่อแพทย์ก่อนรักษา' : clash ? `เวลานี้มีนัด${clash.topic.replace(/^นัด/, '')}แล้ว` : ready ? `ยืนยัน ${pick!.day} ${pick!.time}` : 'เลือกผู้ดูแลและเวลา'} disabled={!ready} onPress={confirm} />}
    >
      {/* หน่วยบริการที่นัด */}
      <Panel flush>
        <RowLink icon="map-pin" tint={TINT.green} title={clinic} sub={tc ? 'ที่ที่รักษาอยู่ (นัดต่อที่เดิม)' : 'หน่วยบริการ'} last />
      </Panel>

      {/* เปิดจากหน่วยบริการอื่น แต่เลือกคนไข้ที่รักษาอยู่ → บอกว่าย้ายมาที่เดิม */}
      {clinicLocked ? (
        <Text variant="bodySm" tone="secondary">
          คนไข้ที่รักษาอยู่นัดต่อได้เฉพาะ{clinic}
        </Text>
      ) : null}

      {/* นัดให้คนไข้คนไหน — มีหลายคน/ไม่ได้ระบุมา → เลือก (นัดไปอยู่ที่การ์ดของคนไข้นั้น) */}
      {/* นัดให้คนไข้คนไหน — แยกการ์ดทีละคน (เลือกได้หนึ่ง) · คนที่บันทึกแล้วก่อน คนไข้ใหม่ท้ายสุด */}
      {!fixed && pickable.length > 1 ? (
        <View style={{ gap: space[2] }}>
          <Text variant="labelLg">นัดให้คนไข้คนไหน</Text>
          {pickable.map((t) => {
            const on = t.key === topicKey;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t.title} ${t.sub ?? ''}`}
                onPress={() => pickTopic(t.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[4],
                  borderRadius: 20,
                  backgroundColor: colors.surface.default,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.brand.primary : colors.border.subtle,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="labelMd">{t.title}</Text>
                  {t.sub ? (
                    <Text variant="bodyXs" tone="secondary">
                      {t.sub}
                    </Text>
                  ) : null}
                </View>
                <Icon name={on ? 'check-circle' : 'circle'} size="sm" color={on ? colors.brand.primary : colors.text.tertiary} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {/* การรักษาที่ทำอยู่ไม่อยู่ในรายการ → บอกเหตุผลสั้น ๆ */}
      {!fixed && cases.length ? (
        <Text variant="bodyXs" tone="tertiary">
          นัดครั้งถัดไปของคนไข้ที่รักษาอยู่ จะนัดให้ตามแผนการรักษา
        </Text>
      ) : null}

      {/* ข้อมูลของคนไข้ที่นัด — เห็นก่อนถึงคิว */}
      {red ? (
        <Panel icon="alert-triangle" tint={TINT.red} title="ควรส่งต่อแพทย์ก่อนรักษา">
          <Text variant="bodySm" tone="secondary">
            อาการ{draft?.title}มีสัญญาณอันตรายที่ต้องให้แพทย์ตรวจก่อน
          </Text>
          <Button label="ดูคำแนะนำ" variant="secondary" size="md" onPress={() => nav.navigate('RedFlag', { reason: draft?.title })} />
        </Panel>
      ) : draft ? (
        <Panel icon="clipboard" tint={TINT.violet} title="จากบันทึก ม.บ.5">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {draft.symptoms.map((x) => (
              <Tag key={x} text={x} />
            ))}
            <Tag text={`อาการ ${draft.pain}/10`} tone="warn" />
          </View>
          {draft.caution ? (
            <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
              <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} />
              <Text variant="bodySm">{draft.caution}</Text>
            </View>
          ) : null}
        </Panel>
      ) : tc ? (
        <Panel icon="clipboard" tint={TINT.violet} title={`รักษา${tc.short}`}>
          <InfoRow k="กรรมวิธี" v={tc.plan} />
          <InfoRow k="นัดรักษา" v={`ครั้งที่ ${Math.min(tc.course.total, tc.course.done + 1)} / ${tc.course.total}`} />
        </Panel>
      ) : (
        <Panel icon="message-circle" tint={TINT.violet} title={loose ? 'นัดคนไข้ใหม่' : 'ยังไม่ได้บันทึกอาการ'}>
          <Text variant="bodySm" tone="secondary">
            เล่าอาการคนไข้ให้หมอบ้าน AI ก่อนถึงนัด จะได้ลง ม.บ.5 ครบ
          </Text>
        </Panel>
      )}

      {current && !red ? (
        <Panel flush>
          <RowLink icon="calendar" tint={TINT.amber} title={`นัดเดิม ${current.date} ${current.time}`} sub={wrongService ? `${draft?.booking?.service ?? ''} · ยืนยันแล้วนัดใหม่จะแทนนัดนี้` : 'ยืนยันแล้วนัดใหม่จะแทนนัดนี้'} last />
        </Panel>
      ) : null}
      {/* เปลี่ยนตามคำแนะนำ = ทางเลือก ไม่บังคับ → เปลี่ยนใจใช้แผนเดิมได้ตลอด (เลือกเวลา/ผู้ดูแลเองก่อนยืนยัน) */}
      {wrongService && draft ? (
        <Button
          label="ใช้แผนเดิม ไม่เปลี่ยน"
          variant="ghost"
          size="md"
          onPress={() => {
            upsertDraft({ ...draft, keepService: true });
            log('พ่อหมอ', `คงกรรมวิธีที่นัดไว้ (${draft.booking?.service ?? ''}) แม้ไม่ตรงผลประเมิน`);
            nav.goBack();
          }}
        />
      ) : null}

      {red ? null : (
        <>
          <Panel icon="activity" tint={TINT.green} title="กรรมวิธี" flush>
            {services.map((sv, i) => (
              <Choice
                key={sv.value}
                on={service === sv.value}
                title={sv.label}
                sub={[sv.style, sv.uc ? 'แล้วแต่ศรัทธา' : ''].filter(Boolean).join(' · ')}
                badge={sv.value === recommended && hasRecommendation ? 'แนะนำ' : undefined}
                onPress={() => pickService(sv.value)}
                last={i === services.length - 1}
              />
            ))}
          </Panel>

          {/* วัน → เวลา → ผู้ดูแล */}
          <View style={{ gap: space[3] }}>
            <Text variant="labelLg">วันและเวลา</Text>
            {staff.length ? (
              <>
                {/* ① วัน: ปฏิทินรายเดือน (ที่เดียวที่เลือกวัน) */}
                <InlineCalendar counts={dayCounts} last={lastDay} value={day} onPick={pickDay} />

                {/* ② เวลา: เฉพาะวันที่เลือก (รวมทุกคน) */}
                {day !== null ? (
                  // ตาราง 4 คอลัมน์เต็มความกว้าง (แถวสุดท้ายไม่ครบ = ช่องว่างแทน ปุ่มยังกว้างเท่ากัน)
                  <View style={{ gap: space[2] }}>
                    {Array.from({ length: Math.ceil(timesOf(day).length / 4) }, (_, r) => timesOf(day).slice(r * 4, r * 4 + 4)).map((row, r) => (
                      <View key={r} style={{ flexDirection: 'row', gap: space[2] }}>
                        {[...row, ...Array.from({ length: 4 - row.length }, () => null)].map((t, i) =>
                          t ? (
                            <Pressable
                              key={t}
                              accessibilityRole="button"
                              accessibilityState={{ selected: time === t }}
                              accessibilityLabel={`${dayLabel(day)} ${t}`}
                              onPress={() => pickTime(t)}
                              style={{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: time === t ? colors.text.primary : colors.surface.sunken }}
                            >
                              <Text variant="labelMd" color={time === t ? colors.text.inverse : colors.text.primary}>
                                {t}
                              </Text>
                            </Pressable>
                          ) : (
                            <View key={`e${i}`} style={{ flex: 1 }} />
                          ),
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* ③ ผู้ดูแล: การ์ดแนวนอน เฉพาะคนที่ว่างเวลานั้น · ไม่ระบุ = จัดคนที่ว่าง */}
                {day !== null && time ? (
                  <ScrollView ref={whoRef} horizontal showsHorizontalScrollIndicator={false} snapToInterval={THERAPIST_CARD_W + space[3]} decelerationRate="fast" style={{ marginHorizontal: -space[4] }} contentContainerStyle={{ gap: space[3], paddingHorizontal: space[4] }}>
                    <Pressable accessibilityRole="radio" accessibilityState={{ selected: any }} accessibilityLabel="ไม่ระบุผู้ดูแล" onPress={() => setWho(ANY_THERAPIST)}>
                      <AnyTherapistCard compact slots={[]} selected={any ? pick : null} onPick={() => undefined} />
                    </Pressable>
                    {freeAt(day, time).map((t) => (
                      <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ selected: who === t.id }} accessibilityLabel={t.name} onPress={() => setWho(t.id)}>
                        <TherapistCard t={t} compact badge={t.id === preferred ? 'ดูแลอยู่' : undefined} selected={who === t.id ? pick : null} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </>
            ) : (
              // ไม่มีใครทำกรรมวิธีนี้ → บอกทางไปต่อ (เปลี่ยนกรรมวิธี / ที่อื่น) ไม่ให้ค้าง
              <Panel>
                <Text variant="bodySm" tone="secondary">
                  {!place ? 'ไม่พบตารางของหน่วยบริการนี้' : therapistsAt(place.id).length ? 'กรรมวิธีนี้ยังไม่มีคิว ลองเลือกกรรมวิธีอื่น' : 'ที่นี่ยังไม่เปิดนัดออนไลน์'}
                </Text>
                <Button label="ดูหน่วยบริการอื่น" variant="secondary" size="md" onPress={() => nav.popTo('ClientTabs', { screen: 'Places' })} />
              </Panel>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

/** นัดสำเร็จ — รายละเอียดนัด + ให้คนไข้เตรียมตัว (ข้อมูลมากับหน้า ไม่อ่านจากนัดกลาง) */
export function BookingDoneScreen({ route }: { route: { params: { date: string; time: string; service: string; therapist: string; clinic: string; queue?: string; topic?: string; caution?: string; moved?: boolean; pending?: boolean } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const b = route.params;
  // คนไข้เตรียมตัว: ตามข้อควรระวังจากการประเมิน + ทั่วไป (ไม่นวดภายใน 30 นาทีหลังอาหาร — ตำราอ้างอิงฯ หน้า 402)
  const prep = [...(b.caution?.includes('ความดัน') || b.caution?.includes('อบ') ? ['วัดความดันก่อนรักษา'] : []), 'งดอาหารหนักก่อนรักษา 30 นาที', 'ใส่เสื้อผ้าหลวมสบาย'];
  return (
    <Screen
      header={<AppBar title={b.pending ? 'ส่งคำขอแล้ว' : b.moved ? 'เลื่อนนัดแล้ว' : 'นัดแล้ว'} />}
      footer={<Button label="กลับหน้าแรก" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />}
    >
      <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
        {/* นัดสำเร็จ: น้องประคบชูมือดีใจ */}
        <Mascot pose="cheer" size={150} />
        <Text variant="titleLg">{b.pending ? (b.moved ? 'ส่งคำขอเลื่อนนัดแล้ว' : 'ส่งคำขอนัดแล้ว') : b.moved ? 'เลื่อนนัดเรียบร้อย' : 'นัดคนไข้เรียบร้อย'}</Text>
        {/* คำขอนัดจากแอป ต้องให้หน่วยบริการยืนยันก่อน (อาจได้เวลาอื่นถ้าคิวเต็ม) */}
        {b.pending ? (
          <Text variant="bodySm" tone="secondary" align="center">
            รอหน่วยบริการยืนยัน จะแจ้งเตือนในแอปเมื่อยืนยันแล้ว
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="วัน" value={b.date} small />
        <StatTile label="เวลา" value={b.time} small />
        {/* เลขคิวออกเฉพาะนัดวันนี้ */}
        {b.queue ? <StatTile label="คิว" value={b.queue} small color={colors.brand.primary} /> : null}
      </View>
      <Panel icon="clipboard" tint={TINT.green} title="รายละเอียดนัด">
        {b.topic ? <InfoRow k="คนไข้" v={b.topic} /> : null}
        <InfoRow k="กรรมวิธี" v={b.service} />
        <InfoRow k="ผู้ดูแล" v={b.therapist} />
        <InfoRow k="หน่วยบริการ" v={b.clinic} />
      </Panel>
      <Panel icon="check-circle" tint={TINT.amber} title="ให้คนไข้เตรียมตัว">
        {prep.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: TINT.amber }} />
            <Text variant="bodySm">{p}</Text>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

/** ตัวเลือกแบบแถวในการ์ด (เลือกได้ 1) — วงกลมเลือก · ชื่อ · รายละเอียด */
function Choice({ on, title, sub, onPress, last, badge }: { on: boolean; title: string; sub?: string; onPress: () => void; last?: boolean; /** ป้ายมุมขวา (เช่น กรรมวิธีที่แนะนำ) */ badge?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={({ pressed }) => ({ backgroundColor: on ? colors.brand.subtle : pressed ? colors.surface.sunken : 'transparent' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.brand.primary : colors.border.strong, alignItems: 'center', justifyContent: 'center' }}>
          {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.primary }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelMd">{title}</Text>
          {sub ? (
            <Text variant="bodyXs" tone="secondary">
              {sub}
            </Text>
          ) : null}
        </View>
        {/* ป้ายคำ + กรอบ (พื้นขาว ไม่กลืนกับแถวที่เลือกซึ่งพื้นเขียวอ่อน) */}
        {badge ? (
          <View style={{ alignSelf: 'center', paddingHorizontal: space[2], height: 24, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.brand.primary, backgroundColor: colors.surface.default }}>
            <Text variant="labelSm" color={colors.brand.primary}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
