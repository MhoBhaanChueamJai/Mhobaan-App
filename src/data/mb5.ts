/**
 * ทะเบียนการรักษา ม.บ.5 จากเสียง (docs/MOHBAN_SPEC.md · FR-20, FR-21, FR-23, FR-30)
 * ------------------------------------------------------------------
 * หมอเล่าการรักษาเป็นภาษาถิ่น → AI แยกเป็นช่อง ม.บ.5 → จับคู่ชื่อสมุนไพรท้องถิ่นกับชื่อมาตรฐาน → ตรวจสัญญาณอันตรายด้วยกฎตายตัว
 * ⚠️ prototype: กรรมวิธี/สมุนไพรเป็นชุดตัวอย่าง · กฎ red flag ต้องผ่านการรับรองจากแพทย์ก่อนใช้จริง
 */
import { extractAI } from '../services/aiService';
/** คลังข้อมูลหมอพื้นบ้านที่สกัดจากเอกสารใน Knowledge Hub (docs/FOLK_CATALOG.md · ทุกข้ออ้างเอกสาร/หน้า) */
import CATALOG from './folkCatalog.json';

/**
 * กรรมวิธีที่หมอตัวอย่างได้รับรับรอง (FR-22) — เลือกจาก 122 กรรมวิธีในคู่มือประกอบการรับรองหมอพื้นบ้าน หน้า 42–62
 * พ่อหมอสมบัติ = หมอนวดพื้นบ้าน (ด้านการนวด) + หมอยาสมุนไพร (ด้านสมุนไพร)
 */
const ALL_METHODS = CATALOG.methods as Record<string, string[]>;
const CERTIFIED_PICK: [string, string[]][] = [
  ['ด้านการนวด', ['นวด', 'จับเส้น', 'รีดเส้น', 'ดึงเส้น', 'ย่ำขาง/เหยียบขาง', 'นวดกดจุด']],
  ['ด้านสมุนไพร', ['ประคบ', 'อบ/ฮม', 'ต้ม', 'พอก/โปะ/โพะ/เพาะ', 'ฝน', 'ทา/ลูบ']],
];
export const CERTIFIED_METHODS = CERTIFIED_PICK.flatMap(([g, names]) => names.filter((n) => ALL_METHODS[g]?.includes(n)));
/** กรรมวิธีครบ 122 แบบ แยก 6 ด้าน (ใช้แสดง/ตรวจสอบ) */
export const METHOD_GROUPS = ALL_METHODS;
/** ชื่อกรรมวิธีมีหลายคำเรียก ("พอก/โปะ") → ตรงคำไหนก็นับ */
const methodWords = (m: string) => m.split('/').map((w) => w.trim()).filter(Boolean);
export const methodsInText = (t: string) => CERTIFIED_METHODS.filter((m) => methodWords(m).some((w) => t.includes(w)));

/** สมุนไพร: ชื่อมาตรฐาน + ชื่อท้องถิ่น + คำเตือนที่ผ่านการตรวจทาน (ตัวอย่าง) */
export const HERBS: { std: string; local: string[]; warn?: string }[] = [
  { std: 'ไพล', local: ['ปูเลย', 'ว่านไฟ', 'ปูลอย'] },
  { std: 'ขมิ้นชัน', local: ['ขมิ้น', 'ขมิ้นแกง', 'ขมิ้นหัว'] },
  { std: 'ตะไคร้', local: ['หัวสิงไค', 'จะไคร'] },
  { std: 'มะกรูด', local: ['มะขุน', 'ส้มกรูด'] },
  { std: 'เถาวัลย์เปรียง', local: ['เครือตาปลา', 'เครือเขาหนัง'] },
  { std: 'ฟ้าทะลายโจร', local: ['หญ้ากันงู', 'น้ำลายพังพอน'], warn: 'ระวังในผู้ที่ใช้ยาลดความดัน' },
  { std: 'ขี้เหล็ก', local: ['ขี้เหล็กบ้าน', 'ผักจี้ลี้'], warn: 'อาจมีผลต่อตับ ระวังร่วมกับยาที่มีผลต่อตับ' },
  { std: 'บอระเพ็ด', local: ['เครือเขาฮอ'], warn: 'ระวังในผู้ป่วยเบาหวานที่ใช้ยา' },
  { std: 'ใบหนาด', local: ['หนาดหลวง', 'คำพอง'] },
  { std: 'เพชรสังฆาต', local: ['สันชะฆาต', 'ขันข้อ'] },
  { std: 'ข่า', local: ['ข่าหลวง'] },
  { std: 'ขิง', local: ['ขิงแดง'] },
  { std: 'รางจืด', local: ['ย่ำแย้', 'เครือเขาเขียว'] },
  { std: 'กระเทียม', local: ['หอมเทียม', 'หอมขาว'], warn: 'ระวังร่วมกับยาละลายลิ่มเลือด' },
  { std: 'เถาเอ็นอ่อน', local: ['เครือเอ็นอ่อน'] },
];

