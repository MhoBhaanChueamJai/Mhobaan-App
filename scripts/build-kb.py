"""
สร้างคลังความรู้สำหรับให้ AI ค้น (RAG ในแอป) จาก Knowledge Hub หมอพื้นบ้าน (`knowledge hub/E-book/`)
- ดึงข้อความรายหน้า (PyMuPDF) · ไฟล์ที่ฟอนต์ถอดรหัสผิด ใช้ข้อความ OCR แทน (ส่งพาธมาใน --ocr)
  หรือยกหน้าจากคลังเดิมที่ OCR ไว้แล้ว (--reuse kb.txt เดิม) สำหรับเอกสารใน REUSE
- ฟอนต์ไทยรุ่นเก่า (x-mac-thai ที่ถูกอ่านเป็น Mac Roman เช่น "«à“¥â«¬") → แปลงกลับเป็นไทย (macthai)
- ทำความสะอาดอักขระเพี้ยนจากการถอดฟอนต์ไทย (ę Ě � ² ³ ˑ วรรณยุกต์ซ้ำ)
- ผลลัพธ์: assets/kb/kb.txt — 1 บรรทัด = 1 หน้า (JSON {f: ชื่อเอกสาร, p: หน้า PDF, t: ข้อความ})
ใช้: python scripts/build-kb.py --hub "<โฟลเดอร์ knowledge hub mohbanhealth>/E-book" --reuse path/kb-เดิม.txt
"""
import argparse, glob, json, os, re, sys
import fitz  # PyMuPDF

ROOT = os.path.join(os.path.dirname(__file__), '..')
HUB = os.path.join(ROOT, 'knowledge hub', 'E-book')
OUT = os.path.join(ROOT, 'assets', 'kb', 'kb.txt')

# ชื่อสั้นที่ AI ใช้อ้างอิง (ต้องตรงกับ f ใน src/data/knowledgeTopics.ts)
TITLE = {
    'KH_การแพทย์พื้นบ้าน': 'องค์ความรู้การแพทย์พื้นบ้าน (KH)',
    'ว่าด้วยการแพทย์พื้นบัาน': 'ว่าด้วยการแพทย์พื้นบ้านไทย',
    'เรียนรู้และเข้าใจหมอพื้นบ้าน': 'เรียนรู้และเข้าใจหมอพื้นบ้าน',
    'คู่มือประกอบการรับรองหมอพื้นบ้าน': 'คู่มือประกอบการรับรองหมอพื้นบ้าน',
    'สถานภาพและทิศทางการวิจัยพื้นบ้านด้านสุขภาพ': 'สถานภาพและทิศทางการวิจัยภูมิปัญญาพื้นบ้านด้านสุขภาพ',
    'เกณฑ์มาตรฐานและกรรมวิธีการแพทย์แผนไทย': 'เกณฑ์มาตรฐานและกรรมวิธีการแพทย์แผนไทย',
    'health_profile_publish_2568': 'Health Profile 2568',
    'Health_at_a_glance_2026': 'Health at a Glance 2026',
}

# เอกสารของทีมเอง (Markdown) — แบ่งตามหัวข้อ "## N." → p = เลขหัวข้อ
DOCS = {
    os.path.join(ROOT, 'docs', 'MOHBAN_SPEC.md'): 'ระบบหมอบ้านเชื่อมใจ (Spec)',
}

# ชั้นข้อความใน PDF เสีย (สแกน) → ยกหน้าที่ OCR ไว้แล้วจากคลังเดิมของ ThaiWell (ไฟล์เดียวกัน md5 ตรงกัน)
REUSE = {'เกณฑ์มาตรฐานและกรรมวิธีการแพทย์แผนไทย'}

TONE = '่้๊๋็์'

# อักขระเพี้ยนที่อยู่ระหว่างตัวไทย: บางตัวคือวรรณยุกต์ (ดูจากบริบท เช่น การทĔองเที่ยว = ท่อง) ที่เหลือเป็นขยะ → ตัดทิ้ง
TONE_MAP = {'Ĕ': '่', 'ĕ': '้', 'c': '่', 'f': '้'}
GLYPH = re.compile('(?<=[฀-๿])([^฀-๿\\s\\d.,()\\-:/"“”\'%])(?=[฀-๿])')

# x-mac-thai ช่วง 0x80–0xA0 (วรรณยุกต์/สระตำแหน่งพิเศษ) · 0xA1–0xFB ตรงกับ TIS-620
MAC_THAI = {
    0x80: '«', 0x81: '»', 0x82: '…', 0x83: '่', 0x84: '้', 0x85: '๊', 0x86: '๋', 0x87: '์',
    0x88: '่', 0x89: '้', 0x8A: '๊', 0x8B: '๋', 0x8C: '์', 0x8D: '“', 0x8E: '”', 0x8F: 'ํ',
    0x91: '•', 0x92: 'ั', 0x93: '็', 0x94: 'ิ', 0x95: 'ี', 0x96: 'ึ', 0x97: 'ื',
    0x98: '่', 0x99: '้', 0x9A: '๊', 0x9B: '๋', 0x9C: '์', 0x9D: '‘', 0x9E: '’', 0xA0: ' ',
}

