import React from 'react';
import { Animated } from 'react-native';
import { ChatComposer } from '../../../design-system';
import type { Scribe } from '../../../services/useScribe';

/**
 * ช่องแชท + อัดบทสนทนาการรักษาในช่องเดียวกัน (ไม่สลับเป็นอีกแถบ ให้ลูกแก้ว/กรอบเดิมเปลี่ยนสภาพต่อเนื่อง)
 * ไมค์ = อัดบทสนทนาหมอ–คนไข้ (ไม่มีโหมดพูดสั่ง AI แล้ว) · แตะลูกแก้วอีกครั้ง = จบแล้วสรุป ม.บ.5
 * ระดับไมค์อ่านตรงจาก recorder ทุก ~50ms (ไม่ผ่าน state) → ref ให้เส้นแสง + Animated ให้แสงรอบช่องแชท → ไม่ render ใหม่ ไม่กระตุก
 */
export function VoiceChatDock({ scribe, onSend, fill }: { scribe: Scribe; onSend: (text: string) => void; fill?: { text: string; n: number } }) {
  const level = React.useRef(0);
  const glow = React.useRef(new Animated.Value(0)).current;
  const live = React.useRef(scribe);
  live.current = scribe;
  const { phase, secs, hint } = scribe;
  const on = phase !== 'off';
  React.useEffect(() => {
    if (!on) {
      level.current = 0;
      glow.setValue(0);
      return;
    }
    let smooth = 0;
    const id = setInterval(() => {
      const target = live.current.level();
      smooth += (target - smooth) * (target > smooth ? 0.6 : 0.25);
      level.current = smooth;
      glow.setValue(smooth);
    }, 50);
    return () => clearInterval(id);
  }, [on, glow]);
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const recording = phase === 'recording';
  return (
    <ChatComposer
      fill={fill}
      onSend={onSend}
      onVoice={() => void scribe.start()}
      placeholder="พิมพ์ หรือแตะไมค์อัดบทสนทนาการรักษา…"
      voiceLabel="อัดบทสนทนาการรักษา"
      voice={
        on
          ? {
              mode: phase === 'finishing' || phase === 'starting' ? 'busy' : recording ? 'listening' : 'error',
              status: phase === 'finishing' ? 'กำลังถอดเสียงและสรุป ม.บ.5…' : phase === 'starting' ? 'กำลังเปิดไมค์…' : hint ?? 'อัดไม่สำเร็จ แตะไมค์ลองใหม่',
              level,
              halo: glow,
              muted: false,
              mainIcon: recording ? 'square' : 'mic',
              mainLabel: recording ? 'จบการอัด แล้วสรุป ม.บ.5' : 'อัดบทสนทนาใหม่',
              onMain: () => void (recording ? scribe.finish() : scribe.start()),
              trail: recording ? mmss : undefined,
              actions: phase === 'finishing' ? [] : [{ icon: 'x', label: 'ยกเลิกการอัด', onPress: () => void scribe.cancel() }],
              onExit: () => void scribe.cancel(),
              onMute: () => undefined,
            }
          : undefined
      }
    />
  );
}
