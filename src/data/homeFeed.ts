import { holdOf } from './hold';
/**
 * HOME FEED — ข้อมูลที่หน้าแรกแสดง "หลังจากคุยกับ AI และผ่านการคัดกรอง/วิเคราะห์แล้ว"
 * ------------------------------------------------------------------
 * แนวคิด: หน้าแรก = ห้องแชทกับหมอบ้าน AI ที่ช่วยหมอพื้นบ้านตั้งแต่รับเรื่องคนไข้ → ตรวจสัญญาณอันตราย → บันทึก ม.บ.5
 *         → นัดติดตาม → รักษา → ติดตามอาการ / ส่งต่อโรงพยาบาล ทุกขั้นจัดการจากหน้าเดียว
 * ข้อมูลแต่ละก้อนระบุ "มาจากไหน" (source) และ "ใครยืนยัน" (confirmedBy) เพื่อความโปร่งใส
 * ⚠️ ยังไม่เชื่อม AI จริง — เป็นข้อมูลตัวอย่างเพื่อแสดง concept
 */

import type { BodyPin, BodyPoint } from '../design-system/components/Body3D';
import { guideFor } from './treatmentGuides';
import { MB5_ASK, SCRIBE_LABEL, type Mb5Flag, type Mb5Record, type Mb5Step } from './mb5';

export type JourneyStage = 'screening' | 'safety' | 'booked' | 'service' | 'followup';

export const STAGES: { key: JourneyStage; label: string }[] = [
  { key: 'screening', label: 'คัดกรอง' },
  { key: 'safety', label: 'ปลอดภัย' },
  { key: 'booked', label: 'นัดหมาย' },
  { key: 'service', label: 'รักษา' },
  { key: 'followup', label: 'ติดตามผล' },
];

/** แหล่งที่มาของข้อมูลแต่ละก้อน */
export type InsightSource = 'AI Interview' | 'Safety Rule Engine' | 'แบบประเมินธาตุ' | 'ผู้ให้บริการ' | 'ระบบนัดหมาย' | 'Follow-up' | 'Knowledge Hub';

export type ThreadCard =
  | { type: 'outcome'; before: number; after: number; plan: string; date: string }
  | { type: 'followup'; question: string; options: string[]; answer?: string }
  | { type: 'screening'; complaint: string; areas: string[]; duration: string; pain: number; triggers: string[]; related: string[] }
  | { type: 'safety'; level: 'green' | 'amber' | 'red'; items: { id: string; title: string; evidence: string; source: string }[] }
  | { type: 'element' }
  | { type: 'plan'; title: string; by: string; approved: boolean; adjustments: string[]; points: string[] }
  | { type: 'appointment'; time: string; place: string; queue?: string; waitMin?: number; /** นัดที่จองไว้ (ไม่ใช่วันนี้) */ date?: string; therapist?: string; service?: string; /** นัดของเรื่องไหน (เช็กอิน/เลื่อนนัดของเรื่องนั้น) */ caseId?: string; draftId?: string; /** บริการที่จองไม่ตรงผลประเมิน → เตือน + ปุ่มเปลี่ยนบริการ */ warn?: string }
  | { type: 'selfcare'; name: string; dosage: string; streak: number }
  | { type: 'guideline'; condition?: string; methods: string[]; points: string[]; pins?: BodyPin[]; caution?: string; ref: string; /** จองไว้แล้ว → ไม่เสนอให้จองอีก */ booked?: boolean; /** หลายบริเวณ (แรก = บริเวณหลัก) */ areas?: { symptom: string; region?: string; symptoms?: string[]; condition: string; points: string[] }[] }
  /** ขั้นต่อไปหลังประเมิน: นัดคนไข้มารักษา (หรือส่งต่อโรงพยาบาลถ้ามีสัญญาณอันตราย) */
  | { type: 'book'; service: string; red: boolean }
  /** หน้าแรกแบบแชท (ยังไม่มีข้อมูล): คำถามแนะนำว่าสนใจเรื่องอะไร */
  | { type: 'intents'; options: string[] }
  /** ประเมินซ้ำ: ข้อมูลชุดเดิมให้แตะแก้ทีละข้อ แล้วยืนยัน */
  | { type: 'review' }
  /** ติดตามผลหลังรักษาในแชท: ถามคะแนนปวดทีละจุด (บังคับก่อนคุยเรื่องอื่น) */
  | { type: 'fuAsk'; sessionId: string; pin: string; label: string; before: number }
  /** ติดตามผล: อาการผิดปกติหลังนวด */
  | { type: 'fuAdverse' }
  /** ก่อนนวดครั้งถัดไป: มีข้อห้ามใหม่ไหม */
  | { type: 'fuRisk' }
  /** บริการที่จองไม่ตรงผลประเมิน → ถามผู้ใช้ว่าจะเปลี่ยนตามคำแนะนำหรือใช้แผนเดิม (ไม่บังคับ) */
  | { type: 'planChoice'; draftId: string; clinic: string }
  /** จองกับ AI ในแชท: สถานที่ที่แนะนำ → เวลาว่าง → ยืนยัน */
  | { type: 'placePick'; options: { id: string; name: string; km: number; reason: string; slot: string }[] }
  | { type: 'therapistPick'; placeId: string; /** บริการที่จอง → แสดงเฉพาะคนที่ลงตารางรับบริการนี้ */ service?: 'royal' | 'royal+compress' | 'relax' | 'compress' | 'foot'; options: { id: string; name: string; role: string; next: string; recommended: boolean }[] }
  | { type: 'slotPick'; placeId: string; therapistId: string; options: string[] }
  | { type: 'bookConfirm'; placeId: string; therapistId: string; name: string; day: string; time: string; service: string; therapist: string; topic: string }
  /** อาการยังไม่ดีขึ้น → ถามว่าตรงไหนยังปวด (ให้ผู้ให้บริการเน้น) */
  | { type: 'fuWhere'; options: string[] }
  /** ถามยืนยันก่อนทำต่อ (เช่น ร้องเรียน/อาการแย่ลง → แจ้งคลินิกไหม) · payload = ข้อความเดิมของผู้ใช้ */
  | { type: 'choice'; kind: 'complaint'; options: string[]; payload: string }
  /** สรุปประวัติการรักษาของเรื่องหนึ่งแบบ bento ในแชท */
  | { type: 'history'; caseId: string }
  /** ปุ่มทำต่อในคำตอบของ AI */
  /** อ้างอิงจากคลังความรู้ (knowledge hub) — แตะเพื่อดูข้อความต้นฉบับ */
  | { type: 'sources'; refs: { f: string; p: number; quote: string }[] }
  /** ทะเบียนการรักษา ม.บ.5 ที่ AI เติมจากเสียงหมอ (+ สัญญาณอันตราย) */
  | { type: 'mb5'; rec: Mb5Record; flags: Mb5Flag[]; by: 'ai' | 'local' }
  /** ถามช่อง ม.บ.5 ที่ยังขาด (ตอบด้วยเสียงหรือแตะตัวเลือก) */
  | { type: 'mb5ask'; step: Mb5Step; options: string[] }
  /** สรุปบันทึก ม.บ.5 จาก AI (ข้อมูลแรกรับ + คลังความรู้) */
  | {
      type: 'massagePlan';
      intake: [string, string][];
      plan: { summary: string; cautions: string[]; style: string; minutes: string; phases: { title: string; minutes: string; steps: string[] }[]; aftercare: string[] };
      refs: { f: string; p: number; quote: string }[];
    }
  /** ผลประเมินก่อนนวดครั้งถัดไป: วันนี้เป็นอย่างไร + ครั้งนี้จะรักษาอย่างไร · focus = บริเวณที่ยังปวด (ให้เน้น) */
  | { type: 'preResult'; caseId: string; focus?: string }
  | { type: 'action'; label: string; to: 'Booking' | 'ElementQuiz' | 'History' | 'Places' | 'RedFlag' | 'SelfCare' | 'assess' | 'CallClinic' | 'CheckIn' };

