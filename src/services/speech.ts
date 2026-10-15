/**
 * ข้อความ → คำพูด (ให้เสียง AI อ่านตามความหมาย ไม่อ่านสัญลักษณ์ตรงตัว)
 * เช่น "ครั้งที่ 3/6" → "ครั้งที่ 3 จาก 6" · "7/10" → "7 จาก 10" · "(0–10)" → "จาก 0 ถึง 10" · "อ. 13 ต.ค." → "วันอังคารที่ 13 ตุลาคม"
 *      "14:30 น." → "14 นาฬิกา 30 นาที" · "57%" → "57 เปอร์เซ็นต์" · "→" → "เป็น" · "·" → จุดพักประโยค
 * ข้อมูลส่วนตัว: เลข 13 หลัก (เลขบัตร) ตัดทิ้ง · เบอร์โทร / สายด่วน (1669) อ่านทีละตัว
 * จุดพัก (· / ขึ้นบรรทัด) → "\n" = แบ่งท่อนเสียง (sentencesOf) ให้หยุดเว้นจังหวะ
 */

const MONTHS: [string, string][] = [
  ['ม.ค.', 'มกราคม'],
  ['ก.พ.', 'กุมภาพันธ์'],
  ['มี.ค.', 'มีนาคม'],
  ['เม.ย.', 'เมษายน'],
  ['พ.ค.', 'พฤษภาคม'],
  ['มิ.ย.', 'มิถุนายน'],
  ['ก.ค.', 'กรกฎาคม'],
  ['ส.ค.', 'สิงหาคม'],
  ['ก.ย.', 'กันยายน'],
  ['ต.ค.', 'ตุลาคม'],
  ['พ.ย.', 'พฤศจิกายน'],
  ['ธ.ค.', 'ธันวาคม'],
];
/** วันย่อหน้าวันที่ (เช่น "อ. 13") — เรียงตัวยาวก่อน (พฤ. ก่อน พ.) */
const DAYS: [string, string][] = [
  ['อา.', 'อาทิตย์'],
  ['พฤ.', 'พฤหัสบดี'],
  ['จ.', 'จันทร์'],
  ['อ.', 'อังคาร'],
  ['พ.', 'พุธ'],
  ['ศ.', 'ศุกร์'],
  ['ส.', 'เสาร์'],
];
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TH = '[\\u0E00-\\u0E7F]';
const MONTH_RE = MONTHS.map(([ab]) => esc(ab)).join('|');
/** หน่วยหลังทับ = "ต่อ" (350 บาท/ครั้ง → บาทต่อครั้ง) */
const PER_UNIT = 'ครั้ง|วัน|ชั่วโมง|ชม\\.|เดือน|สัปดาห์|ปี|คน|ท่า|ข้าง|เม็ด|นาที';
/** สายด่วนที่ไม่ซ้ำกับตัวเลขทั่วไป (อ่านทีละตัว) · เลขอื่นอ่านทีละตัวเมื่อมี โทร/สายด่วน นำหน้า */
const HOTLINES = '1669|1323';

