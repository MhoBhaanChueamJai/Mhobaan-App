/**
 * Knowledge Search — ให้ AI ตอบจากคลังความรู้ของเราเอง (Knowledge Hub หมอพื้นบ้าน `knowledge hub/E-book/`) ไม่ใช้ Knowledge MCP
 * ------------------------------------------------------------------
 * 1) scripts/build-kb.py แปลง PDF → ข้อความรายหน้า → assets/kb/kb.txt (1 บรรทัด = 1 หน้า)
 * 2) ถามมา → AI ดึงคำค้น (รวมคำพ้อง) → ให้คะแนนแต่ละหน้า (คำหายากได้คะแนนมากกว่า) → เอา 4 หน้าแรก
 * 3) ส่งเฉพาะหน้าเหล่านั้นให้ AI ตอบ + อ้างอิงเอกสาร/หน้า · ไม่เจอ = บอกว่าไม่พบ ไม่แต่งเอง
 * ไทยไม่เว้นวรรคคำ → ค้นแบบหาคำย่อยในข้อความ (พอสำหรับต้นแบบ · ของจริงใช้ embedding)
 */
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import KB from '../../assets/kb/kb.txt';
import { completeAI, extractAI } from './aiService';

export interface KBPage {
  f: string;
  p: number;
  t: string;
}

let pages: Promise<KBPage[]> | null = null;

/** โหลดครั้งแรกที่ใช้ (~5 MB) แล้วเก็บไว้ */
export function loadKnowledge(): Promise<KBPage[]> {
  if (!pages)
    pages = (async () => {
      const asset = Asset.fromModule(KB);
      let raw: string;
      if (Platform.OS === 'web') raw = await (await fetch(asset.uri)).text();
      else {
        await asset.downloadAsync();
        raw = await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
      }
      return raw
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as KBPage);
    })().catch((e) => {
      pages = null;
      throw e;
    });
  return pages;
}

const count = (text: string, word: string) => {
  let n = 0;
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + word.length)) n++;
  return n;
};

