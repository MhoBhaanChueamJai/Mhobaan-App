/**
 * AI INTERVIEW (MOCK) — ตาม Concept Paper ข้อ 4.1 NLP
 * ------------------------------------------------------------------
 * แปลงคำเล่าของหมอ เช่น "ป้าปวดเอวข้างซ้ายมาสามวัน" → structured entities
 * ใน production: เรียก LLM (structured output / tool use) + validation schema
 * Prototype นี้ใช้ keyword matching เพื่อสาธิต UX เท่านั้น
 */
import type { RegionId } from '../design-system/components/BodyMap';

export interface ExtractedComplaint {
  regions: RegionId[];
  side?: 'ขวา' | 'ซ้าย' | 'ทั้งสองข้าง';
  durationDays?: number;
  severity?: number;
  triggers: string[];
  quality: string[];
}

const THAI_NUM: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };

export function parseComplaint(text: string): ExtractedComplaint {
  const t = text.replace(/\s+/g, '');
  const side = /ทั้งสองข้าง|สองข้าง/.test(t) ? 'ทั้งสองข้าง' : /ขวา/.test(t) ? 'ขวา' : /ซ้าย/.test(t) ? 'ซ้าย' : undefined;
  const sfx = side === 'ซ้าย' ? '_l' : '_r';
  const regions = new Set<RegionId>();
  if (/คอ(?!ม)/.test(t)) regions.add('neck'); // กัน "คอม(พิวเตอร์)"
  if (/บ่า|ไหล่/.test(t)) {
    if (side === 'ทั้งสองข้าง') {
      regions.add('shoulder_r');
      regions.add('shoulder_l');
    } else regions.add(`shoulder${sfx}` as RegionId);
  }
  if (/สะบัก|หลังส่วนบน|หลังบน/.test(t)) regions.add('upper_back');
  if (/เอว|หลังส่วนล่าง|หลังล่าง|ปวดหลัง/.test(t)) regions.add('lower_back');
  if (/ศีรษะ|หัว/.test(t)) regions.add('head');
  if (/เข่า/.test(t)) regions.add(`knee${sfx}` as RegionId);
  if (/น่อง/.test(t)) regions.add(`calf${sfx}` as RegionId);
  if (/แขน/.test(t)) regions.add(`arm${sfx}` as RegionId);

  let durationDays: number | undefined;
  const m = t.match(/(\d+|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)(วัน|สัปดาห์|อาทิตย์|เดือน)/);
  if (m) {
    const n = /\d+/.test(m[1]) ? parseInt(m[1], 10) : THAI_NUM[m[1]];
    durationDays = m[2] === 'วัน' ? n : m[2] === 'เดือน' ? n * 30 : n * 7;
  }

  let severity: number | undefined;
  const s = t.match(/(\d+)(เต็ม|\/)10/) ?? t.match(/ระดับ(\d+)/);
  if (s) severity = parseInt(s[1], 10);
  else if (/ปวดมาก|ทรมาน/.test(t)) severity = 7;
  else if (/ปวดนิดหน่อย|เล็กน้อย/.test(t)) severity = 3;

  const triggers = [
    /คอม|หน้าจอ|โน้ตบุ๊ก/.test(t) && 'ใช้คอมพิวเตอร์นาน',
    /นั่งนาน|นั่งทำงาน/.test(t) && 'นั่งนาน',
    /ยกของ/.test(t) && 'ยกของหนัก',
    /มือถือ|โทรศัพท์/.test(t) && 'ก้มดูมือถือ',
    /นอนตกหมอน|ตื่นมา/.test(t) && 'ท่านอน',
  ].filter(Boolean) as string[];

  const quality = [/ตึง/.test(t) && 'ตึง', /ร้าว/.test(t) && 'ปวดร้าว', /ชา/.test(t) && 'ชา', /แปล๊บ|จี๊ด/.test(t) && 'ปวดแปล๊บ'].filter(Boolean) as string[];

  return { regions: [...regions], side, durationDays, severity, triggers, quality };
}

/**
 * บทสัมภาษณ์แบบ adaptive: ถามเฉพาะสิ่งที่ยัง "ขาด" (Tesler's Law — ระบบรับความซับซ้อนแทนผู้ใช้)
 * แต่ละข้อมี quick replies ≤ 4 ตัวเลือก (Hick's Law)
 */
export interface InterviewTurn {
  id: string;
  ask: string;
  quickReplies: string[];
  /** ข้ามคำถามนี้ถ้าได้ข้อมูลแล้ว */
  skipIf?: (c: ExtractedComplaint) => boolean;
}

export const INTERVIEW_SCRIPT: InterviewTurn[] = [
  {
    id: 'chief',
    ask: 'สวัสดีค่ะพ่อหมอ วันนี้คนไข้มาด้วยอาการอะไรคะ? เล่าเป็นภาษาถิ่นหรือพิมพ์ได้ตามสะดวกเลยค่ะ',
    quickReplies: ['ปวดเอว/เส้นตึง', 'ข้อเท้าแพลง', 'แขนขาอ่อนแรง', 'ปวดเมื่อยทั้งตัว'],
  },
  {
    id: 'duration',
    ask: 'คนไข้เป็นมานานเท่าไหร่แล้วคะ?',
    quickReplies: ['1–3 วัน', '1 สัปดาห์', '> 1 เดือน', 'เป็น ๆ หาย ๆ'],
    skipIf: (c) => c.durationDays !== undefined,
  },
  {
    id: 'severity',
    ask: 'ระดับอาการของคนไข้ 0–10 ตอนนี้ประมาณเท่าไหร่คะ?',
    quickReplies: ['3', '5', '6', '8'],
    skipIf: (c) => c.severity !== undefined,
  },
  {
    id: 'redflag',
    ask: 'ขอเช็กสัญญาณอันตรายนะคะ คนไข้มีชาหรืออ่อนแรงทันที เจ็บแน่นหน้าอก ไข้สูง หรือถูกงูกัดไหมคะ?',
    quickReplies: ['ไม่มีเลย', 'มีชาเล็กน้อย', 'มีไข้สูง', 'ไม่แน่ใจ'],
  },
  {
    id: 'goal',
    ask: 'ครั้งนี้พ่อหมอรักษาด้วยกรรมวิธีไหนคะ?',
    quickReplies: ['นวดเส้น', 'ประคบปูเลย', 'ยาพอก', 'ยาต้ม'],
  },
];
