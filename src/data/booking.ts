/**
 * นัดคนไข้กับ AI — ตารางเจ้าหน้าที่หน่วยบริการที่รับส่งต่อ + วิเคราะห์ความเร่งด่วน
 * ------------------------------------------------------------------
 * ความเร่งด่วนคิดด้วยกฎตายตัวจากผลประเมิน (ไม่ให้ AI เดา เพราะเกี่ยวกับความปลอดภัย) — AI แค่อธิบายผล
 *   ควรนวดภายใน 2 วัน: ปวด ≥ 7 · มีข้อควรระวังจากผลคัดกรอง · ปวดร้าว
 *   ภายใน 7 วัน: ปวด 4–6 · เพิ่งเป็น (ไม่เกิน 1 สัปดาห์)
 *   ไม่เร่ง: ปวดน้อย เป็นมานาน (เรื้อรังคงที่)
 *   พบสัญญาณอันตราย → ไม่นัดรักษา เสนอส่งต่อโรงพยาบาล (จัดการที่แชท)
 * ⚠️ ต้นแบบ: ตารางเจ้าหน้าที่เป็นข้อมูลตัวอย่าง · เกณฑ์ความเร่งด่วนยังไม่ได้ให้แพทย์ตรวจ
 */

import { availabilityRaw, clinicOnline, isCloud, type Availability } from '../services/clinicBridge';

/** ประเภทกรรมวิธี — ชุดเดียวกับหลังบ้าน MohbanHealth (s1–s5) · ตรงกับ SERVICES ในหน้านัด */
export type ServiceId = 'royal' | 'royal+compress' | 'relax' | 'compress' | 'foot';
export const SERVICE_SHORT: Record<ServiceId, string> = { royal: 'นวดเส้น', 'royal+compress': 'นวด + ประคบ', relax: 'นวดจับเส้น', compress: 'ประคบ', foot: 'ย่ำขาง' };
/** รหัสกรรมวิธีของหลังบ้าน (Service.id) — ใช้ตอนส่งนัด/รับนัดจากหน่วยบริการ */
export const SERVICE_CODE: Record<ServiceId, string> = { relax: 's1', royal: 's2', compress: 's3', foot: 's4', 'royal+compress': 's5' };

/** ช่วงเวลาที่เจ้าหน้าที่ลงตารางไว้ + กรรมวิธีที่รับในช่วงนั้น (แบบ shift.services ของหลังบ้าน MohbanHealth) */
export interface FreeSlot {
  /** offset วันจากวันนี้ */
  day: number;
  time: string;
  services: ServiceId[];
}

export interface Therapist {
  id: string;
  name: string;
  /** แพทย์แผนไทย = นวดเพื่อรักษาได้ (health profile 2568 หน้า 34) · หมอนวด = นวดเพื่อสุขภาพ/ดูแลทั่วไป */
  role: 'แพทย์แผนไทย' | 'หมอนวด';
  /** ช่วงว่างที่ลงตารางไว้ (แต่ละช่วงรับบริการต่างกันได้) */
  free: FreeSlot[];
  /** ข้อมูลแนะนำตัว (ตัวอย่าง) — ใช้เลือกผู้รับเคส */
  sex?: 'ชาย' | 'หญิง';
  years?: number;
  /** ดูแลเรื่องไหนเป็นพิเศษ */
  focus?: string[];
  /** avatar ที่หน่วยบริการเลือก ("avatar:t3") */
  photo?: string;
}

const R: ServiceId = 'royal';
const RC: ServiceId = 'royal+compress';
const X: ServiceId = 'relax';
const C: ServiceId = 'compress';
const F: ServiceId = 'foot';

