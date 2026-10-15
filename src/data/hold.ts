import { RULES } from '../services/safetyEngine';

/**
 * ผลประเมินพบข้อห้าม/สัญญาณอันตราย → คนไข้เรื่องนี้ "พักไว้" (ไม่ใช่ทางตัน): บอกหมอว่าทำอะไรต่อ (ส่งต่อ/พัก) · ติดตามให้ · หายแล้วกลับมารักษาได้
 * ประเภทมาจากสิ่งที่กฎคัดกรองให้ทำ (action ของกฎ ตามเอกสารอ้างอิง) — ไม่ตั้งเกณฑ์เอง
 *   emergency = กฎสั่งหยุดทันที / 1669 · doctor = กฎสั่งส่งต่อ/ปรึกษา/พบแพทย์ · heal = กฎสั่งงดนวดจนหาย (ไม่ได้ระบุแพทย์)
 * ไม่รู้จักกฎ → doctor (ปลอดภัยที่สุด)
 */
export type HoldKind = 'emergency' | 'doctor' | 'heal';
export interface Hold {
  kind: HoldKind;
  /** ข้อห้ามที่ทำให้พักไว้ (ชื่อสั้น) */
  reasons: string[];
  /** วันที่พัก · วันที่จะถามอีกครั้ง (ISO yyyy-mm-dd) */
  since: string;
  recheck: string;
}

/** ข้อห้ามจากแชท (ไม่ได้อยู่ใน RULES) → ประเภทตามที่ข้อนั้นบอกให้ทำ */
const EXTRA: Record<string, HoldKind> = {
  'RF-NERVE': 'doctor', // อาการทางเส้นประสาท ควรพบแพทย์ก่อน (CPG หน้า 139)
  'RF-WEAK': 'doctor',
  'RF-INFECT': 'heal', // โรคติดต่อ ควรรอหายก่อนนวด
};
const RANK: HoldKind[] = ['heal', 'doctor', 'emergency'];
/** วันถามอีกครั้ง (ค่าเริ่มต้นของแอป ไม่ใช่เกณฑ์ทางการแพทย์) · ฉุกเฉิน = ถามวันถัดไป */
export const HOLD_DAYS: Record<HoldKind, number> = { emergency: 1, doctor: 7, heal: 3 };

export function holdKindOf(ruleId: string): HoldKind {
  if (EXTRA[ruleId]) return EXTRA[ruleId];
  const r = RULES.find((x) => x.id === ruleId);
  if (!r) return 'doctor';
  if (/1669|ทันที|ฉุกเฉิน/.test(r.action)) return 'emergency';
  if (/แพทย์/.test(r.action)) return 'doctor';
  return 'heal';
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDaysISO = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return iso(d);
};
export const todayISOLocal = () => iso(new Date());

/** ข้อห้ามระดับแดงของผลประเมิน → พักไว้ (ประเภทที่หนักที่สุด) */
export function holdOf(hits: { id: string; title: string }[]): Hold | undefined {
  const red = hits.filter((h) => h.id.startsWith('RF-'));
  if (!red.length) return undefined;
  const kind = red.map((h) => holdKindOf(h.id)).reduce((a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a));
  return { kind, reasons: [...new Set(red.map((h) => h.title))], since: todayISOLocal(), recheck: addDaysISO(HOLD_DAYS[kind]) };
}

/** ข้อความของการ์ดพักไว้ */
export const HOLD_TEXT: Record<HoldKind, { title: string; todo: string; back: string; again: string }> = {
  emergency: { title: 'ส่งต่อโรงพยาบาลทันที', todo: 'ส่งคนไข้ไปโรงพยาบาลหรือโทร 1669 ทันที', back: 'แพทย์ตรวจแล้ว ค่อยประเมินใหม่', again: 'แพทย์ตรวจแล้ว ประเมินใหม่' },
  doctor: { title: 'ส่งต่อ รพ.สต. ก่อน', todo: 'ส่งต่อให้แพทย์ตรวจก่อน', back: 'แพทย์ตรวจแล้วอาการดีขึ้น ประเมินใหม่ได้', again: 'แพทย์ตรวจแล้ว ประเมินใหม่' },
  heal: { title: 'ให้คนไข้พักก่อน', todo: 'ให้คนไข้พักให้หายก่อน', back: 'หายแล้วประเมินใหม่ กลับมารักษาได้', again: 'หายแล้ว ประเมินใหม่' },
};