// สมุนไพรที่เอกสารกล่าวถึง (ไม่ใช่กรรมวิธี) → เพิ่มเข้าตารางจับคู่
for (const h of CATALOG.herbs as { std: string; local: string[] }[]) {
  if (/กรรมวิธี/.test(h.std)) continue;
  const std = h.std.replace(/\s*\(.*\)$/, '');
  const cur = HERBS.find((x) => x.std === std);
  if (cur) cur.local = [...new Set([...cur.local, ...h.local])];
  else HERBS.push({ std, local: h.local });
}

/** สมุนไพรทุกชื่อที่พบในข้อความ (ชื่อยาวก่อน · ไม่นับซ้ำ) → { คำที่หมอพูด, ชื่อมาตรฐาน, คำเตือน } */
export function herbsInText(text: string) {
  const names = HERBS.flatMap((h) => [h.std, ...h.local].map((n) => ({ n, h }))).sort((a, b) => b.n.length - a.n.length);
  const out: { local: string; std: string; warn?: string }[] = [];
  let rest = text;
  for (const { n, h } of names) {
    if (!rest.includes(n)) continue;
    if (!out.some((o) => o.std === h.std)) out.push({ local: n, std: h.std, warn: h.warn });
    rest = rest.split(n).join(' ');
  }
  return out;
}

/** กฎสัญญาณอันตราย (FR-30) — ทุก pattern ต้องเจอ · emergency = โทร 1669 */
const RED_FLAGS: { title: string; advice: string; emergency: boolean; all: RegExp[] }[] = [
  { title: 'งูกัดร่วมกับอาการทางประสาท', advice: 'อาจเป็นพิษงูต่อระบบประสาท ส่ง รพ. ทันที', emergency: true, all: [/งู(กัด|ฉก|ตอด)|โดนงู|ถืกงู|ถูกงู/, /หนังตาตก|ตาปรือ|กลืนลำบาก|กลืน.{0,6}บ่.{0,3}ได้|หายใจลำบาก|พูดไม่ชัด|เว้าบ่.{0,4}ชัด|ลิ้นแข็ง/] },
  { title: 'กระดูกหักแบบแผลเปิด', advice: 'เสี่ยงติดเชื้อรุนแรง ห้ามต่อกระดูกเอง ส่ง รพ.', emergency: true, all: [/กระดูก(หัก|แตก)|ดูกหัก/, /แผลเปิด|กระดูกโผล่|ดูกโผล่|ทะลุ|เลือดออกมาก/] },
  { title: 'ไข้สูงในเด็กเล็ก', advice: 'เด็กเล็กไข้สูงเสี่ยงชัก ส่ง รพ.สต./รพ.', emergency: false, all: [/เด็ก|ลูกน้อย|หลานน้อย|\d+\s*(เดือน|ขวบ)/, /ไข้สูง|ตัวร้อนจัด|ชัก/] },
  { title: 'เจ็บหรือแน่นหน้าอก', advice: 'อาจเป็นโรคหัวใจ ส่ง รพ. ทันที', emergency: true, all: [/เจ็บหน้าอก|แน่นหน้าอก|เจ็บอก|แน่นอก|หายใจไม่ออก/] },
  { title: 'สัญญาณหลอดเลือดสมอง', advice: 'ปากเบี้ยว/แขนขาอ่อนแรงทันที ส่ง รพ. ภายใน 4.5 ชม.', emergency: true, all: [/ปากเบี้ยว|ปากเบ้|อ่อนแรง(ทันที|เฉียบพลัน)|อ่อนแรงซีกเดียว/] },
];

