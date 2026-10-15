import React from 'react';
import { Linking, View } from 'react-native';
import { BottomSheet, Button, Icon, Panel, Text, TINT, useTheme } from '../../../design-system';
import { space } from '../../../design-system/tokens';
import { SHORT_CAUTION, type ThreadCard } from '../../../data/homeFeed';
import { procedureGates } from '../../../services/safetyEngine';
import { useJourney } from '../../../state/JourneyContext';

type SafetyCard = Extract<ThreadCard, { type: 'safety' }>;

/**
 * ผลตรวจสัญญาณอันตราย (bottom sheet จากแชท) — ตอบ 3 คำถามของหมอตามลำดับ
 * 1) วันนี้รักษาคนไข้เองได้ไหม (สรุปผลเดียว) → 2) พบอะไร จากข้อมูลไหน และหมอควรปรับอย่างไร → 3) ทำอะไรต่อ
 * ควรส่งต่อ → สิ่งที่ควรทำตอนนี้ + อาการที่ต้องโทร 1669 · ไม่แสดงแหล่งอ้างอิงในหน้า (ใช้ในเกณฑ์เท่านั้น)
 */
export function SafetySheet({
  card,
  reason,
  visible,
  onClose,
  onBook,
  onHospital,
}: {
  card: SafetyCard | null;
  /** เหตุที่ควรส่งต่อ (เช่น ผลประเมินอาการ) — มาจากปุ่ม "ดูคำแนะนำ" */
  reason?: string;
  visible: boolean;
  onClose: () => void;
  onBook?: () => void;
  onHospital: () => void;
}) {
  const { colors } = useTheme();
  const { safety, profile, lastAssess, log } = useJourney();
  const level = card?.level ?? (reason ? 'red' : safety.level);
  const items = card?.items ?? [];
  // สิ่งที่หมอควรปรับ: ข้อความเต็มจากกฎ (โปรไฟล์) หรือข้อความสั้นของกฎ
  const actionOf = (id: string) => safety.hits.find((h) => h.ruleId === id)?.action ?? SHORT_CAUTION[id];
  // หัตถการเสริมที่ต้องงด (อบ/ประคบสมุนไพร) — แยกจากการนวด
  const gates = level === 'red' ? [] : procedureGates(profile).filter((g) => !g.allowed);
  const tone = level === 'red' ? colors.status.danger : level === 'amber' ? colors.status.warning : colors.status.success;
  const verdict =
    level === 'red'
      ? { icon: 'x-octagon' as const, title: 'ควรส่งต่อโรงพยาบาล', sub: 'ให้แพทย์ตรวจก่อน แล้วค่อยกลับมารักษาต่อ' }
      : level === 'amber'
        ? { icon: 'alert-triangle' as const, title: 'รักษาได้ โดยปรับวิธีให้เหมาะ', sub: `พบ ${items.length || safety.hits.length} ข้อที่หมอควรระวัง` }
        : { icon: 'check-circle' as const, title: 'รักษาได้ตามปกติ', sub: 'ไม่พบสัญญาณอันตรายจากที่เล่ามา' };
  const used = [
    lastAssess ? `อาการ: ${lastAssess.symptoms.join(', ') || '-'} · ปวด ${lastAssess.pain}/10` : '',
    `โรคประจำตัว: ${profile.conditions.join(', ') || 'ไม่มี'}`,
    `ยาที่ใช้: ${profile.medications.join(', ') || 'ไม่มี'}`,
  ].filter(Boolean);
  const call1669 = () => {
    log('หมอ', 'โทรฉุกเฉิน 1669');
    Linking.openURL('tel:1669').catch(() => {});
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="ผลตรวจสัญญาณอันตราย"
      heightRatio={0.86}
      footer={
        level === 'red' ? (
          <View style={{ gap: space[2] }}>
            <Button label="ส่งต่อโรงพยาบาล" iconLeft="map-pin" onPress={onHospital} />
            <Button label="โทร 1669 (ฉุกเฉิน)" variant="secondary" iconLeft="phone" onPress={call1669} />
          </View>
        ) : onBook ? (
          <Button label="นัดคนไข้" iconLeft="calendar" onPress={onBook} />
        ) : null
      }
    >
      {/* 1) สรุปผลเดียว: นวดได้ไหม */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: 20, backgroundColor: tone.bg }}>
        <Icon name={verdict.icon} size="lg" color={tone.fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleMd" color={tone.fg}>
            {verdict.title}
          </Text>
          <Text variant="bodySm" color={tone.fg}>
            {verdict.sub}
          </Text>
        </View>
      </View>

      {/* ยังไม่ได้บอกโรคประจำตัว/ยา → บอกตรง ๆ ว่าผลยังไม่ครบ */}
      {profile.healthKnown === false ? (
        <Panel icon="info" tint={TINT.amber} title="ยังไม่มีโรคประจำตัวและยาของคนไข้">
          <Text variant="bodySm" tone="secondary">
            หมอควรถามคนไข้เพิ่มก่อนรักษา
          </Text>
        </Panel>
      ) : null}

      {/* 2) พบอะไร · จากข้อมูลไหน · หมอควรทำอย่างไร */}
      {reason || items.length ? (
        <Panel icon="search" tint={level === 'red' ? TINT.red : TINT.amber} title="สิ่งที่พบ">
          {reason ? (
            <Text variant="bodyMd" style={{ fontWeight: '600' }}>
              {reason}
            </Text>
          ) : null}
          {items.map((it) => {
            const act = level === 'red' ? undefined : actionOf(it.id);
            return (
              <View key={it.id} style={{ gap: 4 }}>
                <Text variant="bodyMd" style={{ fontWeight: '600' }}>
                  {it.title}
                </Text>
                {it.evidence && it.evidence !== it.title ? (
                  <Text variant="bodySm" tone="secondary">
                    {it.evidence}
                  </Text>
                ) : null}
                {act ? (
                  <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                    <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                    <Text variant="bodySm" style={{ flex: 1 }}>
                      หมอควร{act}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Panel>
      ) : null}

      {/* หัตถการเสริมที่ต้องงด */}
      {gates.length ? (
        <Panel icon="slash" tint={TINT.amber} title="ครั้งนี้งด">
          {gates.map((g) => (
            <Text key={g.procedure} variant="bodySm">
              {g.procedure} · เพราะ{g.reasons.join(', ')}
            </Text>
          ))}
        </Panel>
      ) : null}

      {/* 3) ไม่ควรนวด → สิ่งที่ทำได้ตอนนี้ + อาการฉุกเฉิน */}
      {level === 'red' ? (
        <>
          <Panel icon="list" tint={TINT.green} title="ควรทำอย่างไรต่อ">
            {['ส่งต่อคนไข้ไป รพ.สต.บ้านค้อ หรือโรงพยาบาล', 'ใบส่งต่อแนบอาการที่พบด้านบนให้แพทย์', 'แพทย์ตรวจแล้ว รับคนไข้กลับมารักษาต่อได้'].map((t, i) => (
              <View key={t} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <Text variant="labelSm" tone="secondary" style={{ width: 16 }}>
                  {i + 1}.
                </Text>
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {t}
                </Text>
              </View>
            ))}
          </Panel>
          <Panel icon="phone" tint={TINT.red} title="โทร 1669 ทันทีถ้ามีอาการเหล่านี้">
            <Text variant="bodySm" tone="secondary">
              ชาหรืออ่อนแรงครึ่งซีก พูดไม่ชัด เจ็บแน่นหน้าอก ปวดศีรษะรุนแรงเฉียบพลัน
            </Text>
          </Panel>
        </>
      ) : null}

      {/* ข้อมูลที่ใช้ตรวจ — ให้รู้ว่าผลมาจากอะไร และแก้ได้ถ้าไม่ตรง */}
      <Panel icon="file-text" tint={TINT.slate} title="ข้อมูลคนไข้ที่ใช้ตรวจ">
        {used.map((u) => (
          <Text key={u} variant="bodySm" tone="secondary">
            {u}
          </Text>
        ))}
      </Panel>
    </BottomSheet>
  );
}