/** ตารางเจ้าหน้าที่แต่ละหน่วยบริการ (id ตรงกับ PLACES) · skv = รพ.สต.บ้านค้อ · ari = โรงพยาบาลน้ำพอง · spa = โรงพยาบาลขอนแก่น */
// skv = หน่วยบริการที่เชื่อมหลังบ้าน (HOSxP): ใช้เมื่อยังไม่ได้เวลาว่างจริงจาก cloud
export const THERAPIST_SCHEDULE: Record<string, Therapist[]> = {
  skv: [
    { id: 't2', name: 'พท.ป. วิภาวดี ใจงาม', role: 'แพทย์แผนไทย', sex: 'หญิง', years: 8, focus: ['รับส่งต่อหมอพื้นบ้าน', 'ปวดเอว ปวดหลัง'], free: [{ day: 0, time: '15:30', services: [R, RC] }, { day: 1, time: '13:00', services: [R, C] }, { day: 1, time: '15:00', services: [RC] }, { day: 3, time: '10:30', services: [R, X] }] },
    { id: 't6', name: 'พท.ป. ปิยะพงษ์ รุ่งเรือง', role: 'แพทย์แผนไทย', sex: 'ชาย', years: 12, focus: ['ฟื้นฟูอัมพฤกษ์', 'ข้อเข่า'], free: [{ day: 0, time: '17:00', services: [RC] }, { day: 2, time: '09:00', services: [R, RC] }, { day: 4, time: '14:00', services: [R] }] },
    { id: 't1', name: 'อสม. สมชาย บุญมา', role: 'หมอนวด', sex: 'ชาย', years: 2, focus: ['ติดตามคนไข้ที่บ้าน'], free: [{ day: 0, time: '13:00', services: [X, F] }, { day: 1, time: '17:00', services: [X] }, { day: 2, time: '10:30', services: [X, F] }] },
  ],
  ari: [
    { id: 'pim', name: 'พท.ป. พิมพ์ชนก แสงดี', role: 'แพทย์แผนไทย', sex: 'หญิง', years: 6, focus: ['แพทย์แผนไทย รพ.น้ำพอง', 'กระดูกและข้อ'], free: [{ day: 1, time: '10:30', services: [R, RC] }, { day: 3, time: '13:00', services: [X] }, { day: 5, time: '13:00', services: [R] }] },
    { id: 'chai', name: 'พยาบาลชัยวัฒน์ ดีมาก', role: 'หมอนวด', sex: 'ชาย', years: 4, focus: ['งานส่งต่อ รพ.น้ำพอง'], free: [{ day: 0, time: '17:00', services: [X, F] }, { day: 2, time: '15:00', services: [X] }] },
  ],
  // โรงพยาบาลขอนแก่น: ศูนย์ส่งต่อ (ส่งเคสฟื้นฟูมาหาหมอพื้นบ้าน)
  spa: [
    { id: 'noi', name: 'พยาบาลน้อย ใจเย็น', role: 'หมอนวด', sex: 'หญิง', years: 9, focus: ['ศูนย์ส่งต่อ รพ.ขอนแก่น', 'ฟื้นฟูหลอดเลือดสมอง'], free: [{ day: 0, time: '14:00', services: [X, F] }, { day: 1, time: '11:00', services: [X, F] }] },
  ],
};

/* ---------- ตารางจริงจากหลังบ้าน (ต้นแบบ) ----------
 * หลังบ้าน MohbanHealth เปิดอยู่ในเบราว์เซอร์เดียวกัน → หน่วยบริการที่เชื่อมหลังบ้านใช้เจ้าหน้าที่/เวลาว่างจริง
 * (เข้าเวร · รับกรรมวิธีนั้น · ยังไม่มีคิว) แทนตารางตัวอย่าง → นัดตรงกับรอบของหน่วยบริการ อนุมัติได้ทันที */
/** หน่วยบริการในแอปที่เชื่อมหลังบ้าน (รพ.สต.บ้านค้อ) */
export const BRIDGE_PLACE = 'skv';
const SVC_OF: Record<string, ServiceId> = { s1: 'relax', s2: 'royal', s3: 'compress', s4: 'foot', s5: 'royal+compress' };
let liveCache: { raw: string; list: Therapist[] } | null = null;
export function liveTherapists(): Therapist[] | null {
  if (!clinicOnline()) return null;
  const raw = availabilityRaw();
  if (!raw) return null;
  if (liveCache?.raw === raw) return liveCache.list;
  try {
    const a = JSON.parse(raw) as Availability;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byId = new Map<string, Therapist>(
      a.therapists.map((t) => [t.id, { id: t.id, name: t.name, role: /นักศึกษา/.test(t.role) || !/แพทย์/.test(t.role) ? 'หมอนวด' : 'แพทย์แผนไทย', photo: t.photo, free: [] }]),
    );
    for (const [date, times] of Object.entries(a.days)) {
      const [y, m, d] = date.split('-').map(Number);
      const day = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
      for (const [time, svcs] of Object.entries(times))
        for (const [code, ids] of Object.entries(svcs))
          for (const id of ids) {
            const t = byId.get(id);
            if (!t || !SVC_OF[code]) continue;
            const slot = t.free.find((f) => f.day === day && f.time === time);
            if (slot) slot.services.push(SVC_OF[code]);
            else t.free.push({ day, time, services: [SVC_OF[code]] });
          }
    }
    const list = [...byId.values()].filter((t) => t.free.length);
    liveCache = { raw, list };
    return list;
  } catch {
    return null;
  }
}

