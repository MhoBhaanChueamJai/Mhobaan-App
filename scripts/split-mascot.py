"""
แยกภาพน้องประคบของธาตุเป็นชั้นสำหรับ animation (components/Mascot.tsx → ElementMascotAnimated)
  prakob-element-<k>-still.svg   = ทั้งตัว ยกเว้นชิ้นที่ขยับ
  prakob-element-<k>-<ชั้น>.svg  = ชิ้นที่ขยับ (ผืนผ้าใบเดียวกัน 240×240 วางซ้อนตรงตำแหน่ง ตามลำดับใน LAYERS)
แก้ภาพใน Figma แล้ว export ทับ prakob-element-<k>.svg → รันใหม่: python3 scripts/split-mascot.py
"""
import re
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent / 'assets' / 'mascot'


def group_end(s: str, start: int) -> int:
    """ตำแหน่งหลัง </g> ที่ปิด <g ...> ที่ start (นับ g ซ้อน)"""
    depth = 0
    for m in re.finditer(r'<g\b[^>]*?(/?)>|</g>', s[start:]):
        tok = m.group(0)
        if tok.startswith('</g'):
            depth -= 1
            if depth == 0:
                return start + m.end()
        elif not tok.endswith('/>'):
            depth += 1
    raise ValueError('ไม่พบ </g>')


def take(s: str, pattern: str) -> tuple[str, str]:
    """ตัดชิ้นที่ตรง pattern ออก (หรือ group:<id> = ทั้งกลุ่ม) → (ส่วนที่เหลือ, ชิ้นที่ตัด)"""
    if pattern.startswith('group:'):
        a = s.index(f'<g id="{pattern[6:]}"')
        b = group_end(s, a)
    else:
        m = re.search(pattern, s, re.S)
        assert m, pattern
        a, b = m.start(), m.end()
    return s[:a] + s[b:], s[a:b]


# ชั้นที่ขยับต่อธาตุ: ชื่อชั้น → pattern (ลำดับ = ลำดับการวางซ้อน)
LAYERS = {
    'earth': {
        'head': [r'<path d="M120 62V36"[^\n]*\n<path d="M120 45\.9999[^\n]*\n<path d="M120 39\.9998[^\n]*\n'],
    },
    'water': {
        'wave-back': [r'<path id="wave-back"[^>]*/>'],
        'wave-front': [r'<path id="water-surface"[^>]*/>', r'<path id="water-shine"[^>]*/>', r'<circle cx="64" cy="228".*?<circle cx="182"[^>]*/>'],
        'head': ['group:lotus'],
    },
    'wind': {
        'gust': [r'<path d="M70 204C[^\n]*\n<path d="M14 196\.001[^\n]*\n'],
        'leaf-1': [r'<path d="M27\.5723[^\n]*\n<path opacity="0\.6" d="M28\.8579[^\n]*\n'],
        'leaf-2': [r'<path d="M218\.512[^\n]*\n<path opacity="0\.6" d="M217\.209[^\n]*\n'],
        'leaf-3': [r'<path d="M186\.394[^\n]*\n<path opacity="0\.6" d="M185\.916[^\n]*\n'],
        'head': ['group:pinwheel-blades', r'<circle id="pinwheel-pin"[^>]*/>'],
    },
    'fire': {
        'flame-back': [r'<path id="flames-back"[^>]*/>'],
        'flame-mid': [r'<path id="flames-mid"[^>]*/>'],
        'flame-front': [r'<path id="flames-front"[^>]*/>'],
        'sparks': [r'<g id="sparks".*?</g>'],
        'head': ['CANDLE'],
    },
}


def candle(s: str) -> tuple[str, str]:
    # เปลวเทียน + แสงเรือง อยู่ในกลุ่มเทียนที่ถูกย่อ/เลื่อน → ใส่ transform เดียวกัน
    ga = s.index('<g id="candle"')
    tr = re.search(r'transform="([^"]*)"', s[ga: s.index('>', ga)]).group(1)
    got = []
    for pat in (r'<circle id="candle-glow(?:-shape)?"[^>]*/>', r'<path id="candle-flame(?:-shape)?"[^>]*/>', r'<path d="M120 17C122[^>]*/>'):
        s, part = take(s, pat)
        got.append(part)
    # id ของรูปซ้ำกับ id ของสีไล่โทน (candle-flame / candle-glow) → url(#…) ชี้ผิดตัว → ใช้ id ของรูปที่ไม่ซ้ำ
    part = ''.join(got).replace('<circle id="candle-glow"', '<circle id="candle-glow-shape"').replace('<path id="candle-flame"', '<path id="candle-flame-shape"')
    return s, f'<g transform="{tr}">{part}</g>'


for k, layers in LAYERS.items():
    src = (DIR / f'prakob-element-{k}.svg').read_text()
    head = re.match(r'<svg[^>]*>', src).group(0)
    defs = ''.join(re.findall(r'<defs>.*?</defs>', src, re.S))
    still = src
    for name, patterns in layers.items():
        parts = []
        for pat in patterns:
            if pat == 'CANDLE':
                still, part = candle(still)
            else:
                still, part = take(still, pat)
            parts.append(part)
        (DIR / f'prakob-element-{k}-{name}.svg').write_text(f'{head}\n{"".join(parts)}\n{defs}\n</svg>\n')
    (DIR / f'prakob-element-{k}-still.svg').write_text(still)
    print(k, ', '.join(layers))