/* ---------- การประเมินอาการในแชท ----------
 * ทุกหัวข้อประเมินเป็นคำถามจาก AI ในแชท (ตอบด้วย chip / กราฟ / ปุ่มในบับเบิล)
 * ครบทุกข้อแล้ว AI จึงสรุปและแสดง "แนวทางการรักษา & จุดกดบำบัด"
 */
export type AssessStep = 'idle' | 'review' | 'topic' | 'symptoms' | 'related' | 'pain' | 'duration' | 'cause' | 'health' | 'meds' | 'allergy' | 'risk' | 'pressure' | 'avoid' | 'radiate' | 'done';
/**
 * ลำดับคำถาม — ครบตามการประเมินแรกรับ (เกณฑ์มาตรฐานฯ หน้า 33):
 * อาการ → อาการร่วม (red flag) → ความปวด → ระยะเวลา → มูลเหตุ (มูลเหตุเกิดโรค 8 ประการ) → โรคประจำตัว/ยา (ข้อห้าม + ปฏิกิริยาสมุนไพร–ยา)
 */
// + ข้อห้ามช่วงนี้ (ผ่าตัด บาดเจ็บ ไข้ ตั้งครรภ์ แผล: ตำราอ้างอิงฯ หน้า 391, CPG หน้า 139) → แรงนวดที่ชอบ (ใช้วางแผนการนวด)
// อาการร้าว: ถามต่อจากอาการเฉพาะเมื่ออาการนั้นมีรูปแบบการร้าว (data/radiation.ts)
// + บริเวณที่ไม่ต้องการให้นวด (แบบประเมินก่อนรับบริการของหลังบ้าน: avoidAreas)
export const ASSESS_ORDER: Exclude<AssessStep, 'done'>[] = ['topic', 'symptoms', 'radiate', 'related', 'pain', 'duration', 'cause', 'health', 'meds', 'allergy', 'risk', 'pressure', 'avoid'];

export const ASSESS_ASK: Record<Exclude<AssessStep, 'done'>, { label: string; text: string }> = {
  idle: { label: '', text: '' },
  review: { label: '', text: '' },
  topic: { label: 'เรื่อง', text: 'คนไข้เรื่องเดิม หรืออาการใหม่คะ?' },
  symptoms: { label: 'อาการ', text: 'คนไข้ปวดตรงไหนบ้างคะ เลือกได้หลายที่ หรือแตะบนหุ่นได้เลยค่ะ' },
  radiate: { label: 'อาการร้าว', text: 'ร้าวไปที่อื่นไหมคะ?' },
  related: { label: 'อาการร่วม', text: 'คนไข้มีอาการเหล่านี้ร่วมด้วยไหมคะ?' },
  pain: { label: 'ความปวด', text: 'คนไข้ปวดระดับไหนคะ? 0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด' },
  duration: { label: 'ระยะเวลา', text: 'คนไข้เป็นมานานแค่ไหนแล้วคะ?' },
  cause: { label: 'สาเหตุ', text: 'น่าจะเป็นเพราะอะไรคะ? (มูลเหตุ)' },
  health: { label: 'โรคประจำตัว', text: 'คนไข้มีโรคประจำตัวไหมคะ? เลือกได้หลายข้อ หรือพิมพ์บอกได้ค่ะ' },
  meds: { label: 'ยาที่ใช้ประจำ', text: 'คนไข้กินยาประจำไหมคะ? เลือกได้หลายข้อ หรือพิมพ์ชื่อยาได้ค่ะ' },
  allergy: { label: 'การแพ้', text: 'คนไข้แพ้ยาหรือสมุนไพรไหมคะ? เลือกได้หลายข้อ หรือพิมพ์บอกได้ค่ะ' },
  risk: { label: 'สัญญาณอันตราย', text: 'คนไข้มีข้อไหนต่อไปนี้ไหมคะ? ถ้ามี อาจต้องส่งต่อโรงพยาบาลค่ะ' },
  pressure: { label: 'แรงนวดเส้น', text: 'จะนวดเส้นแรงแบบไหนคะ?' },
  avoid: { label: 'ห้ามนวด', text: 'มีบริเวณไหนที่ห้ามนวดหรือห้ามใช้ความร้อนไหมคะ?' },
};
/** บริเวณที่ไม่ต้องการให้นวด (ส่งเป็น avoidAreas ในแบบประเมินก่อนรับบริการ) */
export const AVOID_OPTIONS = ['ไม่มี', 'ศีรษะ/ใบหน้า', 'คอ', 'ท้อง', 'หลัง', 'ขา/เท้า'];
/** ข้อห้าม/ข้อควรระวังช่วงนี้ → safetyEngine (ตำราอ้างอิงฯ หน้า 391 · CPG หน้า 139) */
// + ประจำเดือน (งดนวดท้อง) · โรคติดต่อ (เลื่อนนัด) — ตามแบบคัดกรองของหลังบ้าน MohbanHealth
export const RISK_OPTIONS = ['ผ่าตัดภายใน 1 เดือน', 'บาดเจ็บภายใน 2 วัน', 'มีไข้', 'ตั้งครรภ์', 'มีแผลหรือผื่นตรงที่ปวด', 'มีประจำเดือน', 'โรคติดต่อ', 'ไม่มี'];
export const PRESSURE_OPTIONS = ['เบา', 'ปานกลาง', 'หนัก', 'ให้หมอเลือกตามอาการ'];
/** มูลเหตุเกิดโรค 8 ประการ (เกณฑ์มาตรฐานฯ หน้า 33) — ภาษาที่คนทั่วไปเข้าใจ */
export const CAUSE_OPTIONS = ['ก้มดำนา/นั่งนาน', 'ยกของหนัก ทำงานหนัก', 'ล้ม/กระแทก', 'อดนอน เครียด', 'อากาศร้อน/เย็น', 'กินผิดสำแดง', 'ไม่แน่ใจ'];
/** โรคประจำตัว/ยาที่มีผลต่อการนวด (CPG หน้า 139 · ตำราอ้างอิงฯ หน้า 391, 401, 490) — ชื่อตรงกับกฎใน safetyEngine และหน้าโปรไฟล์ */
export const HEALTH_OPTIONS = ['ไม่มี', 'ความดันโลหิตสูง', 'เบาหวาน', 'โรคหัวใจ', 'หอบหืด', 'กระดูกพรุน'];
export const MED_OPTIONS = ['ไม่มี', 'ยาลดความดัน', 'ยาเบาหวาน', 'ยาละลายลิ่มเลือด', 'ยาแก้ปวด'];
/** การแพ้ (หลังบ้าน: ข้อ "การแพ้") — ตัวเลือกเบื้องต้น พิมพ์บอกเองได้ */
export const ALLERGY_OPTIONS = ['ไม่มี', 'แพ้ยา', 'แพ้สมุนไพร', 'แพ้น้ำมันนวด', 'แพ้อาหาร'];
export const DURATION_OPTIONS = ['วันนี้', '2–3 วัน', '1 สัปดาห์', 'เกิน 1 เดือน'];