/** หน้าที่ตรงคำค้นที่สุด: คำที่เจอน้อยหน้า (เฉพาะเจาะจง) ได้น้ำหนักมาก · เจอหลายคำในหน้าเดียวกันได้โบนัส · only = ค้นเฉพาะเล่ม (หน้าคลังความรู้) */
export async function searchKnowledge(keywords: string[], k = 4, only?: string): Promise<KBPage[]> {
  const all = (await loadKnowledge()).filter((pg) => !only || pg.f === only);
  const words = [...new Set(keywords.map((w) => w.trim()).filter((w) => w.length >= 2))];
  const counts = words.map((w) => all.map((pg) => count(pg.t, w)));
  const idf = counts.map((c) => Math.log(1 + all.length / (1 + c.filter(Boolean).length)));
  return all
    .map((pg, i) => {
      let score = 0;
      let hit = 0;
      words.forEach((_, j) => {
        const c = counts[j][i];
        if (c) (score += idf[j] * (1 + Math.log(c))), hit++;
      });
      return { pg, score: score * (1 + 0.5 * (hit - 1)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.pg);
}

/** จำนวนหน้าของแต่ละเล่มในคลัง (หน้าที่มีข้อความ) */
export async function pageCounts(): Promise<Record<string, number>> {
  const out: Record<string, Set<number>> = {};
  for (const pg of await loadKnowledge()) (out[pg.f] ??= new Set()).add(pg.p);
  return Object.fromEntries(Object.entries(out).map(([f, s]) => [f, s.size]));
}

/** ตัดข้อความรอบ ๆ คำค้นที่เจอ (สำหรับโชว์อ้างอิงในแชท) */
export function quoteAround(text: string, keywords: string[], len = 220): string {
  const at = keywords.map((w) => text.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 60);
  return `${start ? '…' : ''}${text.slice(start, start + len).replace(/\s+/g, ' ').trim()}…`;
}

export interface KnowledgeAnswer {
  answer: string;
  refs: { f: string; p: number; quote: string }[];
}

/** ถามคลังความรู้ — ตอบจากเอกสารเท่านั้น พร้อมบอกแหล่ง */
export async function askKnowledge(question: string, userContext = ''): Promise<KnowledgeAnswer> {
  const { keywords } = await extractAI<{ keywords: string[] }>(
    'ดึงคำค้นภาษาไทยสำหรับหาในเอกสารการแพทย์พื้นบ้าน/หมอพื้นบ้าน/แพทย์แผนไทย 3–8 คำ: คำหลักในคำถาม + คำพ้องหรือศัพท์ที่เอกสารใช้ (เช่น หมอต่อกระดูก → หมอกระดูก, กระดูกหัก, ต่อกระดูก · รับรองหมอพื้นบ้าน → การรับรอง, คุณสมบัติ, หนังสือรับรอง) · แต่ละคำสั้น 1–2 คำ ที่น่าจะพบตรงตัวในเอกสาร (เช่น สมุนไพร, พิธีกรรม, ข้อห้าม) ไม่ใส่ประโยค',
    question,
    { type: 'object', properties: { keywords: { type: 'array', items: { type: 'string' }, maxItems: 8 } }, required: ['keywords'] },
  );
  const found = await searchKnowledge(keywords);
  if (!found.length) return { answer: 'ไม่พบเรื่องนี้ในคลังความรู้ค่ะ', refs: [] };
  const excerpts = found.map((pg, i) => `[${i + 1}] ${pg.f} หน้า ${pg.p}\n${pg.t.slice(0, 2200)}`).join('\n\n');
  const answer = await completeAI(
    [
      {
        role: 'system',
        content: [
          'คุณคือผู้ช่วยในแอปหมอบ้านเชื่อมใจ ตอบภาษาไทยสุภาพ กระชับไม่เกิน 4 ประโยค',
          'ตอบจาก "ข้อความจากคลังความรู้" ด้านล่างเท่านั้น ห้ามใช้ความรู้อื่น ถ้าข้อความไม่ได้ตอบคำถามให้บอกว่า "ไม่พบในคลังความรู้ค่ะ"',
          'ท้ายประโยคที่ใช้ข้อมูล ใส่เลขอ้างอิงในวงเล็บเหลี่ยม เช่น [1]',
          'ห้ามวินิจฉัยหรือสั่งยา · ข้อความเป็น OCR อาจมีคำเพี้ยน ให้อ่านตามความหมาย',
          userContext ? `ข้อมูลผู้ใช้ (ใช้ปรับคำตอบให้เข้ากับเขา): ${userContext}` : '',
          `\nข้อความจากคลังความรู้:\n${excerpts}`,
        ].join('\n'),
      },
      { role: 'user', content: question },
    ],
    { max_tokens: 450, temperature: 0.2 },
    45000,
  );
  // แสดงเฉพาะแหล่งที่ AI อ้างจริง (ถ้าไม่อ้างเลย = ไม่พบ → ไม่โชว์แหล่ง)
  const cited = [...new Set([...answer.matchAll(/\[(\d)\]/g)].map((m) => Number(m[1]) - 1))].filter((i) => found[i]);
  return {
    answer: answer
      .replace(/\]\s*,\s*\[/g, '][')
      .replace(/\s*\[(\d)\]/g, (_, n) => (found[Number(n) - 1] ? `[${cited.indexOf(Number(n) - 1) + 1}]` : ''))
      .replace(/\]\[/g, ',')
      .replace(/(\[[\d,]+\])(?=[^\s.,])/g, '$1 '),
    refs: cited.map((i) => ({ f: found[i].f, p: found[i].p, quote: quoteAround(found[i].t, keywords) })),
  };
}

/* ============================================================ วางแผนการนวด
 * ข้อมูลแรกรับ (massageIntake) + แนวทางเบื้องต้นตามตำแหน่ง (treatmentGuides) + หน้าที่ค้นได้จากคลังความรู้
 * → AI จัดเป็นแผนทีละช่วง (เตรียม · นวดคลาย · เฉพาะจุด · ปิดท้าย) พร้อมข้อควรระวังและการดูแลหลังนวด
 * ผลคัดกรองความปลอดภัยมาจาก safetyEngine — AI ต้องทำตาม ห้ามตัดสินใหม่
 */
export interface MassagePlan {
  summary: string;
  cautions: string[];
  style: string;
  minutes: string;
  phases: { title: string; minutes: string; steps: string[] }[];
  aftercare: string[];
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    cautions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    style: { type: 'string' },
    minutes: { type: 'string' },
    phases: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, minutes: { type: 'string' }, steps: { type: 'array', items: { type: 'string' }, maxItems: 4 } },
        required: ['title', 'minutes', 'steps'],
      },
    },
    aftercare: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    cite: { type: 'array', items: { type: 'integer' } },
  },
  required: ['summary', 'cautions', 'style', 'minutes', 'phases', 'aftercare', 'cite'],
};