def macthai(s: str) -> str:
    out = []
    for ch in s:
        if ord(ch) < 0x80:
            out.append(ch)
            continue
        try:
            b = ch.encode('mac_roman')[0]
        except UnicodeEncodeError:
            out.append(ch)
            continue
        if b in MAC_THAI:
            out.append(MAC_THAI[b])
        elif 0xA1 <= b <= 0xFB:
            try:
                out.append(bytes([b]).decode('tis-620'))
            except UnicodeDecodeError:
                pass
    return ''.join(out)

def is_legacy(t: str) -> bool:
    th = sum(1 for c in t if '฀' <= c <= '๿')
    hi = sum(1 for c in t if ord(c) >= 0x80 and not '฀' <= c <= '๿')
    return hi > th and hi > 20

def spaced(ln: str) -> bool:
    w = ln.split()
    return len(w) >= 4 and sum(1 for x in w if len(x) <= 2) >= 0.8 * len(w)

def clean(t: str) -> str:
    t = re.sub('[ęĚŠ�²³ˑ­]', '', t)
    t = GLYPH.sub(lambda m: TONE_MAP.get(m.group(1), ''), t)
    t = re.sub(f'([{TONE}ัิ-ฺ])\\1+', r'\1', t)  # สระ/วรรณยุกต์ซ้ำ
    # ฟอนต์รุ่นเก่าบางหน้าเว้นวรรคทุกตัวอักษร (หัวเรื่อง "ว่ า ด้ ว ย") → ต่อกลับ
    t = '\n'.join(re.sub(r'(?<=[ก-๛]) (?=[ก-๛])', '', ln) if spaced(ln) else ln for ln in t.split('\n'))
    t = re.sub(r'([ก-ฮ][่-๋]?) า', r'\1ำ', t)  # สระอำแตกเป็น " า" (ส าคัญ → สำคัญ) — า ไม่ขึ้นต้นคำ
    t = re.sub(r'[ \t ]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n', t)
    return t.strip()

def thai_ratio(t: str) -> float:
    th = sum(1 for c in t if '฀' <= c <= '๿')
    return th / max(1, len(t))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--hub', default=HUB, help='โฟลเดอร์ PDF (ค่าเริ่มต้น knowledge hub/E-book)')
    ap.add_argument('--ocr', action='append', default=[], help='ชื่อไฟล์(ไม่มี .pdf)=พาธข้อความ OCR (มี "=== หน้า N ===")')
    ap.add_argument('--reuse', help='kb.txt เดิมที่มีหน้า OCR ของเอกสารใน REUSE')
    a = ap.parse_args()
    ocr = dict(x.split('=', 1) for x in a.ocr)
    old = []
    if a.reuse:
        old = [json.loads(l) for l in open(a.reuse, encoding='utf8') if l.strip()]
    rows = []
    for path, title in DOCS.items():
        md = open(path, encoding='utf8').read()
        secs = re.findall(r'^## (\d+)\. (.*?)\n(.*?)(?=^## \d+\.|\Z)', md, re.S | re.M)
        for n, head, body in secs:
            t = clean(f'{n}. {head}\n' + body.replace('**', '').replace('| --- ', ''))
            for i in range(0, len(t), 2400):
                rows.append({'f': title, 'p': int(n), 't': t[i:i + 2600]})
        print(f'{title}: {len(secs)} หัวข้อ', file=sys.stderr)
    for pdf in sorted(glob.glob(os.path.join(a.hub, '*.pdf'))):
        stem = os.path.splitext(os.path.basename(pdf))[0]
        title = TITLE.get(stem, stem)
        if stem in REUSE and stem not in ocr:
            got = [r for r in old if r['f'] == title]
            if not got:
                print(f'{title}: ข้าม — ชั้นข้อความเสีย ต้องส่ง --ocr หรือ --reuse', file=sys.stderr)
                continue
            rows += got
            print(f'{title}: {len(got)} ท่อน (จากคลังเดิม)', file=sys.stderr)
            continue
        pages = []
        if stem in ocr:
            txt = open(ocr[stem], encoding='utf8').read()
            for m in re.finditer(r'=== หน้า (\d+) ===\n(.*?)(?==== หน้า|\Z)', txt, re.S):
                pages.append((int(m.group(1)), m.group(2)))
        else:
            d = fitz.open(pdf)
            pages = [(i + 1, d[i].get_text()) for i in range(len(d))]
        kept = 0
        for p, t in pages:
            if is_legacy(t):
                t = macthai(t)
            t = clean(t)
            if len(t) < 120 or thai_ratio(t) < 0.25:
                continue
            # หน้ายาวมาก → แบ่งครึ่ง (ให้ท่อนที่ส่ง AI ไม่ใหญ่เกิน)
            for i in range(0, len(t), 2400):
                rows.append({'f': title, 'p': p, 't': t[i:i + 2600]})
            kept += 1
        print(f'{title}: {kept}/{len(pages)} หน้า', file=sys.stderr)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf8') as o:
        for r in rows:
            o.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'{len(rows)} ท่อน · {os.path.getsize(OUT)/1e6:.1f} MB → {OUT}', file=sys.stderr)

if __name__ == '__main__':
    main()