export interface Assessment {
  step: AssessStep;
  /** อาการที่เลือก = mark บนหุ่น · null = เลือกจาก chip (ใช้ตำแหน่งมาตรฐาน) · จุด[] = แตะบนหุ่น */
  sel: Record<string, BodyPoint[] | null>;
  /** chip ที่เกิดจากการแตะหุ่น (ส่วนที่ไม่มีใน chip มาตรฐาน) */
  extra: string[];
  pain: number;
  duration?: string;
  cause?: string;
  health?: string;
  /** ยาที่ใช้ประจำ (คั่นด้วย ·) */
  meds?: string;
  /** สิ่งที่แพ้ (คั่นด้วย ·) */
  allergy?: string;
  /** ปวดร้าวไปไหน (data/radiation.ts) */
  radiate?: string;
  /** ข้อห้ามช่วงนี้ (RISK_OPTIONS) */
  risk?: string;
  /** แรงนวดที่ชอบ */
  pressure?: string;
  /** บริเวณที่ไม่ต้องการให้นวด */
  avoid?: string;
  /** ถามก่อนเริ่มเมื่อมีใบอยู่แล้ว: ชื่อใบเดิม หรือ NEW_TOPIC */
  topic?: string;
  /** ประเมินซ้ำเรื่องเดิม: ใช้คำตอบโรคประจำตัวชุดเดิม (ข้ามข้อนี้) */
  reuseHealth?: string;
  reuseMeds?: string;
  reuseAllergy?: string;
  /** กำลังแก้ข้อเดียวจากข้อมูลชุดเดิม → ตอบแล้วกลับไปหน้าทบทวน (ไม่ถามข้อถัดไป) */
  editing?: boolean;
}
export const NEW_TOPIC = 'อาการใหม่';

export const blankAssessment = (): Assessment => ({ step: 'symptoms', sel: {}, extra: [], pain: 0 });

export interface ThreadItem {
  id: string;
  day: 'last' | 'today';
  from: 'ai' | 'user';
  text?: string;
  card?: ThreadCard;
  source?: InsightSource;
  confirmedBy?: string;
  time: string;
  /** สถานะการคิดของ AI ก่อนตอบ (แสดงด้วย LatticeLoader) · elapsed = วินาทีที่ใช้คิด */
  thinking?: 'working' | 'done';
  elapsed?: number;
  /** คำตอบความปวดของผู้ใช้ → แสดงเป็นการ์ด Pain Score แทนบับเบิลข้อความ */
  pain?: number;
  /** ข้อความนี้เป็นคำถามประเมินหัวข้อใด (แสดงตัวเลือกให้ตอบเมื่อถึงหัวข้อนั้น) */
  ask?: Exclude<AssessStep, 'done'>;
}

/** สถานะปัจจุบันของผู้ใช้ (ตัวอย่าง: วันนัดรับบริการ ครั้งที่ 4) — index ใน STAGES */
export const HOME_SNAPSHOT = {
  stage: 2,
  /** คำแนะนำเหนือช่องแชท */
  suggestions: ['เล่าอาการคนไข้', 'ผลก่อน–หลัง', 'นัดติดตาม', 'ส่งต่อ รพ.'],
};

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const askItem = (step: Exclude<AssessStep, 'done'>, lead?: string, text = ASSESS_ASK[step].text): ThreadItem => ({
  id: `ask-${step}-${Date.now()}`,
  day: 'today',
  from: 'ai',
  text: lead ? `${lead} ${text}` : text,
  source: 'AI Interview',
  time: nowTime(),
  ask: step,
});

/** ผลหลังประเมินครบ — สรุปอาการ · ตรวจความปลอดภัย · แนวทางการรักษา & จุดกดบำบัด (+ นัดหมาย ถ้าอยู่ในเส้นทางการดูแล) */
/** ผลตรวจความปลอดภัยที่ส่งเข้าแชท — คำนวณจาก safetyEngine ตัวเดียวกับหน้ารายละเอียด/ผู้ให้บริการ */
export interface ChatSafety {
  level: 'green' | 'amber' | 'red';
  items: { id: string; title: string; evidence: string; source: string }[];
  /** ข้อควรระวังแบบสั้นสำหรับการ์ดแนวทางการรักษา */
  caution?: string;
}
/** คำตอบหลายข้อในแชท (คั่นด้วย · หรือ ,) → รายการ · ไม่มี = [] */
export const listOfAnswer = (answer: string | undefined): string[] =>
  !answer || answer === 'ไม่มี' ? [] : answer.split(/\s*[·,]\s*/).filter(Boolean);
/** รายการ → คำตอบในแชท */
export const answerOfList = (list: string[]) => (list.length ? list.join(' · ') : 'ไม่มี');
/** ผู้ใช้เคยบอกโรคประจำตัว / ยาแล้วหรือยัง (กรอกในโปรไฟล์ หรือตอบในแชท) → ยังไม่เคย = AI ถาม */
export type HealthField = 'conditions' | 'medications' | 'allergies';
export const healthKnownOf = (p: { healthKnown?: boolean; conditionsKnown?: boolean; medicationsKnown?: boolean; allergiesKnown?: boolean }, field: HealthField) =>
  (field === 'conditions' ? p.conditionsKnown : field === 'medications' ? p.medicationsKnown : p.allergiesKnown) ?? p.healthKnown === true;
/** คำตอบ "โรคประจำตัว" + "ยาที่ใช้ประจำ" ในแชท → ข้อมูลในโปรไฟล์ (ข้อมูลสุขภาพเก็บที่เดียว) · ไม่ได้ตอบ = ใช้ของเดิม
 * รองรับคำตอบชุดเดิม (ความดันสูง · หอบหืด/ภูมิแพ้ · ยาละลายลิ่มเลือด อยู่ในข้อโรคประจำตัว) */
export const healthAnswerToProfile = (health: string | undefined, meds: string | undefined, cur: { conditions: string[]; medications: string[] }): { conditions: string[]; medications: string[] } => {
  const legacy: Record<string, string> = { ความดันสูง: 'ความดันโลหิตสูง', 'หอบหืด/ภูมิแพ้': 'หอบหืด' };
  const h = listOfAnswer(health).map((x) => legacy[x] ?? x);
  const conditions = health === undefined ? cur.conditions : h.filter((x) => x !== 'ยาละลายลิ่มเลือด');
  const medications = meds === undefined ? [...new Set([...cur.medications, ...h.filter((x) => x === 'ยาละลายลิ่มเลือด')])] : listOfAnswer(meds);
  return { conditions, medications };
};
/** ข้อควรระวังแบบสั้นต่อกฎ (ข้อความเต็มอยู่ใน safetyEngine) */
export const SHORT_CAUTION: Record<string, string> = {
  'CA-01': 'กดนวดเบา · งดอบสมุนไพร',
  'CA-08': 'ลูกประคบแค่อุ่น',
  'CA-10': 'งดอบสมุนไพร',
  'CA-09': 'กดนวดเบา',
};

