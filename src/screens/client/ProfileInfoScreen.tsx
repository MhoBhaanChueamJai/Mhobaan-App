import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppBar, BottomSheet, Button, ElementMascotIcon, Icon, InfoRow, Panel, ProfileAvatar, RowLink, Screen, Tag, Text, TextField, TINT, space, useTheme } from '../../design-system';
import { ELEMENT_INFO, dominantElement } from '../../data/thaiMassageKnowledge';
import { AVATAR_KEYS, defaultAvatar } from '../../data/staffAvatars';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { saveAvatar, savePhone as savePhoneCloud } from '../../services/auth';
import { cleanAddress, validPhone } from '../../services/idCard';

/** เลขบัตรประชาชน: แสดงแค่ 4 ตัวท้าย (ข้อมูลอ่อนไหว) */
const maskId = (id: string) => (id.length === 13 ? `x-xxxx-xxxxx-${id.slice(10, 12)}-${id.slice(12)}` : '-');

/**
 * ที่อยู่ตามบัตร → บรรทัดตามส่วนของที่อยู่: เลขที่ หมู่ ซอย ถนน / ตำบล(แขวง) อำเภอ(เขต) / จังหวัด
 * ที่อยู่จากบัตรมักติดกันเป็นสายยาว → แยกที่คำนำหน้าแต่ละส่วนก่อน แล้วจัดเป็นบรรทัด
 */
