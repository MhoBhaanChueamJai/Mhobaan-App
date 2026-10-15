import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Icon, Text, radius, space, useTheme } from '../../../design-system';
import type { ThreadCard } from '../../../data/homeFeed';
import { missingFields } from '../../../data/mb5';
import { PillButton } from './ThreadCards';

/**
 * การ์ดทะเบียนการรักษา ม.บ.5 ในแชท — ได้จากเสียงที่หมอเล่า (หน้าตาเดียวกับการ์ดสรุปในแชท)
 * สัญญาณอันตราย → โทร 1669 / ส่งต่อโรงพยาบาล · ช่องที่ยังว่าง → AI ถามต่อด้วยเสียง
 */
export function Mb5Card({ card, onRefer, onSave }: { card: Extract<ThreadCard, { type: 'mb5' }>; onRefer: () => void; onSave: () => void }) {
  const { colors } = useTheme();
  const [saved, setSaved] = React.useState(false);
  const [showStory, setShowStory] = React.useState(false);
  const { rec, flags } = card;
  const missing = missingFields(rec);
  const emergency = flags.some((f) => f.emergency);
  const row = (label: string, value?: string) =>
    value ? (
      <View key={label} style={{ flexDirection: 'row', gap: space[3] }}>
        <Text variant="bodyXs" tone="secondary" style={{ width: 92 }}>
          {label}
        </Text>
        <Text variant="bodySm" style={{ flex: 1 }}>
          {value}
        </Text>
      </View>
    ) : null;
  return (
    <View style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: flags.length ? colors.status.danger.border : colors.border.subtle }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon name="file-text" size="sm" color={colors.brand.primary} />
        <Text variant="titleSm" style={{ flex: 1 }}>
          ทะเบียนการรักษา ม.บ.5
        </Text>
        <Text variant="labelSm" tone="secondary">
          {card.by === 'ai' ? 'เติมจากเสียง' : 'ตรวจทานด้วย'}
        </Text>
      </View>

      {flags.length ? (
        <View style={{ gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.status.danger.bg }}>
          {flags.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: space[2] }}>
              <Icon name="alert-triangle" size="xs" color={colors.status.danger.fg} />
              <Text variant="bodySm" color={colors.status.danger.fg} style={{ flex: 1 }}>
                {f.title} · {f.advice}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space[2] }}>
        {row('อาการ', rec.symptom)}
        {row('ตรวจร่างกาย', rec.physicalExam)}
        {row('วินิจฉัย', [rec.localDisease, rec.diagnosis].filter(Boolean).join(' · '))}
        {row('การรักษา', rec.treatment)}
        {row('กรรมวิธี', rec.methods.join(', '))}
        {row('สมุนไพรหลัก', rec.herbs.map((h) => (h.local !== h.std ? `${h.local} (${h.std})` : h.std)).join(', '))}
        {row('ผล', rec.result)}
        {row('นัดติดตาม', rec.followUpDays > 0 ? `อีก ${rec.followUpDays} วัน` : rec.followUpDays === 0 ? 'ไม่นัด' : undefined)}
        {row('หมายเหตุ', rec.note)}
      </View>
      {rec.herbs
        .filter((h) => h.warn)
        .map((h) => (
          <Text key={h.std} variant="bodyXs" color={colors.status.warning.fg}>
            ⚠ {h.std}: {h.warn}
          </Text>
        ))}
      {missing.length ? (
        <Text variant="bodyXs" tone="secondary">
          ยังขาด: {missing.join(' · ')} — เล่าเพิ่มได้เลย
        </Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setShowStory((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <Text variant="labelMd" style={{ color: colors.brand.primary }}>
          คำที่พ่อหมอเล่า
        </Text>
        <Icon name={showStory ? 'chevron-up' : 'chevron-down'} size="xs" color={colors.brand.primary} />
      </Pressable>
      {showStory ? (
        <Text variant="bodySm" tone="secondary" style={{ fontStyle: 'italic' }}>
          “{rec.story}”
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {emergency ? <PillButton label="โทร 1669" icon="phone-call" onPress={() => void Linking.openURL('tel:1669')} /> : null}
        {flags.length ? <PillButton label="ส่งต่อโรงพยาบาล" icon="send" tone={emergency ? 'light' : 'dark'} onPress={onRefer} /> : null}
        <PillButton
          label={saved ? 'บันทึกแล้ว' : 'บันทึกลงทะเบียน'}
          icon={saved ? 'check' : 'save'}
          tone={flags.length || saved ? 'light' : 'dark'}
          onPress={() => {
            if (saved) return;
            setSaved(true);
            onSave();
          }}
        />
      </View>
    </View>
  );
}