export function assessmentResults(a: Assessment, symptoms: string[], related: string[], withAppointment: boolean, base: ChatSafety): ThreadItem[] {
  const t = nowTime();
  const k = Date.now();
  // อาการร่วมผิดปกติ (ตอบในแชท) = ต้องให้แพทย์ตรวจก่อน (CPG หน้า 139)
  // อาการร่วม (ปวดศีรษะ ตึงบ่าไหล่ …) ไม่ใช่ข้อห้ามนวด — CPG_PCU หน้า 139 ข้อ 2.1 รับรักษาอาการปวดศีรษะ คอ บ่า ไหล่
  // ข้อห้ามมาจาก safetyEngine/อาการร้าว/ข้อห้ามช่วงนี้เท่านั้น (ทุกข้อมีแหล่งอ้างอิง)
  const safety: ChatSafety = base;
  // แนวทางตามตำแหน่งที่ปวดจริง (knowledge hub: CPG + ตำราอ้างอิงฯ)
  const g = guideFor(symptoms, a.radiate);
  const out: ThreadItem[] = [
    {
      id: `r-scr-${k}`,
      day: 'today',
      from: 'ai',
      text: 'ครบแล้วค่ะ สรุปอาการของคนไข้',
      card: {
        type: 'screening',
        complaint: symptoms.join(' · ') || 'ไม่ระบุ',
        areas: symptoms,
        duration: a.duration ?? '-',
        pain: a.pain,
        triggers: a.cause && a.cause !== 'ไม่แน่ใจ' ? [a.cause] : [],
        related: related.length ? related : ['ไม่มี'],
      },
      source: 'AI Interview',
      time: t,
    },
    {
      id: `r-safe-${k}`,
      day: 'today',
      from: 'ai',
      text: safety.level === 'green' ? 'ตรวจสัญญาณอันตรายแล้ว ไม่พบ' : safety.level === 'red' ? (holdOf(safety.items)?.kind === 'heal' ? 'พบข้อห้ามนวด ให้คนไข้พักก่อน' : 'พบสัญญาณอันตราย ควรส่งต่อ รพ.') : 'ตรวจสัญญาณอันตรายแล้ว พบข้อควรระวัง',
      card: { type: 'safety', level: safety.level, items: safety.items },
      source: 'Safety Rule Engine',
      time: t,
    },
    {
      id: `r-guide-${k}`,
      day: 'today',
      from: 'ai',
      text: 'แนวทางที่แนะนำค่ะ พ่อหมอพิจารณาตามตำราของตนอีกครั้ง',
      card: {
        type: 'guideline',
        condition: g.condition,
        methods: g.methods,
        points: g.points,
        pins: g.pins,
        areas: g.areas.length > 1 ? g.areas : undefined,
        caution: [safety.caution, g.caution].filter(Boolean).join('\n') || undefined,
        ref: g.ref,
      },
      source: 'Knowledge Hub',
      time: t,
    },
  ];
  // มีข้อห้าม → ไม่เสนอแนวทางนวด/จองนัด · แนะนำพบแพทย์ก่อน
  if (safety.level === 'red') {
    out.splice(out.findIndex((x) => x.id === `r-guide-${k}`), 1);
    out.push({
      id: `r-book-${k}`,
      day: 'today',
      from: 'ai',
      // ไม่ใช่ทางตัน: บอกว่าเรื่องนี้พักไว้ และกลับมาได้เมื่อไหร่ (ตามประเภทข้อห้าม)
      text: (() => {
        const kind = holdOf(base.items)?.kind ?? 'doctor';
        return kind === 'emergency'
          ? 'ส่งคนไข้ไปโรงพยาบาลหรือโทร 1669 ทันทีค่ะ ยังไม่ควรรักษา'
          : kind === 'heal'
            ? 'ตอนนี้ยังนวดไม่ได้ค่ะ ให้คนไข้พักก่อน เรื่องนี้พักไว้ที่หน้าแรก หายแล้วค่อยประเมินใหม่'
            : 'เพื่อความปลอดภัย ควรส่งต่อ รพ.สต. ก่อนรักษาค่ะ เรื่องนี้พักไว้ที่หน้าแรก แพทย์ตรวจแล้วค่อยประเมินใหม่';
      })(),
      card: { type: 'book', service: '', red: true },
      source: 'Safety Rule Engine',
      time: t,
    });
  }
  if (withAppointment)
    out.push({
      id: `r-appt-${k}`,
      day: 'today',
      from: 'ai',
      text: 'นัดคนไข้วันนี้ค่ะ',
      card: { type: 'appointment', time: '10:30', place: 'บ้านพ่อหมอ · บ้านโนนทอง', queue: 'A12', waitMin: 25, caseId: TREATMENT_CASES.find((c) => c.appointment.today)?.id },
      source: 'ระบบนัดหมาย',
      time: t,
    });
  return out;
}

/** เส้นทางการดูแลต่อเนื่อง: ผลครั้งที่แล้ว + ติดตามผล → วันนี้เริ่มประเมินใหม่ในแชท */
export const THREAD: ThreadItem[] = [
  {
    id: 't1',
    day: 'last',
    from: 'ai',
    text: 'สรุปผลรักษาป้าสมใจครั้งที่แล้วค่ะ อาการปวดลดลงชัดเจน',
    card: { type: 'outcome', before: 6, after: 3, plan: 'นวดเส้น + ประคบปูเลย 60 นาที', date: '30 ส.ค.' },
    source: 'ผู้ให้บริการ',
    time: '30 ส.ค. · 12:10',
  },
  {
    id: 't2',
    day: 'last',
    from: 'ai',
    card: { type: 'followup', question: 'ครบ 3 วันหลังรักษา ป้าสมใจเป็นอย่างไรบ้างคะ', options: ['ดีขึ้น', 'เหมือนเดิม', 'แย่ลง'], answer: 'ดีขึ้น' },
    source: 'Follow-up',
    time: '2 ก.ย. · 09:00',
  },
  { ...askItem('symptoms', 'วันนี้ป้าสมใจมีนัดครั้งที่ 6 ค่ะ ก่อนรักษาขอทวนอาการก่อนนะคะ'), id: 't3', time: '08:40' },
];

/* ---------- ประวัติแชท ----------
 * แชทใหม่เริ่มในหน้าแรกเดิม (ไม่เปลี่ยนหน้า) · แชทเก่าเก็บเป็นรายการ เปิดกลับมาอ่าน/คุยต่อได้
 */
export interface ChatSession {
  id: string;
  title: string;
  /** ป้ายวันที่ของแชท (ใช้ใน DayDivider ของรายการ day: 'today') */
  date: string;
  items: ThreadItem[];
  assess: Assessment;
  /** แชทที่ผูกกับเส้นทางการดูแล → แสดง StageProgress */
  stage?: number;
}

