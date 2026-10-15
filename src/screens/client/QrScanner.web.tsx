import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import jsQR from 'jsqr';
import { Button, Icon, Text } from '../../design-system';
import { space } from '../../design-system/tokens';

/** ข้อความใน QR เช็กอินของหน่วยบริการ (หลังบ้าน หมอบ้านเชื่อมใจ) */
export const parseCheckinQr = (text: string) => /^THAIWELL-CHECKIN:([A-Z0-9]{6})$/i.exec(text.trim())?.[1]?.toUpperCase() ?? null;

/** มีกล้องให้เบราว์เซอร์ใช้ไหม (ต้องเป็น https หรือ localhost) */
export const qrScanSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/**
 * เว็บ: สแกน QR เช็กอินด้วยกล้องหลังผ่านเบราว์เซอร์ (getUserMedia) แล้วอ่าน QR ในเครื่อง (jsQR) — ภาพไม่ถูกส่งออกไปไหน
 * หน้าตาเดียวกับในแอป · ไม่ได้รับอนุญาต/ไม่มีกล้อง → ให้พิมพ์รหัสแทน
 */
export function QrScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const insets = useSafeAreaInsets();
  const [hint, setHint] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const video = React.useRef<HTMLVideoElement | null>(null);
  const onCodeRef = React.useRef(onCode);
  onCodeRef.current = onCode;

  React.useEffect(() => {
    if (!open) return;
    setHint(null);
    setFailed(false);
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        stream = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        void v.play().catch(() => undefined);
        // อ่านภาพจากกล้องทุก 200ms (ย่อให้ไม่เกิน 640px — เร็วพอ ไม่กินเครื่อง)
        timer = setInterval(() => {
          if (done || !ctx || v.readyState < 2 || !v.videoWidth) return;
          const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * k);
          canvas.height = Math.round(v.videoHeight * k);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (!qr?.data) return;
          const code = parseCheckinQr(qr.data);
          if (!code) {
            setHint('QR นี้ไม่ใช่ QR เช็กอินของหน่วยบริการ (เช่น QR ชำระเงิน) · สแกน QR ที่เขียนว่า “QR เช็กอิน”');
            return;
          }
          done = true;
          onCodeRef.current(code);
        }, 200);
      })
      .catch(() => setFailed(true));
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* iOS Safari: ต้อง playsInline + muted ไม่งั้นเปิดเต็มจอ/ไม่เล่นเอง */}
        {open && !failed
          ? React.createElement('video', { ref: video, playsInline: true, muted: true, autoPlay: true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } })
          : null}
        {/* กรอบเล็ง */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: '#FFFFFF' }} />
        </View>
        <View style={{ position: 'absolute', top: insets.top + space[3], left: space[4], right: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="ปิด" onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" color="#FFFFFF" />
          </Pressable>
          <Text variant="titleSm" color="#FFFFFF">
            สแกน QR เช็กอินที่เคาน์เตอร์
          </Text>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + space[6], left: space[5], right: space[5], gap: space[3] }}>
          {failed ? (
            <>
              <Text variant="bodyMd" color="#FFFFFF" align="center">
                เปิดกล้องไม่ได้ — อนุญาตให้เว็บนี้ใช้กล้องในการตั้งค่าของเบราว์เซอร์ หรือพิมพ์รหัสใต้ QR แทน
              </Text>
              <Button label="พิมพ์รหัสแทน" variant="secondary" onPress={onClose} />
            </>
          ) : (
            <Text variant="bodyMd" color="#FFFFFF" align="center">
              {hint ?? 'ส่องกล้องไปที่ QR บนจอที่เคาน์เตอร์ (เปลี่ยนทุก 30 วินาที)'}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