export type Mb5Flag = { title: string; advice: string; emergency: boolean };
export const checkRedFlags = (text: string): Mb5Flag[] => RED_FLAGS.filter((r) => r.all.every((re) => re.test(text))).map(({ title, advice, emergency }) => ({ title, advice, emergency }));

/** บันทึก ม.บ.5 หนึ่งครั้ง (ช่องตามแบบ ม.บ.5) */
export interface Mb5Record {
  symptom: string;
  physicalExam: string;
  localDisease: string;
  diagnosis: string;
  treatment: string;
  methods: string[];
  herbs: { local: string; std: string; warn?: string }[];
  result: string;
  followUpDays: number;
  note: string;
  /** คำที่ถอดจากเสียงหมอ (ต้นฉบับ) */
  story: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    symptom: { type: 'string' },
    physicalExam: { type: 'string' },
    localDisease: { type: 'string' },
    diagnosis: { type: 'string' },
    treatment: { type: 'string' },
    methods: { type: 'array', items: { type: 'string', enum: CERTIFIED_METHODS } },
    result: { type: 'string' },
    followUpDays: { type: 'integer' },
    note: { type: 'string' },
  },
  required: ['symptom', 'physicalExam', 'localDisease', 'diagnosis', 'treatment', 'methods', 'result', 'followUpDays', 'note'],
};

/** คำเล่าของหมอ → ช่อง ม.บ.5 + สมุนไพร + สัญญาณอันตราย · AI ใช้ไม่ได้ = แยกแบบง่าย ให้หมอแก้เอง */
export async function recordFromStory(story: string): Promise<{ rec: Mb5Record; flags: Mb5Flag[]; by: 'ai' | 'local' }> {
  const herbs = herbsInText(story);
  const flags = checkRedFlags(story);
  try {
    const r = await extractAI<Omit<Mb5Record, 'herbs' | 'story'>>(
      [
        'แยกคำเล่าของหมอพื้นบ้าน (อาจเป็นภาษาอีสาน เหนือ ใต้) เป็นช่องทะเบียนการรักษา ม.บ.5 เขียนเป็นภาษาไทยกลางสั้น ๆ',
        'symptom = อาการที่คนไข้มาด้วย + ระยะเวลา · physicalExam = สิ่งที่หมอตรวจพบ · localDisease = ชื่อโรคตามคำที่หมอใช้ (เช่น เส้นจม ไข้หมากไม้) · diagnosis = วินิจฉัยเป็นภาษากลาง · treatment = สิ่งที่หมอทำ',
        `methods = กรรมวิธีที่หมอทำจริง เลือกจากรายการนี้เท่านั้น: ${CERTIFIED_METHODS.join(', ')}`,
        'result = ผลหลังรักษา (หาย / ทุเลา / ไม่ดีขึ้น / แย่ลง / รอติดตาม) · followUpDays = นัดดูอาการอีกกี่วัน ไม่ได้นัด = 0 · note = อื่น ๆ ที่สำคัญ',
        'ไม่ต้องใส่สูตรยา ปริมาณ หรือคาถา · ห้ามแต่งข้อมูลที่ไม่ได้พูด ไม่มีให้เป็นค่าว่าง',
      ].join('\n'),
      story,
      SCHEMA,
      'mb5',
      600,
    );
    return { rec: { ...r, result: /รอติดตาม/.test(r.result) ? '' : r.result, followUpDays: r.followUpDays > 0 ? r.followUpDays : /ไม่นัด/.test(story) ? 0 : -1, methods: r.methods.filter((m) => CERTIFIED_METHODS.includes(m)), herbs, story }, flags, by: 'ai' };
  } catch {
    return {
      rec: {
        symptom: story,
        physicalExam: '',
        localDisease: '',
        diagnosis: '',
        treatment: '',
        methods: methodsInText(story),
        herbs,
        result: '',
        followUpDays: /สามมื้อ|3 วัน|สามวัน/.test(story) ? 3 : /อาทิตย์|สัปดาห์|7 วัน/.test(story) ? 7 : -1,
        note: '',
        story,
      },
      flags,
      by: 'local',
    };
  }
}

/** ช่องที่ยังว่าง (ให้ AI ถามต่อด้วยเสียง) */
export function missingFields(rec: Mb5Record) {
  return [
    !rec.symptom && 'อาการ',
    !rec.physicalExam && 'ตรวจร่างกาย',
    !rec.diagnosis && !rec.localDisease && 'วินิจฉัย',
    !rec.treatment && !rec.methods.length && 'การรักษา',
  ].filter(Boolean) as string[];
}

