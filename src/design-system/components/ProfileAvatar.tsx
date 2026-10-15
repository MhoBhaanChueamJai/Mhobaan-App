import React from 'react';
import { Image, View } from 'react-native';
import AvatarFemale from '../../../assets/avatars/avatar-female.svg';
import AvatarMale from '../../../assets/avatars/avatar-male.svg';
import { staffAvatar } from '../../data/staffAvatars';

/**
 * รูปโปรไฟล์ผู้ใช้ — ภาพประกอบ "Notionists" (Zoish via DiceBear, CC0) จาก ThaiWell back-office
 * ต้นแบบ: เลือกตามเพศในบัญชี · รูปถ่ายของผู้ใช้ (data URI / file) ใช้แทนได้ · กรอบวงกลมขาวแบบแก้ว
 */
export function ProfileAvatar({ sex, size = 52, photo }: { sex?: string; size?: number; photo?: string }) {
  // avatar ที่คลินิกเลือกให้ผู้บำบัด ("avatar:t3") · ไม่มี = ตามเพศ
  const Art = staffAvatar(photo) ?? (sex === 'หญิง' ? AvatarFemale : AvatarMale);
  const picture = photo && !photo.startsWith('avatar:') ? photo : undefined;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)',
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      {picture ? <Image source={{ uri: picture }} style={{ width: size - 4, height: size - 4 }} resizeMode="cover" /> : <Art width={size - 4} height={size - 4} />}
    </View>
  );
}
