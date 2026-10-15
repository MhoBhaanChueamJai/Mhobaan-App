/**
 * เว็บ: เล่นเสียง AI ด้วย <audio> ตัวเดียวตลอด
 * Safari บน iPhone เล่นเสียงได้เฉพาะ element ที่เคยเริ่มเล่นจากการแตะ — เสียงของ AI มาหลังโหลดเสร็จ (ไม่ได้อยู่ในจังหวะแตะ) จึงถูกบล็อก
 * → แตะครั้งแรกบนหน้า = เล่นเสียงเงียบสั้น ๆ ปลดล็อก element นี้ไว้ แล้วใช้ตัวนี้เล่นทุกท่อน (expo-audio บนเว็บสร้าง element ใหม่ทุกครั้งที่เปลี่ยนเสียง)
 */
let el: HTMLAudioElement | null = null;
let unlocked = false;

/** WAV เงียบ ~0.05 วิ */
function silentWav() {
  const n = 400;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...b))}`;
}

const audio = () => (el ??= new Audio());

function unlock() {
  if (unlocked || typeof Audio === 'undefined') return;
  const a = audio();
  if (!a.paused) return;
  a.src = silentWav();
  a.play().then(
    () => (unlocked = true),
    () => undefined,
  );
}
if (typeof document !== 'undefined') {
  for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, { capture: true });
}

/** เล่นจนจบ / ผิดพลาด / ถูกหยุด (alive() = false) */
export function playWeb(uri: string, alive: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const a = audio();
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      clearInterval(guard);
      a.onended = null;
      a.onerror = null;
      resolve();
    };
    const guard = setInterval(() => {
      if (!alive()) {
        a.pause();
        end();
      }
    }, 200);
    a.onended = end;
    a.onerror = end;
    a.src = uri;
    a.play().catch(end);
  });
}

export const stopWeb = () => el?.pause();