/** ช่วงว่างของผู้ให้บริการที่รับบริการนั้น (ไม่ระบุบริการ = ทุกช่วง) เรียงตามเวลา */
export const freeFor = (t: Therapist, service?: ServiceId | null) =>
  t.free.filter((f) => !service || f.services.includes(service)).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** offset วัน → ป้ายวัน (วันนี้ / พรุ่งนี้ / ศ. 9 ต.ค.) */
export const dayLabel = (offset: number) => {
  if (offset === 0) return 'วันนี้';
  if (offset === 1) return 'พรุ่งนี้';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
};

export interface Urgency {
  /** ควรรักษาภายในกี่วัน (null = ไม่เร่ง) */
  withinDays: number | null;
  label: string;
  reason: string;
}

export function urgencyOf(a: { pain: number; duration?: string; radiate?: string }, safety: 'green' | 'amber' | 'red'): Urgency {
  const radiating = !!a.radiate && a.radiate !== 'ไม่ร้าว';
  if (a.pain >= 7 || safety === 'amber' || radiating) {
    const why = [a.pain >= 7 ? `ปวด ${a.pain}/10` : '', radiating ? 'มีอาการร้าว' : '', safety === 'amber' ? 'มีข้อควรระวัง' : ''].filter(Boolean).join(' ');
    return { withinDays: 2, label: 'ควรรักษาภายใน 2 วัน', reason: why };
  }
  const recent = !!a.duration && /วันนี้|2–3 วัน|1 สัปดาห์/.test(a.duration);
  if (a.pain >= 4 || recent) return { withinDays: 7, label: 'ควรรักษาภายในสัปดาห์นี้', reason: [a.pain >= 4 ? `ปวด ${a.pain}/10` : '', recent ? 'เพิ่งเป็น' : ''].filter(Boolean).join(' ') };
  return { withinDays: null, label: 'นัดวันที่สะดวกได้เลย', reason: 'อาการไม่รุนแรง' };
}

/** ผู้ให้บริการของสถานที่ เรียง: แพทย์แผนไทยก่อน (นวดเพื่อรักษา) → ว่างเร็วสุด */
/** service = เฉพาะคนที่ลงตารางรับบริการนั้นไว้ (และ free เหลือเฉพาะช่วงที่รับบริการนั้น) */
export function therapistsAt(placeId: string, service?: ServiceId | null) {
  // คลินิกที่เชื่อมหลังบ้าน (และหลังบ้านเปิดอยู่) → ตารางจริง
  const live = placeId === BRIDGE_PLACE ? liveTherapists() : null;
  // ใช้งานจริง (cloud): คลินิกที่เชื่อมระบบแสดงเฉพาะเวลาว่างจริงของคลินิก — ยังไม่มี = ยังไม่เปิดรับจองในแอป (ไม่ใช้ตารางสมมติ)
  if (placeId === BRIDGE_PLACE && !live && isCloud()) return [];
  // สถานที่อื่นยังไม่ได้เชื่อมระบบ → ยังจองผ่านแอปไม่ได้ (แสดงในแผนที่/นำทางได้)
  if (placeId !== BRIDGE_PLACE && isCloud()) return [];
  return (live ?? THERAPIST_SCHEDULE[placeId] ?? [])
    .map((t) => ({ ...t, free: freeFor(t, service) }))
    .filter((t) => !service || t.free.length)
    .sort((a, b) => (a.role === b.role ? Math.min(...a.free.map((f) => f.day)) - Math.min(...b.free.map((f) => f.day)) : a.role === 'แพทย์แผนไทย' ? -1 : 1));
}

/** ไม่ระบุแพทย์: รวมช่วงว่างของทุกคนที่รับบริการนั้น (เวลาซ้ำกันนับครั้งเดียว) · who = คนที่ว่างช่วงนั้น เรียงแพทย์แผนไทยก่อน */
export function anyoneSlots(placeId: string, service?: ServiceId | null) {
  const map = new Map<string, FreeSlot & { who: Therapist[] }>();
  for (const t of therapistsAt(placeId, service))
    for (const f of t.free) {
      const k = `${f.day}|${f.time}`;
      const cur = map.get(k);
      if (cur) cur.who.push(t);
      else map.set(k, { ...f, who: [t] });
    }
  return [...map.values()].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

/** เวลาว่างของผู้ให้บริการ เป็นป้าย "พรุ่งนี้ 13:00" · ช่องแรกที่ทันตามความเร่งด่วน = แนะนำ */
export function slotsOf(t: Therapist, u: Urgency) {
  const sorted = [...t.free].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  const inTime = sorted.filter((f) => u.withinDays === null || f.day <= u.withinDays);
  return { labels: sorted.map((f) => `${dayLabel(f.day)} ${f.time}`), recommended: inTime[0] ? `${dayLabel(inTime[0].day)} ${inTime[0].time}` : null };
}