/* ============================================================ ซักตามช่อง ม.บ.5 (แทนชุดคำถามซักอาการก่อนนวดเดิม)
 * ถามหมอทีละช่องด้วยเสียง (แตะตัวเลือกได้) · เล่ายาวรวดเดียว = เติมหลายช่องพร้อมกัน แล้วถามเฉพาะช่องที่ขาด
 * ตัวเลือก: ต้องมาจากคลังความรู้ (docs/FOLK_CATALOG.md) — ชุดนี้เป็นตัวตั้งต้น
 */
export type Mb5Step = 'symptom' | 'exam' | 'diagnosis' | 'treatment' | 'result' | 'followUp';
export const MB5_ORDER: Mb5Step[] = ['symptom', 'exam', 'diagnosis', 'treatment', 'result', 'followUp'];

const CONDITIONS = CATALOG.conditions as Record<string, { name: string; local?: string }[]>;
/** หมวดอาการ (13 หมวดจากเอกสาร) */
export const SYMPTOM_CATEGORIES = Object.keys(CONDITIONS);
/** วิธีตรวจแบบพื้นบ้านจากเอกสาร (KH หน้า 3 · เรียนรู้และเข้าใจหมอพื้นบ้าน) — ชุดที่หมอนวด/หมอยาใช้บ่อย */
const EXAM_PICK = ['ซักถาม/พูดคุยด้วยภาษาท้องถิ่น', 'ดู คลำ ฟัง ขยับ', 'จับชีพจร', 'แมะ', 'ดูสีผิว สีตา', 'เคาะท้อง', 'สัมผัสปลายหูปลายเท้า/ลมหายใจบนหลังมือ', 'วัดความดันโลหิต'];
const EXAM_OPTIONS = EXAM_PICK.filter((n) => (CATALOG.diagnosis as { name: string }[]).some((d) => d.name === n));

export const MB5_ASK: Record<Mb5Step, { label: string; text: string; options: string[] }> = {
  symptom: { label: 'อาการ', text: 'คนไข้มาด้วยเรื่องอะไรคะ เล่าอาการได้เลย', options: SYMPTOM_CATEGORIES },
  exam: { label: 'ตรวจร่างกาย', text: 'พ่อหมอตรวจคนไข้ด้วยวิธีไหน พบอะไรบ้างคะ', options: EXAM_OPTIONS },
  diagnosis: { label: 'วินิจฉัย', text: 'พ่อหมอวินิจฉัยว่าเป็นอะไรคะ เรียกตามที่หมอใช้ได้เลย', options: ['ไม่แน่ใจ'] },
  treatment: { label: 'การรักษา', text: 'รักษาด้วยวิธีไหน ใช้สมุนไพรอะไรบ้างคะ', options: CERTIFIED_METHODS },
  // คำเรียกผลการรักษาที่เอกสารใช้ (เรียนรู้และเข้าใจหมอพื้นบ้าน · สถานภาพฯ หน้า 199)
  result: { label: 'ผล', text: 'หลังรักษาคนไข้เป็นอย่างไรคะ', options: ['หาย', 'ทุเลา', 'ดีขึ้น', 'ไม่ได้ผล', 'ยังไม่ทราบผล'] },
  followUp: { label: 'นัดติดตาม', text: 'นัดดูอาการอีกกี่วันคะ', options: ['ไม่นัด', '1–2 วัน', '2–3 วัน', '3 วัน', '7 วัน'] },
};

/** ตัวเลือกของช่องที่ถาม · วินิจฉัย = ชื่อโรคในหมวดอาการที่หมอเลือก (จากเอกสาร) */
export function mb5Options(step: Mb5Step, r: Mb5Record): string[] {
  if (step !== 'diagnosis') return MB5_ASK[step].options;
  const cat = SYMPTOM_CATEGORIES.find((c) => r.symptom.includes(c)) ?? SYMPTOM_CATEGORIES.find((c) => CONDITIONS[c].some((x) => r.symptom.includes(x.name)));
  const names = cat ? CONDITIONS[cat].map((x) => x.name) : [];
  return [...names.slice(0, 10), 'ไม่แน่ใจ'];
}