/** แชทใหม่: ทักทาย + เริ่มถามหัวข้อแรกของการประเมินทันที */
/** แชทใหม่ · มีใบร่าง/ใบการรักษาอยู่แล้ว → ถามก่อนว่าเรื่องเดิมหรืออาการใหม่ (ไม่สร้างใบซ้ำ) */
/** คำถามแนะนำ — ข้อแรกเด่นสุด (ประเมินอาการ) */
export const INTENTS = ['เล่าอาการคนไข้ บันทึก ม.บ.5', 'ส่งต่อโรงพยาบาล', 'หมอพื้นบ้านทำอะไรได้'];
/** อาการผิดปกติหลังนวด (ปวด บวม ชา มากขึ้นหลังรักษา = ส่งต่อ, CPG หน้า 139) */
export const FU_ADVERSE = ['ไม่มี', 'ระบม/ช้ำ', 'ปวดมากขึ้น', 'บวม', 'ชา/อ่อนแรง'];
/** ก่อนรักษาครั้งถัดไป: ข้อห้ามใหม่ที่ต้องรู้ (ไข้/บาดเจ็บใหม่ = เลื่อนนัด · ยาใหม่ = แจ้งหมอ) */
/** ข้อห้ามใหม่ก่อนนวด — ชุดเดียวกับการประเมินครั้งแรก (RISK_OPTIONS: ตำราอ้างอิงฯ หน้า 391 · CPG หน้า 139) + เริ่มยาใหม่ · บาดเจ็บตาม CPG_PCU หน้า 139 ข้อ 3.3 */
export const FU_RISK = ['ไม่มี', 'มีไข้', 'บาดเจ็บภายใน 2 วัน', 'ผ่าตัดภายใน 1 เดือน', 'ตั้งครรภ์', 'มีแผลหรือผื่นตรงที่ปวด', 'มีประจำเดือน', 'โรคติดต่อ', 'เริ่มยาใหม่'];
/** คำถามแนะนำในแชทของเรื่องที่รักษาอยู่ (ติดตามผลกับ AI) */
/** นัดของการรักษา: ผู้ใช้ดูนัด/จองครั้งถัดไปได้ · เลื่อน/ยกเลิกต้องผ่านคลินิก (หลังบ้านโรงพยาบาล) */
export const CASE_INTENTS = ['อัดบทสนทนาการรักษา', 'ดูบันทึก ม.บ.5', 'นัดติดตามอาการ'];
/** ตัวเลือกจากปุ่ม "ถาม AI": เริ่มประเมินเรื่องใหม่ (มีทุกครั้งไม่ว่าเลือกแท็บไหน) · ใบร่าง = ประเมินซ้ำ */
export const NEW_TOPIC_INTENT = 'บันทึกอาการใหม่';
export const DRAFT_REASSESS_INTENT = 'ประเมินอีกครั้ง';
/** แชทของเรื่องที่รักษาอยู่ — AI ทักพร้อมสรุปสั้น ๆ */
export const caseChatSession = (title: string, summary: string): ChatSession => ({
  id: `cc${Date.now()}`,
  title,
  date: 'วันนี้',
  items: [{ id: `cc-ai-${Date.now()}`, day: 'today', from: 'ai', text: `${summary} อยากคุยเรื่องไหนคะ?`, card: { type: 'intents', options: CASE_INTENTS }, source: 'AI Interview', time: nowTime() }],
  assess: { ...blankAssessment(), step: 'idle' },
});
/** หน้าแรกของคนที่ยังไม่มีข้อมูล = แชท: AI ถามว่าวันนี้สนใจเรื่องอะไร (ยังไม่เริ่มประเมิน) */
export const welcomeSession = (): ChatSession => ({
  id: `w${Date.now()}`,
  title: 'แชทใหม่',
  date: 'วันนี้',
  items: [
    { id: `w-ai-${Date.now()}`, day: 'today', from: 'ai', text: 'สวัสดีค่ะพ่อหมอ วันนี้ให้หมอบ้าน AI ช่วยเรื่องอะไรดีคะ?', card: { type: 'intents', options: INTENTS }, source: 'AI Interview', time: nowTime() },
  ],
  assess: { ...blankAssessment(), step: 'idle' },
});

export const newChatSession = (askTopic = false, current?: string): ChatSession => ({
  id: `c${Date.now()}`,
  title: 'แชทใหม่',
  date: 'วันนี้',
  // กำลังดูใบไหนอยู่ → ถามต่อเรื่องนั้นก่อน
  // แชทใหม่ = เริ่มบันทึกทะเบียน ม.บ.5 (ไม่ใช้ชุดคำถามซักอาการก่อนนวดเดิม) · askTopic/current คงไว้ให้ที่เรียกเดิมใช้ได้
  items: [
    {
      id: `ask-mb5-${Date.now()}`,
      day: 'today',
      from: 'ai',
      text: `สวัสดีค่ะพ่อหมอ${askTopic && current ? ` (ต่อจาก${current} หรือคนไข้ใหม่ก็ได้)` : ''} ${MB5_ASK.symptom.text}`,
      source: 'AI Interview',
      time: nowTime(),
      card: { type: 'mb5ask', step: 'symptom', options: [SCRIBE_LABEL, ...MB5_ASK.symptom.options] },
    },
  ],
  assess: blankAssessment(),
});

export const CURRENT_CHAT: ChatSession = {
  id: 'care-4',
  title: 'ป้าสมใจ · นัดครั้งที่ 6',
  date: 'วันนี้',
  items: THREAD,
  assess: blankAssessment(),
  stage: HOME_SNAPSHOT.stage,
};

/** แชทเก่า (ตัวอย่าง) — ประเมินครบแล้ว */
export const CHAT_HISTORY: ChatSession[] = [
  {
    id: 'h2',
    title: 'ยายทองใบ ปวดศีรษะ',
    date: '12 ส.ค.',
    assess: { step: 'done', sel: { ปวดศีรษะ: null }, extra: [], pain: 5, duration: '2–3 วัน' },
    items: [
      { id: 'h2-1', day: 'today', from: 'ai', text: 'สวัสดีค่ะพ่อหมอ เล่าอาการคนไข้ได้เลยค่ะ เลือกอาการ หรือแตะบนหุ่นตรงที่ปวดได้เลยค่ะ', source: 'AI Interview', time: '14:01' },
      { id: 'h2-2', day: 'today', from: 'user', text: 'ยายปวดศีรษะ', time: '14:02' },
      { id: 'h2-3', day: 'today', from: 'ai', text: 'ไม่พบสัญญาณอันตรายค่ะ บันทึก ม.บ.5: นวดเส้นคอ–บ่า แนะนำพักผ่อน', source: 'Safety Rule Engine', time: '14:03' },
    ],
  },
  {
    id: 'h1',
    title: 'ตาสมาน ปวดหลัง',
    date: '28 ก.ค.',
    assess: { step: 'done', sel: { ปวดหลัง: null }, extra: [], pain: 6, duration: 'วันนี้' },
    items: [
      { id: 'h1-1', day: 'today', from: 'ai', text: 'สวัสดีค่ะพ่อหมอ เล่าอาการคนไข้ได้เลยค่ะ เลือกอาการ หรือแตะบนหุ่นตรงที่ปวดได้เลยค่ะ', source: 'AI Interview', time: '10:14' },
      { id: 'h1-2', day: 'today', from: 'user', text: 'ตาปวดหลัง', time: '10:15' },
      { id: 'h1-3', day: 'today', from: 'ai', text: 'บันทึก ม.บ.5 แล้วค่ะ การรักษา: นวดเส้นหลัง + ประคบสมุนไพร', source: 'AI Interview', time: '10:17' },
    ],
  },
];

