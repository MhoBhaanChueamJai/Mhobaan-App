/**
 * รหัสทางคลินิก — ชุดเดียวกับหลังบ้าน MohbanHealth (src/data/codes.ts) ให้แอปกับหลังบ้านแสดงรหัสตรงกัน
 * วินิจฉัย → ICD-10 (WHO · ใช้ได้ใน ICD-10-TM) · หัตถการ → ICD-9-CM · กฎแรกที่ตรงชนะ (เฉพาะเจาะจงอยู่ก่อน)
 * ⚠️ รหัสจริงมาจากเจ้าหน้าที่บันทึกในหลังบ้าน (แก้ได้) — ตารางนี้ใช้แสดงเมื่อยังไม่มีบันทึก
 */
type Rule = { kw: string[]; code: string; en: string };

const DX: Rule[] = [
  { kw: ['เส้นตึง', 'หลังส่วนล่าง', 'สัญญาณ 4 หลัง', 'เอว'], code: 'M54.5', en: 'Low back pain' },
  { kw: ['ข้อเท้าแพลง', 'ข้อเท้าพลิก'], code: 'S93.4', en: 'Sprain and strain of ankle' },
  { kw: ['ไหล่ติด'], code: 'M75.0', en: 'Adhesive capsulitis of shoulder' },
  { kw: ['เข่า'], code: 'M17.9', en: 'Gonarthrosis, unspecified' },
  { kw: ['นิ้วล็อก'], code: 'M65.3', en: 'Trigger finger' },
  { kw: ['รองช้ำ', 'ส้นเท้า'], code: 'M72.2', en: 'Plantar fascial fibromatosis' },
  { kw: ['อัมพฤกษ์', 'อัมพาต'], code: 'G81.9', en: 'Hemiplegia, unspecified' },
  { kw: ['นอนไม่หลับ'], code: 'G47.0', en: 'Insomnia' },
  { kw: ['ปวดศีรษะ', 'สัณฑฆาต', 'ไมเกรน'], code: 'R51', en: 'Headache' },
  { kw: ['ตะคริว'], code: 'R25.2', en: 'Cramp and spasm' },
  { kw: ['ชา'], code: 'R20.2', en: 'Paraesthesia of skin' },
  { kw: ['ปวดคอ'], code: 'M54.2', en: 'Cervicalgia' },
  { kw: ['ปัตคาด', 'กล้ามเนื้อ', 'บ่า', 'ออฟฟิศ'], code: 'M79.1', en: 'Myalgia' },
  { kw: ['เครียด'], code: 'F43.9', en: 'Reaction to severe stress, unspecified' },
];

const PROC: Rule[] = [
  { kw: ['ฤาษีดัดตน', 'ท่าบริหาร', 'กายบริหาร'], code: '93.19', en: 'Exercise, not elsewhere classified' },
  { kw: ['เฝือก'], code: '93.54', en: 'Application of splint' },
  { kw: ['ประคบ', 'อบ', 'พอก', 'ไอน้ำ', 'ย่ำขาง'], code: '93.35', en: 'Other heat therapy' },
  { kw: ['นวด', 'จับเส้น', 'กดจุด', 'เส้นประธาน'], code: '93.39', en: 'Other physical therapy' },
];

const match = (rules: Rule[], name: string) => rules.find((r) => r.kw.some((k) => name.includes(k)));
export const dxCode = (name: string) => match(DX, name);
export const procCode = (name: string) => match(PROC, name);