export async function planMassage(
  intake: [string, string][],
  guide: { condition: string; methods: string[]; points: string[] },
  symptoms: string[],
  conditions: string[],
): Promise<{ plan: MassagePlan; refs: KnowledgeAnswer['refs'] }> {
  // คำค้น: ชื่อโรค + บริเวณ (ตัดคำว่าปวด/ข้าง) + โรคประจำตัว + วิธีที่ใช้
  const areas = symptoms.map((s) => s.replace(/^ปวด/, '').replace(/(ซ้าย|ขวา)$/, ''));
  const keywords = [guide.condition, ...areas, ...conditions, 'ข้อควรระวัง', 'ประคบ', ...(intake.some(([k, v]) => k === 'อาการร้าว' && v.startsWith('ร้าว')) ? ['ร้าว'] : [])];
  const found = await searchKnowledge(keywords, 5);
  const excerpts = found.map((pg, i) => `[${i + 1}] ${pg.f} หน้า ${pg.p}\n${pg.t.slice(0, 1800)}`).join('\n\n');
  const out = await completeAI(
    [
      {
        role: 'system',
        content: [
          'คุณคือหมอบ้าน AI ช่วยหมอพื้นบ้านสรุปแผนการรักษาคนไข้ลงทะเบียน ม.บ.5 ให้อ่านเข้าใจ (หมอเป็นผู้ตรวจและแก้ไขเอง)',
          'ภาษาไทยง่าย ๆ ประโยคสั้น ไม่ใช้ศัพท์ภาษาอังกฤษ · ทุก step ไม่เกิน 1 บรรทัด',
          'ใช้ข้อมูลแรกรับ + แนวทางเบื้องต้น + ข้อความจากคลังความรู้เท่านั้น ห้ามแต่งตัวเลขหรือวิธีที่ไม่มีในข้อมูล',
          'ผลตรวจสัญญาณอันตรายตัดสินแล้ว ห้ามขัด: มีข้อควรระวังต้องปรับแผนตาม (เช่น ความดันสูง = นวดเส้นเบา งดอบ ลุกช้า ๆ) · ห้ามนวดหรือพอกยาบริเวณที่มีแผลเปิด · มีสัญญาณอันตราย = ส่งต่อ รพ.',
          'ทำตามกรรมวิธีที่หมอได้รับรับรอง ไม่ต้องใส่สูตรยาหรือคาถา',
          'ปวดร้าว = อาการเดียวกัน นวดเส้นต่อเนื่องจากจุดที่ปวดไปทางที่ร้าว ไม่แยกเป็น 2 จุด',
          'จุดกดใช้เฉพาะที่อยู่ใน "แนวทางเบื้องต้น" ถ้าแนวทางไม่มีจุด ให้เขียนว่าหมอเลือกจุดหน้างาน ห้ามตั้งชื่อจุดเอง',
          'phases: 3–4 ช่วง เช่น จับชีพจร/ดูอาการ · นวดเส้น · ประคบหรือพอกสมุนไพร · แนะนำดูแลตัวเองและนัดติดตาม รวมเวลาเท่ากับ minutes',
          'cite = เลขข้อความจากคลังความรู้ที่ใช้จริง',
          `\nแนวทางเบื้องต้นตามตำแหน่งที่ปวด: ${guide.condition} · วิธี: ${guide.methods.join(', ')} · จุด: ${guide.points.join(', ')}`,
          `\nข้อความจากคลังความรู้:\n${excerpts}`,
        ].join('\n'),
      },
      { role: 'user', content: `ข้อมูลแรกรับ\n${intake.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\nขอสรุปแผนการรักษาลง ม.บ.5` },
    ],
    { max_tokens: 1400, temperature: 0.2, response_format: { type: 'json_schema', json_schema: { name: 'massage_plan', schema: PLAN_SCHEMA } } },
    60000,
  );
  const r = JSON.parse(out) as MassagePlan & { cite: number[] };
  const cited = [...new Set(r.cite)].map((n) => found[n - 1]).filter(Boolean);
  // แหล่งแสดงใต้การ์ดแล้ว → ตัดเลขอ้างอิงในข้อความ · เวลาเป็นตัวเลขล้วน → ใส่หน่วย
  const tidy = (t: string) => t.replace(/\s*\[[\d,\s]+\]/g, '').replace(/[。]/g, '').trim();
  const min = (t: string) => (/^\d+(\s*[–-]\s*\d+)?$/.test(t.trim()) ? `${t.trim()} นาที` : tidy(t));
  return {
    plan: {
      summary: tidy(r.summary),
      cautions: r.cautions.map(tidy),
      style: tidy(r.style),
      minutes: min(r.minutes),
      phases: r.phases.map((ph) => ({ title: tidy(ph.title), minutes: min(ph.minutes), steps: ph.steps.map(tidy) })),
      aftercare: r.aftercare.map(tidy),
    },
    refs: (cited.length ? cited : found.slice(0, 2)).map((pg) => ({ f: pg.f, p: pg.p, quote: quoteAround(pg.t, keywords) })),
  };
}