export const emptyMb5 = (): Mb5Record => ({ symptom: '', physicalExam: '', localDisease: '', diagnosis: '', treatment: '', methods: [], herbs: [], result: '', followUpDays: -1, note: '', story: '' });

/** ช่องถัดไปที่ยังว่าง (ตามลำดับแบบ ม.บ.5) · ครบแล้ว = null */
export function nextMb5Step(r: Mb5Record): Mb5Step | null {
  const empty: Record<Mb5Step, boolean> = {
    symptom: !r.symptom,
    exam: !r.physicalExam,
    diagnosis: !r.localDisease && !r.diagnosis,
    treatment: !r.treatment && !r.methods.length,
    result: !r.result,
    followUp: r.followUpDays < 0,
  };
  return MB5_ORDER.find((s) => empty[s]) ?? null;
}

const daysOf = (t: string) => {
  if (/ไม่นัด|ไม่ต้องนัด/.test(t)) return 0;
  const m = t.match(/(\d+)\s*(วัน|มื้อ)/);
  if (m) return Number(m[1]);
  if (/อาทิตย์|สัปดาห์/.test(t)) return 7;
  if (/สามวัน|สามมื้อ/.test(t)) return 3;
  return -1;
};

/** คำตอบสั้น (แตะ/พูด) ของช่องที่ถามอยู่ → บันทึกลงช่องนั้น */
export function applyMb5Answer(r: Mb5Record, step: Mb5Step, text: string): Mb5Record {
  const t = text.trim();
  const story = `${r.story}${r.story ? ' · ' : ''}${t}`;
  switch (step) {
    case 'symptom':
      return { ...r, symptom: t, story };
    case 'exam':
      return { ...r, physicalExam: t, story };
    case 'diagnosis':
      return { ...r, localDisease: t === 'ไม่แน่ใจ' ? 'ไม่แน่ใจ' : t, story };
    case 'treatment': {
      const methods = [...new Set([...r.methods, ...methodsInText(t)])];
      const herbs = [...r.herbs, ...herbsInText(t).filter((h) => !r.herbs.some((x) => x.std === h.std))];
      return { ...r, treatment: r.treatment ? `${r.treatment} · ${t}` : t, methods, herbs, story };
    }
    case 'result':
      return { ...r, result: t, story };
    case 'followUp': {
      const d = daysOf(t);
      return { ...r, followUpDays: d < 0 ? 0 : d, note: d < 0 ? `${r.note}${r.note ? ' · ' : ''}นัด: ${t}` : r.note, story };
    }
  }
}

/** เล่ายาว → เติมเฉพาะช่องที่ยังว่าง (ไม่ทับที่หมอตอบไว้แล้ว) */
export function mergeMb5(r: Mb5Record, x: Mb5Record): Mb5Record {
  return {
    symptom: r.symptom || x.symptom,
    physicalExam: r.physicalExam || x.physicalExam,
    localDisease: r.localDisease || x.localDisease,
    diagnosis: r.diagnosis || x.diagnosis,
    treatment: r.treatment || x.treatment,
    methods: [...new Set([...r.methods, ...x.methods])],
    herbs: [...r.herbs, ...x.herbs.filter((h) => !r.herbs.some((y) => y.std === h.std))],
    result: r.result || (x.result && x.result !== 'รอติดตาม' ? x.result : ''),
    followUpDays: r.followUpDays >= 0 ? r.followUpDays : x.followUpDays > 0 ? x.followUpDays : -1,
    note: [r.note, x.note].filter(Boolean).join(' · '),
    story: [r.story, x.story].filter(Boolean).join(' · '),
  };
}

/** หนังสือรับรองของหมอตัวอย่าง (ม.บ.3 · ข้อมูลสมมติ) — แสดงในแท็บโปรไฟล์ */
export const HEALER_CERT = {
  no: 'ขก 00001',
  status: 'ใช้ได้',
  expire: '11 ม.ค. 2570',
  types: ['หมอนวดพื้นบ้าน', 'หมอยาสมุนไพร'],
  area: 'บ้านโนนทอง ต.บ้านค้อ อ.เมือง จ.ขอนแก่น',
};

/** ปุ่มอัดบทสนทนาระหว่างหมอกับคนไข้ (flow หลักของการบันทึก ม.บ.5) */
export const SCRIBE_LABEL = 'อัดบทสนทนาการรักษา';