const addressLines = (a?: string): string[] => {
  if (!a) return ['-'];
  const KEY = /(หมู่ที่|หมู่|ม\.|ซอย|ซ\.|ถนน|ถ\.|ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)/;
  const parts = cleanAddress(a)
    .replace(new RegExp(`\\s*${KEY.source}\\s*`, 'g'), '\n$1')
    .split('\n')
    .map((x) => x.replace(/^(หมู่ที่|หมู่)(\d)/, '$1 $2').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const area = /^(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต)/;
  const prov = /^(จังหวัด|จ\.)/;
  const lines: string[][] = [[], [], []];
  for (const p of parts) {
    // ไม่มีคำว่าจังหวัด (เช่น "เขตคลองเตย กรุงเทพมหานคร") → ส่วนท้ายหลังชื่ออำเภอ/เขต = จังหวัด
    const m = /^((?:อำเภอ|อ\.|เขต)\S+)\s+(.+)$/.exec(p);
    if (m) {
      lines[1].push(m[1]);
      lines[2].push(m[2]);
      continue;
    }
    lines[prov.test(p) ? 2 : area.test(p) ? 1 : 0].push(p);
  }
  return lines.map((l) => l.join(' ')).filter(Boolean);
};

/**
 * ข้อมูลส่วนตัวของพ่อหมอ
 * รูปโปรไฟล์ = แก้ได้ (ถ่ายภาพ / เลือกจากคลังภาพ · หรือเลือก avatar)
 * ตามบัตรประชาชน (ชื่อ เลขบัตร วันเกิด เพศ ที่อยู่/พื้นที่) = ดูได้อย่างเดียว — ใช้จับคู่หนังสือรับรอง ม.บ.3 แก้ผ่าน สสจ.
 * เบอร์โทร = แก้ได้ (รพ.สต. ใช้ติดต่อ) · อีเมล = ใช้เข้าสู่ระบบ (ไม่แก้ในหน้านี้)
 */
export function ProfileInfoScreen() {
  const nav = useNav();
  const { account, setAccount, client, profile, log, elements, elementsDone, newPatient } = useJourney();
  // ธาตุเจ้าเรือน (คนใหม่ที่ยังไม่ได้ประเมิน = ยังไม่มี)
  const element = newPatient && !elementsDone ? null : dominantElement(elements);
  const c = account?.idCard;
  const { colors } = useTheme();
  const [pickAvatar, setPickAvatar] = React.useState(false);
  // แตะวงกลมแรก → ถามว่าถ่ายภาพหรือเลือกจากคลังภาพ
  const [askSource, setAskSource] = React.useState(false);
  const [photoNote, setPhotoNote] = React.useState<string | null>(null);
  const closePicker = () => (setPickAvatar(false), setAskSource(false), setPhotoNote(null));
  /** รูปถ่าย → ตัดสี่เหลี่ยมจัตุรัส → เก็บเป็น data URI ในเครื่อง (ไม่ส่งไป cloud/หน่วยบริการ · หน่วยบริการยังเห็น avatar) */
  const pickPhoto = async (fromCamera: boolean) => {
    if (!account) return;
    setPhotoNote(null);
    const perm = Platform.OS === 'web' ? { granted: true } : fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setPhotoNote(fromCamera ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดได้ที่ การตั้งค่า › หมอบ้านเชื่อมใจ' : 'ไม่ได้รับอนุญาตให้เข้าถึงรูปภาพ');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true, cameraType: ImagePicker.CameraType.front };
    const r = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? undefined : r.assets[0];
    if (!a) return;
    const photo = a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
    setAccount({ ...account, photo });
    log('พ่อหมอ', 'เปลี่ยนรูปโปรไฟล์');
    closePicker();
  };
  const [editPhone, setEditPhone] = React.useState(false);
  const [phone, setPhone] = React.useState(c?.phone ?? '');
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const savePhone = async () => {
    const p = phone.replace(/\D/g, '');
    if (!validPhone(p)) return setErr('เบอร์โทรไม่ถูกต้อง');
    if (!account || !c) return;
    setSaving(true);
    try {
      if (account.userId) await savePhoneCloud(account.userId, p);
      setAccount({ ...account, idCard: { ...c, phone: p } });
      log('พ่อหมอ', 'แก้ไขเบอร์โทร');
      setEditPhone(false);
    } catch {
      setErr('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen header={<AppBar title="ข้อมูลพ่อหมอ" onBack={() => nav.goBack()} />}>
      {/* รูปโปรไฟล์ (แตะ = เลือกรูป · หน่วยบริการเห็นรูปเดียวกัน) */}
      <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[2] }}>
        <Pressable accessibilityRole="button" accessibilityLabel="เปลี่ยนรูปโปรไฟล์" onPress={() => setPickAvatar(true)} disabled={!account}>
          <ProfileAvatar sex={account?.sex ?? 'ชาย'} size={96} photo={account?.avatar} />
          {account ? (
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' }}>
              <Icon name="edit-2" size="xs" color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
        <Text variant="titleLg">{client.name}</Text>
      </View>
      <Panel title="ตามบัตรประชาชน" right={account?.verified ? <Tag text="ยืนยันตัวตนแล้ว" tone="good" /> : undefined}>
        <View style={{ gap: space[3] }}>
          <InfoRow k="ชื่อ-นามสกุล" v={c ? `${c.title}${c.firstName} ${c.lastName}` : client.name} />
          <InfoRow k="เลขบัตรประชาชน" v={c ? maskId(c.citizenId) : '-'} />
          <InfoRow k="วันเกิด" v={`${c?.birthDate ?? account?.birthDate ?? '-'} · ${profile.age} ปี`} />
          <InfoRow k="เพศ" v={c?.sex || account?.sex || '-'} />
          {/* ที่อยู่: แถวเดียวกับหัวข้อ ชิดขวา · ขึ้นบรรทัดตามส่วนของที่อยู่ (เลขที่/หมู่/ซอย/ถนน → ตำบล/อำเภอ → จังหวัด) ไม่ตัดกลางชื่อ */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[3] }}>
            <Text variant="bodySm" tone="secondary">
              ที่อยู่
            </Text>
            <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
              {addressLines(c?.address).map((l) => (
                <Text key={l} variant="labelMd" style={{ textAlign: 'right' }}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </Panel>
      <Panel title="ติดต่อ" flush>
        <RowLink icon="phone" tint={TINT.green} title="เบอร์โทร" sub={c?.phone || 'ยังไม่ได้ระบุ'} onPress={account ? () => (setPhone(c?.phone ?? ''), setErr(null), setEditPhone(true)) : undefined} />
        <RowLink icon="mail" tint={TINT.slate} title="อีเมล" sub={account?.email ? `${account.email} · ใช้เข้าสู่ระบบ` : '-'} last />
      </Panel>
      <Panel flush>
        <RowLink icon="clipboard" tint={TINT.slate} title="หนังสือรับรอง ม.บ.3" sub={`${client.hn} · ${client.occupation}`} last />
      </Panel>
      <BottomSheet
        visible={pickAvatar}
        onClose={closePicker}
        title={askSource ? 'เพิ่มรูปของคุณ' : 'เลือกรูปโปรไฟล์'}
        subtitle={askSource ? 'รูปเก็บในเครื่องนี้เท่านั้น หน่วยบริการยังเห็น avatar' : 'รพ.สต. และคนไข้เห็น avatar เดียวกันตอนส่งต่อและตรวจ QR'}
        heightRatio={askSource ? 0.45 : 0.75}
      >
        {askSource ? (
          <View style={{ gap: space[3] }}>
            <Panel flush>
              <RowLink icon="camera" tint={TINT.green} title="ถ่ายภาพ" onPress={() => void pickPhoto(true)} />
              <RowLink icon="image" tint={TINT.blue} title="เลือกจากคลังภาพ" onPress={() => void pickPhoto(false)} last />
            </Panel>
            {photoNote ? (
              <Text variant="bodySm" color={colors.brand.primary}>
                {photoNote}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'center' }}>
            {/* วงแรก: เพิ่มรูปของคุณ (ถ่ายภาพ / เลือกจากคลังภาพ) */}
            <Pressable accessibilityRole="button" accessibilityLabel="ถ่ายภาพหรือเลือกรูปจากเครื่อง" onPress={() => setAskSource(true)} style={{ borderRadius: 40, borderWidth: 3, borderColor: 'transparent', padding: 2 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="camera" size="md" color={colors.brand.primary} />
              </View>
            </Pressable>
            {/* รูปถ่ายที่ใช้อยู่ */}
            {account?.photo ? (
              <View accessibilityRole="radio" accessibilityState={{ selected: true }} accessibilityLabel="รูปของคุณ" style={{ borderRadius: 40, borderWidth: 3, borderColor: colors.brand.primary, padding: 2 }}>
                <ProfileAvatar size={64} photo={account.photo} />
              </View>
            ) : null}
            {AVATAR_KEYS.map((k) => {
              const value = `avatar:${k}`;
              const on = !account?.photo && (account?.avatar ?? defaultAvatar(account?.sex)) === value;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`avatar ${k}`}
                  onPress={() => {
                    if (!account) return;
                    setAccount({ ...account, avatar: value, photo: undefined });
                    if (account.userId) void saveAvatar(account.userId, value).catch(() => undefined);
                    log('พ่อหมอ', 'เปลี่ยนรูปโปรไฟล์');
                    closePicker();
                  }}
                  style={{ borderRadius: 40, borderWidth: 3, borderColor: on ? colors.brand.primary : 'transparent', padding: 2 }}
                >
                  <ProfileAvatar size={64} photo={value} />
                </Pressable>
              );
            })}
          </View>
        )}
      </BottomSheet>
      <BottomSheet visible={editPhone} onClose={() => setEditPhone(false)} title="เบอร์โทร" heightRatio={0.45} footer={<Button label="บันทึก" loading={saving} disabled={saving} onPress={() => void savePhone()} />}>
        <TextField label="เบอร์โทรที่ รพ.สต. ใช้ติดต่อ" value={phone} onChangeText={(v) => (setPhone(v.replace(/[^\d-]/g, '').slice(0, 12)), setErr(null))} keyboardType="phone-pad" error={err ?? undefined} />
      </BottomSheet>
    </Screen>
  );
}
