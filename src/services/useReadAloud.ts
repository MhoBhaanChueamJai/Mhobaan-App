import React from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { speakParts } from './voiceAI';
import { playWeb, stopWeb } from './webAudio';

const WEB = Platform.OS === 'web';

/**
 * อ่านข้อความของ AI ออกเสียง (โหมดพิมพ์/แตะ — ไม่เปิดไมค์) · เสียงเดียวกับโหมดคุยด้วยเสียง (vox-cpm)
 * ข้อความใหม่มา = หยุดอันเดิมแล้วอ่านอันใหม่ · ผู้เรียกต้องตัดชื่อผู้ใช้ออกก่อน (spokenOf)
 * ทีละประโยค: สร้างเสียงทุกประโยคพร้อมกัน เล่นประโยคแรกทันทีที่ได้ (ไม่รอทั้งข้อความ)
 * ใช้ตัวเล่นตัวเดียวตลอด (หยุด = pause ไม่ทิ้งตัวเล่น) — iOS: ทิ้งตัวเล่นตอนไมค์กำลังเริ่มอัด ทำให้ไมค์อัดได้แต่ความเงียบ
 */
export function useReadAloud() {
  const [speaking, setSpeaking] = React.useState(false);
  const player = React.useRef<AudioPlayer | null>(null);
  const turn = React.useRef(0);
  const stop = React.useCallback(() => {
    turn.current++;
    if (WEB) stopWeb();
    try {
      player.current?.pause();
    } catch {
      /* ปล่อยไปแล้ว */
    }
    setSpeaking(false);
  }, []);
  const playOne = (uri: string, my: number) =>
    new Promise<void>((resolve) => {
      if (my !== turn.current) return resolve();
      // เว็บ: <audio> ตัวเดียวที่ปลดล็อกจากการแตะ (Safari บน iPhone)
      if (WEB) return void playWeb(uri, () => my === turn.current).then(resolve);
      const p = (player.current ??= createAudioPlayer(null));
      const sub = p.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish || my !== turn.current) {
          sub.remove();
          resolve();
        }
      });
      p.replace({ uri });
      p.play();
      // กันค้าง: เสียงไม่จบเอง / ถูกหยุด
      const guard = setInterval(() => {
        if (my !== turn.current) {
          clearInterval(guard);
          sub.remove();
          resolve();
        }
      }, 200);
      setTimeout(() => clearInterval(guard), 30000);
    });
  const say = React.useCallback(
    async (text: string) => {
      stop();
      const my = turn.current;
      if (!text.trim()) return;
      setSpeaking(true);
      const parts = speakParts(text);
      for (let i = 0; i < parts.length; i++) {
        const uri = await parts[i];
        // ถูกหยุด/มีข้อความใหม่ระหว่างรอ (เช่น เปิดไมค์) → ไม่แตะระบบเสียงอีก
        if (my !== turn.current) return;
        if (!uri) continue;
        if (i === 0) await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
        if (my !== turn.current) return;
        await playOne(uri, my);
      }
      if (my === turn.current) setSpeaking(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stop],
  );
  React.useEffect(
    () => () => {
      turn.current++;
      try {
        player.current?.remove();
      } catch {
        /* ปล่อยไปแล้ว */
      }
      player.current = null;
    },
    [],
  );
  return { say, stop, speaking };
}