export function speechOf(input: string): string {
  let t = ` ${input} `;
  // สัญลักษณ์ตกแต่ง / emoji
  t = t
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\uFE0F\u200B-\u200D]/g, '')
    // เปรียบเทียบ (ไข้ > 38.5) ก่อนตัดสัญลักษณ์
    .replace(/\s(>=|≥)\s*(?=\d)/g, ' ตั้งแต่ ')
    .replace(/\s(<=|≤)\s*(?=\d)/g, ' ไม่เกิน ')
    .replace(/\s>\s*(?=\d)/g, ' มากกว่า ')
    .replace(/\s<\s*(?=\d)/g, ' น้อยกว่า ')
    .replace(/[*#_`>•|✓✔←↗]/g, ' ');
  // เลขบัตรประชาชน (13 หลัก) → ไม่อ่าน
  t = t.replace(/\d[\d -]{15,18}\d/g, (m) => (m.replace(/\D/g, '').length === 13 ? ' ' : m));
  // เบอร์โทร 0x-xxx-xxxx / 0xx-xxx-xxxx · สายด่วน (โทร 1669) → ทีละตัว
  t = t.replace(/\b0\d{1,2}[- ]?\d{3}[- ]?\d{3,4}\b/g, (m) => ` ${m.replace(/\D/g, '').split('').join(' ')} `);
  t = t.replace(new RegExp(`(^|\\D)(${HOTLINES})(?!\\d)`, 'g'), (_m, pre: string, n: string) => `${pre} ${n.split('').join(' ')} `);
  t = t.replace(/((?:โทร(?:ศัพท์)?|สายด่วน)\s*)(\d{3,5})(?!\d)/g, (_m, pre: string, n: string) => `${pre}${n.split('').join(' ')} `);
  // วันย่อ + วันที่: "อ. 13 ต.ค." → "วันอังคารที่ 13 ต.ค."
  for (const [ab, full] of DAYS) t = t.replace(new RegExp(`(^|[\\s(])${esc(ab)}\\s*(?=\\d)`, 'g'), `$1วัน${full}ที่ `);
  // วันที่ลอย ๆ (ครั้งที่ 2 (16 ส.ค.)) → "วันที่ 16 …" ไม่ให้เลขติดกัน · มีวัน/ที่ นำหน้าแล้ว = ไม่เติม
  t = t.replace(new RegExp(`(\\d{1,2})\\s*(?=(${MONTH_RE}))`, 'g'), (m: string, d: string, _mo: string, at: number, all: string) =>
    /\d$/.test(all.slice(0, at)) || /(ที่|วัน|ถึง|-|–)\s*$/.test(all.slice(Math.max(0, at - 6), at)) ? m : `วันที่ ${d} `,
  );
  // เดือนย่อ
  for (const [ab, full] of MONTHS) t = t.replace(new RegExp(esc(ab), 'g'), ` ${full} `);
  t = t.replace(/พ\.ศ\./g, 'พุทธศักราช').replace(/ค\.ศ\./g, 'คริสต์ศักราช');
  // เวลา 14:30 (น.) → 14 นาฬิกา 30 นาที
  t = t.replace(/\b(\d{1,2})[:.](\d{2})\s*(น\.)?/g, (_m, h: string, mm: string) => ` ${Number(h)} นาฬิกา${mm === '00' ? '' : ` ${Number(mm)} นาที`} `);
  // ตัวย่อทั่วไป
  t = t
    .replace(/พท\.ป\./g, 'แพทย์แผนไทยประยุกต์')
    .replace(/พท\./g, 'แพทย์แผนไทย')
    .replace(/ชม\./g, ' ชั่วโมง ')
    .replace(/กม\./g, ' กิโลเมตร ')
    .replace(/ซม\./g, ' เซนติเมตร ')
    .replace(/กก\./g, ' กิโลกรัม ')
    .replace(/(\d)\s*บ\./g, '$1 บาท')
    .replace(/(^|\s)ม\.\s*(\d)/g, '$1หมู่ $2')
    .replace(/(\d)\s*ม\.(?!\S*ค)(?!\s*\d)/g, '$1 เมตร')
    .replace(/°\s*C\b/g, ' องศาเซลเซียส ')
    .replace(/(\d)\s*mmHg\b/g, '$1 มิลลิเมตรปรอท')
    .replace(/(\d)\s*mg\b/gi, '$1 มิลลิกรัม')
    .replace(/(\d)\s*kg\b/gi, '$1 กิโลกรัม')
    .replace(/(\d)\s*cm\b/gi, '$1 เซนติเมตร')
    .replace(new RegExp(`(^|\\s)ต\\.(?=${TH})`, 'g'), '$1ตำบล')
    .replace(new RegExp(`(^|\\s)อ\\.(?=${TH})`, 'g'), '$1อำเภอ')
    .replace(new RegExp(`(^|\\s)จ\\.(?=${TH})`, 'g'), '$1จังหวัด');
  // ช่วง/สัดส่วน: (0–10) → จาก 0 ถึง 10 · 3/6 → 3 จาก 6 · 2–3 → 2 ถึง 3
  t = t
    .replace(/\(\s*(\d+)\s*[–-]\s*(\d+)\s*\)/g, ' จาก $1 ถึง $2 ')
    // สัดส่วน (3/6 · 7/10) = "จาก" · บ้านเลขที่ (99/1 — ตัวหลังน้อยกว่า หรือมีคำว่าที่อยู่/เลขที่ นำหน้า) = "ทับ"
    .replace(/(\d+)\s*\/\s*(\d+)/g, (m: string, a: string, b: string, at: number, all: string) =>
      Number(b) < Number(a) || /(ที่อยู่|เลขที่|บ้าน)\s*$/.test(all.slice(Math.max(0, at - 14), at)) ? `${a} ทับ ${b}` : `${a} จาก ${b}`,
    )
    .replace(/(\d+)\s*[–—]\s*(\d+)/g, '$1 ถึง $2')
    // ช่วงตัวเลขตามด้วยหน่วย/คำไทย (10-15 วินาที · 1-2 เม็ด) — เบอร์โทรแปลงไปก่อนแล้ว
    .replace(new RegExp(`(\\d+)\\s*-\\s*(\\d+)(?=\\s*${TH})`, 'g'), '$1 ถึง $2')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 เปอร์เซ็นต์')
    .replace(/(^|\s)\+(\d)/g, '$1เพิ่ม $2')
    .replace(/(\d)\s*=\s*/g, '$1 คือ ')
    .replace(/\s*→\s*/g, ' เป็น ');
  // ทับตามด้วยหน่วย (บาท/ครั้ง · วันละ) → "ต่อ"
  t = t.replace(new RegExp(`(${TH}|\\d)\\s*/\\s*(?=(${PER_UNIT})(?!${TH}))`, 'g'), '$1ต่อ');
  // ทับระหว่างคำไทย (ศีรษะ/ใบหน้า · นั่ง/ยืนนาน) → "หรือ"
  t = t.replace(new RegExp(`(${TH})\\s*/\\s*(?=${TH})`, 'g'), '$1 หรือ ');
  // ขีดระหว่างคำไทย (คอ-บ่า) → เว้นวรรค · จุดไข่ปลา / เครื่องหมายคำพูด → ไม่อ่าน
  t = t.replace(new RegExp(`(${TH})\\s*-\\s*(?=${TH})`, 'g'), '$1 ').replace(/[…"“”'‘’]/g, ' ');
  // วงเล็บ → เว้นวรรค · จุดคั่น / ขึ้นบรรทัด → พักประโยค ("\n" = แบ่งท่อนเสียง)
  t = t.replace(/[()[\]{}]/g, ' ').replace(/\s*:\s+/g, ' ').replace(/\s*[·;\n]+\s*/g, '\n');
  return t
    .split('\n')
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** pain score ก่อน → หลัง เป็นคำพูด · % คิดแบบเดียวกับป้ายบนการ์ด (DeltaPill): (ก่อน − หลัง) ÷ ก่อน */
export function painChangeText(before: number, after: number): string {
  if (after === before) return 'ระดับปวดเท่าเดิม';
  if (before === 0) return `ปวดเพิ่มขึ้น ${after} คะแนน`;
  const pct = Math.abs(Math.round(((before - after) / before) * 100));
  return after < before ? `ปวดน้อยลง ${pct}%` : `ปวดเพิ่มขึ้น ${pct}%`;
}

/**
 * แบ่งเป็นท่อนเสียง: จบที่ ค่ะ/คะ/ครับ/?/!/. หรือจุดพัก ("\n" จาก speechOf) แล้วรวมท่อนสั้นให้ยาวพอ
 * → สร้างเสียงทุกท่อนพร้อมกัน เล่นท่อนแรกได้เร็ว (สร้างเสียงช้าตามความยาว: ~9 ตัวอักษร 0.3 วิ · ~126 ตัวอักษร 1.2 วิ)
 */
export function sentencesOf(text: string, min = 24): string[] {
  const parts = text
    .replace(/(ค่ะ|คะ|ครับ|[?!.])[ \t]+/g, '$1\u0001')
    .split(/[\u0001\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].length < min) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}

/** ตัดชื่อผู้ใช้ (ไม่ส่งไป endpoint ที่ไม่มี key) — ชื่อเต็ม / "คุณ…" · ชื่อเล่นลอย ๆ ตัดเฉพาะเมื่อเป็นคำเดี่ยว (ชื่อสั้นไม่กินคำอื่น เช่น "ดี" ใน "ดีขึ้น") */
export function withoutName(text: string, name: string) {
  const full = name.trim();
  const first = full.split(/\s+/)[0];
  let t = text;
  for (const n of [full, first]) if (n) t = t.split(`คุณ${n}`).join('');
  if (full.includes(' ')) t = t.split(full).join('');
  if (first) t = t.replace(new RegExp(`(^|\\s)${esc(first)}(?=\\s|$|ค่ะ|คะ|นะ|ครับ)`, 'g'), '$1');
  return t;
}

/**
 * ข้อความที่อ่านออกเสียง: ตัดชื่อ → อ่านตามความหมาย → สั้นพอฟังรู้เรื่อง (รายละเอียดอยู่ในการ์ด)
 * parts ตั้งแต่ keepFrom = ท้ายสุด (คำถามที่ต้องตอบ + ตัวเลือก) อ่านครบเสมอ · ยาวเกิน → ย่อส่วนต้นเป็นประโยค ๆ แทน (เดิมตัดท้าย = คำถามหาย)
 */
export function spokenOf(parts: string[], name: string, max = 300, keepFrom = parts.length): string {
  const norm = (xs: string[]) => speechOf(withoutName(xs.filter(Boolean).join('\n'), name));
  const head = norm(parts.slice(0, keepFrom));
  let tail = norm(parts.slice(keepFrom));
  // ท่อนท้ายยาวผิดปกติ → ตัดที่ท่อนเสียง
  if (tail.length > max * 2) tail = fit(tail, max * 2);
  const room = max - tail.length - (tail ? 1 : 0);
  return [head.length <= room ? head : fit(head, room), tail].filter(Boolean).join('\n');
}
/** เก็บท่อนแรก ๆ ให้พอดีความยาว (ไม่ตัดกลางประโยค · ประโยคแรกยาวเกิน → ตัดที่ช่องว่าง) */
function fit(text: string, room: number) {
  if (room < 40) return '';
  let out = '';
  for (const s of sentencesOf(text, 0)) {
    const next = out ? `${out}\n${s}` : s;
    if (next.length > room) break;
    out = next;
  }
  if (out) return out;
  const cut = text.slice(0, room);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trim();
}
