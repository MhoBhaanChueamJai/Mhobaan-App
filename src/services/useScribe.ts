import React from 'react';
import { AudioQuality, IOSOutputFormat, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { transcribe } from './voiceAI';

/**
 * อัดบทสนทนาระหว่างหมอกับคนไข้ (flow หลักของการบันทึก ม.บ.5 · Spec flow A / FR-21) — ใช้กับไมค์ในช่องแชท
 * ------------------------------------------------------------------
 * หมอแตะไมค์ แล้ววางมือถือไว้ระหว่างรักษา → อัดต่อเนื่อง ตัดเป็นช่วง ๆ ส่งถอดเสียงระหว่างอัด (ข้อความทยอยขึ้น)
 * แตะลูกแก้วอีกครั้ง = จบ → ส่งบทสนทนาทั้งหมดให้ AI แยกเป็นช่อง ม.บ.5 (onDone) · ถามเฉพาะช่องที่ยังขาดต่อในแชท
 * simulated = เครื่องที่ไม่มีไมค์ (iOS Simulator) → จำลองการอัด แล้วใช้บทสนทนาตัวอย่าง
 * ⚠️ prototype: ยังไม่เก็บไฟล์เสียงต้นฉบับ (Spec: เก็บคู่บันทึก เห็นเฉพาะหมอเจ้าของ)
 */
export type ScribePhase = 'off' | 'starting' | 'recording' | 'finishing' | 'error';

const REC_OPTIONS = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: { extension: '.wav', outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.MAX, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  android: { extension: '.m4a', outputFormat: 'mpeg4' as const, audioEncoder: 'aac' as const },
  web: { mimeType: 'audio/webm' },
};
/** ตัดช่วงอัดทุกกี่วินาที (ถอดเสียงทีละช่วงระหว่างอัด) */
const CHUNK_SEC = 40;
const ASR_HINT = { question: 'บทสนทนาระหว่างหมอพื้นบ้านกับคนไข้ระหว่างรักษา อาจเป็นภาษาอีสาน เหนือ หรือใต้ คำที่พบบ่อย: เจ็บ ปวด บวม ไข้ งูกัด นวด เส้น ประคบ ปูเลย ไพล ขมิ้น พอก ยาต้ม นัด' };

/** บทสนทนาตัวอย่าง (ใช้เดโม/ทดสอบบนเครื่องที่ไม่มีไมค์) */
export const DEMO_DIALOGUE =
  'หมอ: เป็นจั่งใด๋มาแม่ใหญ่ · คนไข้: เจ็บแอวข้างซ้ายมาสามมื้อแล้วหมอ ไปเฮ็ดนาก้มโดนๆ · หมอ: มีไข้บ่ · คนไข้: บ่มีจ้า · หมอ: ขอจับเบิ่งเด้อ เส้นหลังซ้ายตึงแข็งอยู่ ก้มได้เคิ่งเดียว อันนี้เส้นตึง · หมอ: สิบีบนวดเส้นให้ซาวนาที แล้วประคบปูเลยกับขมิ้นเด้อ · คนไข้: แม่นแล้ว เบาลงหลายเด้อหมอ · หมอ: มาเบิ่งอีกสามมื้อเด้อ';

export function useScribe(onDone: (transcript: string, seconds: number) => void, simulated = false) {
  const recorder = useAudioRecorder(REC_OPTIONS);
  const [phase, setPhaseState] = React.useState<ScribePhase>('off');
  const phaseRef = React.useRef<ScribePhase>('off');
  const setPhase = (p: ScribePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [secs, setSecs] = React.useState(0);
  const secsRef = React.useRef(0);
  const [parts, setParts] = React.useState<string[]>([]);
  const partsRef = React.useRef<string[]>([]);
  const [hint, setHint] = React.useState<string | null>(null);
  const pending = React.useRef<Promise<void>[]>([]);
  const chunkAt = React.useRef(0);
  const alive = React.useRef(true);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;
  const putParts = (fn: (p: string[]) => string[]) => {
    partsRef.current = fn(partsRef.current);
    setParts(partsRef.current);
  };
  const isRec = () => {
    try {
      return alive.current && recorder.isRecording;
    } catch {
      return false;
    }
  };
  React.useEffect(
    () => () => {
      const rec = isRec();
      alive.current = false;
      if (rec) void Promise.resolve().then(() => recorder.stop()).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** ส่งไฟล์ช่วงที่อัดเสร็จไปถอดเสียง (ลำดับคงเดิมตามช่วง) */
  const queue = (uri: string | null | undefined) => {
    if (!uri) return;
    const i = partsRef.current.length;
    putParts((p) => [...p, '…']);
    pending.current.push(
      transcribe(uri, ASR_HINT)
        .then((t) => {
          if (alive.current) putParts((p) => p.map((x, j) => (j === i ? t || '(ฟังไม่ชัด)' : x)));
        })
        .catch(() => {
          if (alive.current) putParts((p) => p.map((x, j) => (j === i ? '(ถอดเสียงช่วงนี้ไม่ได้)' : x)));
        }),
    );
  };
  const begin = async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
    chunkAt.current = 0;
  };
  // นับเวลา + ตัดช่วงทุก CHUNK_SEC วินาที
  React.useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => {
      secsRef.current += 1;
      setSecs(secsRef.current);
      if (simulated) return;
      chunkAt.current += 1;
      if (chunkAt.current >= CHUNK_SEC) {
        chunkAt.current = 0;
        void (async () => {
          await recorder.stop().catch(() => undefined);
          queue(recorder.uri);
          await begin().catch(() => setPhase('error'));
        })();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const reset = () => {
    secsRef.current = 0;
    setSecs(0);
    partsRef.current = [];
    setParts([]);
    pending.current = [];
  };
  const start = async () => {
    if (phaseRef.current === 'recording' || phaseRef.current === 'starting' || phaseRef.current === 'finishing') return;
    setHint(null);
    reset();
    setPhase('starting');
    if (simulated) return setPhase('recording');
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setPhase('error');
      return setHint('ยังไม่ได้อนุญาตไมโครโฟน · เปิดได้ที่ การตั้งค่า > MohbanHealth');
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await begin();
      setPhase('recording');
    } catch {
      setPhase('error');
      setHint('เปิดไมโครโฟนไม่ได้ แตะไมค์ลองใหม่');
    }
  };
  /** จบการอัด → รอถอดเสียงครบทุกช่วง → onDone */
  const finish = async () => {
    if (phaseRef.current !== 'recording') return;
    setPhase('finishing');
    const s = secsRef.current;
    if (simulated) {
      await new Promise((r) => setTimeout(r, 900));
      setPhase('off');
      reset();
      return doneRef.current(DEMO_DIALOGUE, Math.max(s, 1));
    }
    await recorder.stop().catch(() => undefined);
    queue(recorder.uri);
    await Promise.all(pending.current);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    const text = partsRef.current.filter((x) => x && !x.startsWith('(') && x !== '…').join(' ');
    if (!alive.current) return;
    reset();
    if (!text.trim()) {
      setPhase('error');
      return setHint('ไม่ได้ยินบทสนทนา แตะไมค์อัดใหม่');
    }
    setPhase('off');
    doneRef.current(text, s);
  };
  /** ยกเลิก: หยุดอัด ไม่ส่งผล */
  const cancel = async () => {
    if (isRec()) await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    reset();
    setHint(null);
    setPhase('off');
  };

  /** ระดับเสียงสำหรับคลื่นแสง: เทียบกับเสียงพื้นหลัง (ลงเร็ว ขึ้นช้า) → เสียงแวดล้อมไม่ทำให้คลื่นขึ้น */
  const floor = React.useRef(-50);
  const level = (): number => {
    if (phaseRef.current !== 'recording') return 0;
    if (simulated) {
      const t = Date.now() / 1000;
      return 0.3 + 0.35 * Math.abs(Math.sin(t * 5.1) * Math.sin(t * 1.7 + 1));
    }
    let m: number | undefined;
    try {
      m = recorder.getStatus().metering;
    } catch {
      return 0;
    }
    const v = m ?? -160;
    if (v < floor.current) floor.current = floor.current * 0.6 + v * 0.4;
    else floor.current += Math.min(v - floor.current, 4) * 0.01;
    return Math.max(0, Math.min(1, (v - floor.current - 6) / 26));
  };

  return { phase, secs, parts, hint, start, finish, cancel, level };
}
export type Scribe = ReturnType<typeof useScribe>;
