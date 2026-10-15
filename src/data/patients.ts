/**
 * ข้อมูลคนไข้ของหมอ (ส่วนผู้ป่วยของแบบ ม.บ.5 · Spec หัวข้อ 5 entity patient / consent / referral)
 * ------------------------------------------------------------------
 * ⚠️ ข้อมูลสมมติทั้งหมด (docs/CONTENT_MAPPING.md) · ผูกกับใบรักษาด้วย caseId
 * ข้อควรระวังสมุนไพร–ยา (FR-32) เป็นตัวอย่าง ต้องผ่านการตรวจทานโดยเภสัชกรก่อนใช้จริง
 */
import { HERBS } from './mb5';

export interface PatientInfo {
  caseId: string;
  name: string;
  sex: 'ชาย' | 'หญิง';
  age: number;
  /** เลขบัตรประชาชน (แสดงแบบปิดบางส่วน) */
  cid: string;
  village: string;
  phone: string;
  chronic: string[];
  meds: string[];
  allergy: string[];
  weight?: number;
  height?: number;
  /** ความยินยอม 2 ระดับ (FR-11) */
  consent: { record: boolean; share: boolean; at: string; method: 'เซ็น' | 'เสียง' };
  /** จับคู่ HOSxP ด้วยเลขบัตรแล้ว (FR-12) */
  hn?: string;
  /** โรงพยาบาลส่งต่อมาหาหมอ (flow C) */
  referral?: { from: string; doctor: string; reason: string; diagnosis: string; precautions: string[]; at: string };
  /** สมุนไพรที่หมอใช้กับคนไข้คนนี้ (ใช้ตรวจข้อควรระวังกับยา) */
  herbsUsed: string[];
}

export const PATIENTS: PatientInfo[] = [
  {
    caseId: 'case-office',
    name: 'นางสมใจ ทองมา',
    sex: 'หญิง',
    age: 62,
    cid: '3-4099-00123-45-1',
    village: 'บ้านโนนทอง ต.บ้านค้อ',
    phone: '089-123-4567',
    chronic: ['ความดันโลหิตสูง'],
    meds: ['Amlodipine 5 mg'],
    allergy: [],
    weight: 58,
    height: 152,
    consent: { record: true, share: true, at: '14 มิ.ย. 69', method: 'เซ็น' },
    hn: '0045123',
    herbsUsed: ['ไพล', 'ขมิ้นชัน'],
  },
  {
    caseId: 'case-lung',
    name: 'นายคำดี สายบุญ',
    sex: 'ชาย',
    age: 58,
    cid: '3-4101-00456-78-3',
    village: 'บ้านหนองแวง ต.บ้านค้อ',
    phone: '081-987-6543',
    chronic: ['อัมพฤกษ์ซีกขวา (หลอดเลือดสมอง)', 'ความดันโลหิตสูง'],
    meds: ['Clopidogrel 75 mg', 'Amlodipine 5 mg', 'Atorvastatin 20 mg'],
    allergy: ['แพ้ยาแอสไพริน'],
    weight: 64,
    height: 165,
    consent: { record: true, share: true, at: '19 ก.ค. 69', method: 'เสียง' },
    hn: '0039876',
    referral: {
      from: 'โรงพยาบาลขอนแก่น',
      doctor: 'นพ.วิชัย ใจงาม',
      reason: 'ฟื้นฟูอัมพฤกษ์ซีกขวาระยะกลาง (Intermediate Care) หลังออกจากโรงพยาบาล',
      diagnosis: 'I69.3 ผลตามหลังโรคหลอดเลือดสมองตีบ',
      precautions: ['ห้ามนวดแรงบริเวณคอ', 'ห้ามใช้ความร้อนจัดบริเวณที่ชา', 'วัดความดันก่อนรักษา เกิน 160/100 ให้งด'],
      at: '14 ก.ค. 69',
    },
    herbsUsed: ['ไพล', 'กระเทียม'],
  },
  {
    caseId: 'case-lbp',
    name: 'นายบุญเลิศ ดวงดี',
    sex: 'ชาย',
    age: 45,
    cid: '3-1005-00789-12-0',
    village: 'บ้านโคกสี ต.บ้านค้อ',
    phone: '086-555-1212',
    chronic: [],
    meds: [],
    allergy: [],
    consent: { record: true, share: false, at: '3 มี.ค. 69', method: 'เซ็น' },
    herbsUsed: ['ไพล', 'ขมิ้นชัน'],
  },
];

export const patientOfCase = (caseId?: string) => PATIENTS.find((p) => p.caseId === caseId);

/**
 * ข้อควรระวังสมุนไพรที่หมอใช้ × ยาที่คนไข้ใช้อยู่ (FR-32 · ตัวอย่าง รอเภสัชกรตรวจทาน)
 * จับจากคำเตือนในตารางสมุนไพร + กลุ่มยา
 */
const DRUG_GROUP: [RegExp, RegExp][] = [
  [/ละลายลิ่มเลือด/, /clopidogrel|warfarin|aspirin|แอสไพริน/i],
  [/ลดความดัน/, /amlodipine|enalapril|losartan|hydrochlorothiazide/i],
  [/เบาหวาน|น้ำตาล/, /metformin|glipizide|insulin/i],
  [/ตับ/, /atorvastatin|simvastatin|paracetamol/i],
];
export function herbDrugCautions(p: PatientInfo): string[] {
  const out: string[] = [];
  for (const name of p.herbsUsed) {
    const h = HERBS.find((x) => x.std === name);
    if (!h?.warn) continue;
    const hit = DRUG_GROUP.find(([w, d]) => w.test(h.warn!) && p.meds.some((m) => d.test(m)));
    if (hit) out.push(`${h.std}: ${h.warn} (คนไข้ใช้ ${p.meds.filter((m) => hit[1].test(m)).join(', ')})`);
  }
  return out;
}