/* ---------- หน้าเริ่มต้น (ก่อนกดประเมิน) ----------
 * เลือกเฉพาะข้อมูลที่ "ทำอะไรต่อได้ทันที" สำหรับผู้ใช้ที่กลับมาในวันนัด:
 * 1) ผลการรักษาล่าสุด — ได้ผลไหม (สร้างความมั่นใจ/แรงจูงใจมาต่อ)
 * 2) นัดวันนี้ — เวลา คิว เวลารอ + เช็กอินได้เลย
 * 3) เตรียมตัวก่อนรักษา — มาจากข้อควรระวังของคนไข้ (ความดันสูง → วัดก่อนนวด) ลดความเสี่ยงหน้างาน
 * + ป้ายชี้บริเวณที่รักษาครั้งล่าสุดบนหุ่น
 */
export const HOME_INTRO = {
  lastSession: { id: 'sess-2025-08-30', before: 6, after: 3, date: '30 ส.ค.', plan: 'นวดเส้น + ประคบปูเลย' },
  appointment: { label: 'นัดวันนี้', time: '10:30', queue: 'A12', waitMin: 25 },
  prep: { title: 'ก่อนรักษา', items: ['วัดความดันก่อนนวด', 'เตรียมลูกประคบปูเลย'] },
};

/** บริเวณที่รักษาในครั้งหนึ่ง (ติดตามผลบนหุ่น) */
export interface FollowUpArea {
  label: string;
  pin: BodyPin;
  /** อาการที่ใช้เริ่มแชทเมื่อ "ยังปวด" */
  symptom: string;
  /** คะแนนปวดก่อนนวด ณ บริเวณนั้น */
  before: number;
}
/** ครั้งการรักษาที่ยังไม่ได้ติดตามผล (ล่าสุดก่อน) */
export interface PendingSession {
  id: string;
  date: string;
  plan: string;
  areas: FollowUpArea[];
}

/**
 * ใบการรักษา — คนไข้ 1 คน + อาการ (หนึ่งเรื่องรักษาต่อเนื่องได้หลายครั้ง · บันทึกตามแบบ ม.บ.5)
 * หน้าแรกเลือกดูทีละใบ: mark บนหุ่น · ผลการรักษา · ติดตามอาการ เปลี่ยนตามใบที่เลือก
 */
export interface TreatmentCase {
  id: string;
  /** ครบคอร์สและไม่มีนัดค้าง → จบเรื่องนี้ (ย้ายไปประวัติ "รักษาจบแล้ว" · ไม่อยู่บนแท็บหน้าแรก) */
  finished?: boolean;
  /** ชื่อโรค/ปัญหา */
  condition: string;
  /** ชื่อสั้นบนตัวเลือกใบการรักษา */
  short: string;
  plan: string;
  /** บริเวณที่นวดในใบนี้ (mark บนหุ่น) */
  areas: FollowUpArea[];
  /** คะแนนปวดก่อน/หลังทุกครั้ง (เก่า → ใหม่) */
  /** painAfter = คะแนนที่คลินิกบันทึกตอนปิดการรักษา (ค่าหลัก) · selfPain = ผู้ใช้บอกเองในแอป (เสริม) */
  visits: {
    date: string;
    painBefore: number;
    painAfter: number;
    selfPain?: number;
    /** บันทึกการรักษาจริงจากคลินิก (หลังบ้าน) — ไม่มี = ใช้ข้อมูลตัวอย่าง */
    record?: { findings?: string; diagnoses?: string[]; procedures?: string[]; advice?: string; therapist?: string };
  }[];
  /** แผนการรักษาที่แพทย์อนุมัติในหลังบ้าน */
  clinicPlan?: { summary: string; sessions: number; frequency: string; homeCare: string[] };
  /** ครั้งที่ยังค้างติดตามผล (ล่าสุดก่อน) — ให้คะแนนแยกทีละบริเวณ */
  pending: PendingSession[];
  /** นัดครั้งถัดไปของใบนี้ (แต่ละโรคนัดคนละวัน) · today = วันนี้ → เช็กอินได้ */
  appointment: { today: boolean; date: string; time: string; queue?: string; waitMin?: number; stage?: 'checked_in' | 'called' | 'in_service'; startedAt?: string; minutes?: number };
  /** เตรียมตัวก่อนนวดสำหรับโรคนี้ */
  prep: string[];
  /** คอร์สการรักษา: ทำไปแล้ว / ทั้งหมด */
  course: { done: number; total: number };
  /** ผู้ให้บริการประจำใบนี้ */
  therapist: string;
  /** ดูแลตัวเองที่บ้าน (ท่าแนะนำของโรคนี้) */
  /** groupId = กลุ่มอาการใน SYMPTOM_GROUPS (มีภาพท่ายืด) · ไม่มี = ท่าอื่น เช่น ฝึกหายใจ */
  selfCare: { title: string; minutes: number; doneToday: boolean; groupId?: string };
  /** แชทของเรื่องนี้ (มาจากใบร่าง) */
  chatId?: string;
  /** สถานที่ที่รักษาเรื่องนี้ (นัดครั้งถัดไปต้องที่เดิม) · ไม่ระบุ = คลินิกหลัก */
  clinic?: string;
}

// ป้าสมใจ: เส้นตึง ปวดเอวซ้ายร้าวสะโพก (หลังก้มดำนา)
const OFFICE_AREAS: FollowUpArea[] = [
  { label: 'เอวซ้าย', pin: 'lowerBack', symptom: 'ปวดเอว', before: 6 },
  { label: 'สะโพกซ้าย', pin: 'hipLeft', symptom: 'ปวดสะโพกซ้าย', before: 4 },
];
// ลุงคำดี: ฟื้นฟูอัมพฤกษ์ซีกขวา (แขน มือ ขาขวาอ่อนแรง)
const LUNG_AREAS: FollowUpArea[] = [
  { label: 'แขนขวา', pin: 'armRight', symptom: 'ปวดแขนขวา', before: 6 },
  { label: 'มือขวา', pin: 'handRight', symptom: 'ปวดมือขวา', before: 5 },
  { label: 'ขาขวา', pin: 'thighRight', symptom: 'ปวดต้นขาขวา', before: 6 },
];

/** วันทำการ (จ.–ศ.) ถัดไปอย่างน้อย n วัน → "พ. 14 ต.ค." (ค่าตั้งต้นเมื่อยังไม่ได้ข้อมูลจากคลินิก) */
function nextWorkdayLabel(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][d.getDay()]} ${d.getDate()} ${M[d.getMonth()]}`;
}

/**
 * บัญชีตัวอย่าง (พ่อหมอสมบัติ ศรีสุข · ม.บ.3 ขก 00001) — ข้อมูลชุดเดียวกับหลังบ้าน MohbanHealth (src/data/seed.ts addAppUser)
 * นัดที่ยังไม่จบอยู่ใน cloud: id ตรงกับ DEMO_REFS ของหลังบ้าน
 */
export const DEMO_PATIENT_CLOUD_ID = 'app-p-zk6srq';
export const DEMO_LINKS: Record<string, { caseId: string; billId?: string }> = {
  'tw-demo-office-6': { caseId: 'case-office' },
  'tw-demo-lung-4': { caseId: 'case-lung' },
  'tw-demo-lung-3': { caseId: 'case-lung', billId: 'b-lung-3' },
};

/** หมอผู้ใช้แอป (บัญชีตัวอย่าง) — หมอผู้รักษาของทุกบันทึก ม.บ.5 */
const HEALER = 'พ่อหมอสมบัติ ศรีสุข';

/** คนไข้ที่พ่อหมอสมบัติกำลังดูแล — 1 ใบ = คนไข้ 1 คน + อาการ (แท็บบนหน้าแรก) · บันทึกแต่ละครั้งตามแบบ ม.บ.5 */
export const TREATMENT_CASES: TreatmentCase[] = [
  {
    id: 'case-office',
    // นางสมใจ ทองมา 62 ปี บ้านโนนทอง · ความดันโลหิตสูง · ปวดเอวซ้ายหลังก้มดำนา
    condition: 'เส้นตึง (ปวดเอวด้านซ้าย)',
    short: 'ป้าสมใจ ปวดเอว',
    plan: 'นวดเส้น + ประคบปูเลย',
    areas: OFFICE_AREAS,
    visits: [
      { date: '14 มิ.ย.', painBefore: 8, painAfter: 6, record: { findings: 'ปวดเอวซ้ายหลังก้มดำนา 3 วัน ก้มไม่ได้ · เส้นเอวซ้ายตึงแข็ง กดเจ็บ · ความดัน 150/90', diagnoses: ['เส้นตึง (ปวดเอว)'], procedures: ['นวดเส้น', 'ประคบสมุนไพร (ปูเลย ขมิ้น)'], advice: 'งดยกของหนัก · งดก้มดำนา 1 สัปดาห์ · นัดติดตาม 2 สัปดาห์', therapist: HEALER } },
      { date: '28 มิ.ย.', painBefore: 8, painAfter: 5, record: { findings: 'ยังปวดเอวตอนตื่นนอน · เส้นเอวซ้ายตึงลดลง', diagnoses: ['เส้นตึง (ปวดเอว)'], procedures: ['นวดเส้น', 'ประคบสมุนไพร (ปูเลย ขมิ้น)'], advice: 'ทำท่าดูแลตัวเองเช้า–เย็น · นัดติดตาม 2 สัปดาห์', therapist: HEALER } },
      { date: '12 ก.ค.', painBefore: 7, painAfter: 5, record: { findings: 'ปวดเอวร้าวสะโพกซ้ายหลังทำนา · ก้มได้มากขึ้น', diagnoses: ['เส้นตึง (ปวดเอว)'], procedures: ['นวดเส้น', 'ประคบสมุนไพร (ปูเลย ขมิ้น)'], advice: 'นั่งยอง ๆ ให้น้อยลง · นัดติดตาม 3 สัปดาห์', therapist: HEALER } },
      { date: '2 ส.ค.', painBefore: 7, painAfter: 4, record: { findings: 'ปวดเอวลดลง เดินได้คล่อง · ความดัน 146/88', diagnoses: ['เส้นตึง (ปวดเอว)'], procedures: ['นวดเส้น', 'ประคบสมุนไพร (ปูเลย ขมิ้น)'], advice: 'กินยาความดันตามหมอ รพ.สต. · นัดติดตาม 4 สัปดาห์', therapist: HEALER } },
      // ตัวอย่าง: ติดตามอาการหลังรักษาครั้งล่าสุดแล้ว (ลุงคำดี = ยังไม่ได้ติดตาม)
      { date: '30 ส.ค.', painBefore: 6, painAfter: 3, selfPain: 3, record: { findings: 'ปวดเอวเล็กน้อยหลังทำงานหนัก · ก้มเงยได้ปกติ', diagnoses: ['เส้นตึง (ปวดเอว)'], procedures: ['นวดเส้น', 'ประคบสมุนไพร (ปูเลย ขมิ้น)'], advice: 'ทำท่าดูแลตัวเองทุกวัน · นัดติดตามครั้งที่ 6', therapist: HEALER } },
    ],
    pending: [{ id: 'sess-2025-08-30', date: '30 ส.ค.', plan: 'นวดเส้น + ประคบปูเลย', areas: OFFICE_AREAS }],
    // นัดวันนี้ (ครั้งที่ 6) — เวลาจริงมาจาก รพ.สต. ผ่าน cloud (DEMO_LINKS) · เลขคิวออกตอนรับเรื่อง
    appointment: { today: true, date: 'วันนี้', time: '10:00' },
    prep: ['วัดความดันก่อนนวด', 'เตรียมลูกประคบปูเลย'],
    course: { done: 5, total: 8 },
    // หมอผู้รักษา = พ่อหมอเอง
    therapist: HEALER,
    selfCare: { title: 'ท่าดำรงกายอายุยืน', minutes: 5, doneToday: false, groupId: 'piriformis' },
  },
  {
    id: 'case-lung',
    // นายคำดี สายบุญ 58 ปี บ้านหนองแวง · โรงพยาบาลขอนแก่นส่งต่อมาฟื้นฟู
    condition: 'ฟื้นฟูอัมพฤกษ์ซีกขวา (หลอดเลือดสมอง)',
    short: 'ลุงคำดี อัมพฤกษ์',
    plan: 'นวดเส้นแขนขาขวา + อบสมุนไพร',
    areas: LUNG_AREAS,
    visits: [
      { date: '19 ก.ค.', painBefore: 6, painAfter: 5, record: { findings: 'แขนขาขวาอ่อนแรง กำมือได้ครึ่งเดียว · ความดัน 148/92 · รพ.ขอนแก่นส่งต่อมา', diagnoses: ['อัมพฤกษ์ซีกขวา (ระยะฟื้นฟู)'], procedures: ['นวดเส้นแขนขาขวา (แรงเบา)', 'อบสมุนไพร (ไพล ตะไคร้ มะกรูด)'], advice: 'งดนวดแรงที่คอ · กินยาตามหมอ รพ. ห้ามหยุดเอง · นัดติดตาม 2 สัปดาห์', therapist: HEALER } },
      { date: '2 ส.ค.', painBefore: 6, painAfter: 4, record: { findings: 'ยกแขนขวาได้สูงขึ้น · ขาขวายังลากเท้า · ความดัน 142/90', diagnoses: ['อัมพฤกษ์ซีกขวา (ระยะฟื้นฟู)'], procedures: ['นวดเส้นแขนขาขวา (แรงเบา)', 'อบสมุนไพร (ไพล ตะไคร้ มะกรูด)'], advice: 'ฝึกกำ–แบมือวันละ 3 รอบ · นัดติดตาม 2 สัปดาห์', therapist: HEALER } },
      { date: '16 ส.ค.', painBefore: 5, painAfter: 3, record: { findings: 'กำมือขวาแน่นขึ้น เดินใช้ไม้เท้าได้ · ความดัน 138/86', diagnoses: ['อัมพฤกษ์ซีกขวา (ระยะฟื้นฟู)'], procedures: ['นวดเส้นแขนขาขวา (แรงเบา)', 'อบสมุนไพร (ไพล ตะไคร้ มะกรูด)'], advice: 'ห้ามประคบร้อนจัดบริเวณที่ชา · ส่งผลกลับ รพ.ขอนแก่น · นัดติดตาม 2 สัปดาห์', therapist: HEALER } },
    ],
    // ข้อมูลส่งต่อจากแพทย์ โรงพยาบาลขอนแก่น (ข้อห้าม + ยาที่ใช้อยู่)
    clinicPlan: { summary: 'โรงพยาบาลขอนแก่นส่งต่อ: ฟื้นฟูอัมพฤกษ์ซีกขวา · ห้ามนวดแรงบริเวณคอ · ห้ามความร้อนจัดบริเวณที่ชา · วัดความดันก่อนนวด เกิน 160/100 ให้งด · ยา Clopidogrel, Amlodipine', sessions: 6, frequency: 'ทุก 2 สัปดาห์', homeCare: ['ฝึกกำ–แบมือขวาวันละ 3 รอบ', 'เดินใช้ไม้เท้า มีคนช่วยพยุง', 'กินยาตามแพทย์ ห้ามหยุดเอง'] },
    pending: [{ id: 'sess-2025-08-16', date: '16 ส.ค.', plan: 'นวดเส้นแขนขาขวา + อบสมุนไพร', areas: LUNG_AREAS }],
    appointment: { today: false, date: nextWorkdayLabel(4), time: '14:00' },
    prep: ['วัดความดัน เกิน 160/100 งดนวด', 'ห้ามนวดแรงที่คอ · ห้ามร้อนจัด'],
    course: { done: 3, total: 6 },
    // ผู้ดูแลร่วม = แพทย์ผู้ส่งต่อ
    therapist: 'โรงพยาบาลขอนแก่น (ส่งต่อ)',
    // อัมพฤกษ์: นวดใบหน้า (ทาแป้งข้างจมูก · ถูหน้าหู) ช่วยเลือดไหลเวียนบริเวณใบหน้า
    selfCare: { title: 'ท่านวดกล้ามเนื้อใบหน้า', minutes: 3, doneToday: true, groupId: 'paralysis' },
  },
];

/** คนไข้ที่รักษาจบแล้ว (ครบตามนัด) — อยู่ในแท็บประวัติ ไม่อยู่บนหน้าแรก */
export const ARCHIVED_CASES: TreatmentCase[] = [
  {
    id: 'case-lbp',
    // นายบุญเลิศ ดวงดี 45 ปี บ้านโคกสี · ล้มตอนเกี่ยวข้าว
    condition: 'ข้อเท้าแพลง (ล้มตอนเกี่ยวข้าว)',
    short: 'บุญเลิศ ข้อเท้าแพลง',
    plan: 'ยาพอกไพล-ขมิ้นชัน + เฝือกไม้ไผ่',
    areas: [{ label: 'ข้อเท้าขวา', pin: 'ankleRight', symptom: 'ปวดข้อเท้าขวา', before: 7 }],
    visits: [
      { date: '3 มี.ค.', painBefore: 7, painAfter: 5, record: { findings: 'ข้อเท้าขวาบวมช้ำหลังล้มตอนเกี่ยวข้าว · ลงน้ำหนักได้ ไม่มีกระดูกโผล่', diagnoses: ['ข้อเท้าแพลง'], procedures: ['ยาพอก (ไพล ขมิ้นชัน)', 'เข้าเฝือกไม้ไผ่'], advice: 'ยกเท้าสูง · งดเดินไกล · ถ้าบวมมากขึ้นให้ไป รพ.สต.บ้านค้อ', therapist: HEALER } },
      { date: '17 มี.ค.', painBefore: 6, painAfter: 4, record: { findings: 'บวมยุบลง ช้ำจางลง', diagnoses: ['ข้อเท้าแพลง'], procedures: ['ยาพอก (ไพล ขมิ้นชัน)', 'เข้าเฝือกไม้ไผ่'], advice: 'ยกเท้าสูงตอนนอน · นัดเปลี่ยนยาพอก 2 สัปดาห์', therapist: HEALER } },
      { date: '31 มี.ค.', painBefore: 5, painAfter: 3, record: { findings: 'เดินได้ ยังเจ็บตอนบิดข้อเท้า', diagnoses: ['ข้อเท้าแพลง'], procedures: ['ยาพอก (ไพล ขมิ้นชัน)', 'เข้าเฝือกไม้ไผ่'], advice: 'ค่อย ๆ หมุนข้อเท้าวันละ 2 รอบ', therapist: HEALER } },
      { date: '14 เม.ย.', painBefore: 4, painAfter: 2, record: { findings: 'ไม่บวม เดินได้ปกติ', diagnoses: ['ข้อเท้าแพลง'], procedures: ['ยาพอก (ไพล ขมิ้นชัน)', 'ถอดเฝือกไม้ไผ่'], advice: 'พันผ้ายืดเวลาทำงานในนา', therapist: HEALER } },
      { date: '28 เม.ย.', painBefore: 3, painAfter: 1, record: { findings: 'ปวดเล็กน้อยหลังเดินนาน', diagnoses: ['ข้อเท้าแพลง'], procedures: ['นวดเส้น (ข้อเท้า)'], advice: 'บริหารข้อเท้าต่อเนื่อง', therapist: HEALER } },
      { date: '12 พ.ค.', painBefore: 2, painAfter: 1, record: { findings: 'หายเป็นปกติ กลับไปทำนาได้', diagnoses: ['ข้อเท้าแพลง'], procedures: ['นวดเส้น (ข้อเท้า)'], advice: 'จบการรักษา · ถ้ากลับมาปวดบวมให้มาหาหมอ', therapist: HEALER } },
    ],
    pending: [],
    appointment: { today: false, date: '-', time: '-' },
    prep: [],
    course: { done: 6, total: 6 },
    therapist: HEALER,
    selfCare: { title: 'ท่าหมุนข้อเท้า ยกเท้าสูง', minutes: 5, doneToday: false },
  },
];

/** ทุกครั้งที่ค้างติดตามผล (รวมทุกใบการรักษา) */
export const PENDING_FOLLOW_UPS: PendingSession[] = TREATMENT_CASES.flatMap((c) => c.pending);

/** แชทใหม่ที่ตอบหัวข้อ "อาการ" ไว้แล้ว (มาจากการกด "ยังปวด" บนหุ่น) → ถามอาการร่วมต่อเลย */
export const newChatWithSymptom = (symptom: string, note: string, pain?: number): ChatSession => {
  const base = newChatSession();
  return {
    ...base,
    title: `${symptom} (ติดตามผล)`,
    items: [
      ...base.items,
      { id: `u${Date.now()}`, day: 'today', from: 'user', text: `${symptom} — ${note}`, time: base.items[0].time },
      ...(pain !== undefined ? [{ id: `p${Date.now()}`, day: 'today' as const, from: 'user' as const, text: `ปวดระดับ ${pain}/10`, pain, time: base.items[0].time }] : []),
      askItem('related', 'รับทราบค่ะ'),
    ],
    assess: { ...blankAssessment(), step: 'related', sel: { [symptom]: null }, pain: pain ?? 0 },
  };
};
