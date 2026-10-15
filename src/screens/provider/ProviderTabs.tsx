import React from 'react';
import { View } from 'react-native';
import {
  AppBar,
  Avatar,
  Badge,
  BeforeAfterBars,
  Card,
  Col,
  Divider,
  GridRow,
  HStack,
  ListItem,
  SafetyTag,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
  VStack,
  type SafetyLevel,
} from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ 09 PROVIDER QUEUE (มุมมองเจ้าหน้าที่ รพ.สต. — บันทึกหมอพื้นบ้าน + เคสส่งต่อ) */

interface QueueRow {
  id: string;
  name: string;
  initials: string;
  time: string;
  complaint: string;
  level: SafetyLevel;
  status: 'รอตรวจ' | 'พร้อม' | 'กำลังให้บริการ' | 'เสร็จแล้ว';
  isDemo?: boolean;
}

export function QueueScreen() {
  const nav = useNav();
  const { client, safety, chiefComplaint, followUps } = useJourney();
  const [filter, setFilter] = React.useState('ทั้งหมด');

  const rows: QueueRow[] = [
    { id: 'demo', name: client.name, initials: client.initials, time: '10:30', complaint: chiefComplaint, level: safety.level, status: 'รอตรวจ', isDemo: true },
    { id: '2', name: 'นายคำดี ส.', initials: 'คด', time: '11:00', complaint: 'ฟื้นฟูอัมพฤกษ์ซีกขวา · รพ.ส่งมา', level: 'green', status: 'พร้อม' },
    { id: '3', name: 'นางสมใจ ท.', initials: 'สจ', time: '11:30', complaint: 'เส้นตึง (ปวดเอว) อายุ 62 ปี', level: 'amber', status: 'รอตรวจ' },
    { id: '4', name: 'นายบุญเลิศ ด.', initials: 'บล', time: '09:30', complaint: 'ข้อเท้าแพลง · ยาพอก', level: 'green', status: 'เสร็จแล้ว' },
  ];
  const order: Record<SafetyLevel, number> = { red: 0, amber: 1, green: 2 };
  const sorted = rows
    .filter((r) => (filter === 'ทั้งหมด' ? true : filter === 'ต้องตรวจ' ? r.status === 'รอตรวจ' : r.status === 'เสร็จแล้ว'))
    .sort((a, b) => (a.status === 'เสร็จแล้ว' ? 1 : 0) - (b.status === 'เสร็จแล้ว' ? 1 : 0) || order[a.level] - order[b.level]);

  return (
    <Screen header={<AppBar title="เคสหมอพื้นบ้านวันนี้" subtitle="จนท. รพ.สต.บ้านค้อ · มุมมองเจ้าหน้าที่" onBack={() => nav.navigate('ClientTabs')} />}>
      <GridRow>
        {[
          { l: 'ทั้งหมด', v: '4' },
          { l: 'รอตรวจสัญญาณอันตราย', v: '2' },
          { l: 'Red Flag', v: safety.level === 'red' ? '1' : '0' },
          { l: 'เสร็จแล้ว', v: '1' },
        ].map((k) => (
          <Col key={k.l} span={{ compact: 2, medium: 2, expanded: 3 }}>
            <Card>
              <Text variant="labelSm" tone="secondary">
                {k.l}
              </Text>
              <Text variant="headlineMd">{k.v}</Text>
            </Card>
          </Col>
        ))}
      </GridRow>

      {/* ผลติดตามอาการที่คนไข้ของหมอพื้นบ้านรายงานมา (ก่อน → หลังรักษา) */}
      {followUps.length ? (
        <>
          <SectionHeader title="ติดตามผลหลังรักษา" subtitle="คนไข้รายงานระดับอาการหลังรักษา" />
          <Card style={{ padding: 0, gap: 0 }}>
            {followUps.map((f, i) => (
              <View key={f.id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <ListItem
                  leading={<Avatar initials={client.initials} />}
                  title={`${client.name} · รักษา ${f.sessionDate}`}
                  subtitle={`${f.areas.map((a) => `${a.area} ${a.painBefore}→${a.painAfter}`).join(' · ')} · รับ ${new Date(f.receivedAt).toTimeString().slice(0, 5)}`}
                  trailing={<Badge label={f.triage === 'review' ? 'ควรติดต่อกลับ' : 'ดีขึ้น'} tone={f.triage === 'review' ? 'warning' : 'success'} />}
                  chevron={false}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SegmentedControl options={['ทั้งหมด', 'ต้องตรวจ', 'เสร็จแล้ว']} value={filter} onChange={setFilter} />

      <Card style={{ padding: 0, gap: 0 }}>
        {sorted.map((r, i) => (
          <View key={r.id}>
            {i > 0 ? <Divider inset={72} /> : null}
            <ListItem
              leading={<Avatar initials={r.initials} />}
              title={`${r.time} · ${r.name}`}
              subtitle={r.complaint}
              meta={r.status}
              trailing={<SafetyTag level={r.level} />}
              onPress={r.isDemo ? () => nav.navigate('ClientBrief') : undefined}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

/* ============================================================ AREA INSIGHTS (KPI หมอพื้นบ้านในพื้นที่ รพ.สต.) */

const KPIS = [
  { l: 'เวลาบันทึก ม.บ.5 ต่อครั้ง', v: '-34%', target: 'เป้า ≥ 30%', ok: true },
  { l: 'บันทึก ม.บ.5 ครบทุกช่อง', v: '94%', target: 'เป้า ≥ 90%', ok: true },
  { l: 'Red Flag ส่งต่อ รพ. ทันเวลา', v: '100%', target: 'เป้า 100%', ok: true },
  { l: 'มี Before/After', v: '86%', target: 'เป้า ≥ 80%', ok: true },
  { l: 'ตอบ Follow-up', v: '57%', target: 'เป้า ≥ 60%', ok: false },
  { l: 'ความพึงพอใจ', v: '91%', target: 'เป้า ≥ 85%', ok: true },
];

export function InsightsScreen() {
  const nav = useNav();
  return (
    <Screen header={<AppBar title="ภาพรวมหมอพื้นบ้าน" subtitle="รพ.สต.บ้านค้อ · 30 วันล่าสุด" />}>
      <GridRow>
        {KPIS.map((k) => (
          <Col key={k.l} span={{ compact: 2, medium: 4, expanded: 4 }}>
            <Card>
              <Text variant="labelSm" tone="secondary" numberOfLines={2}>
                {k.l}
              </Text>
              <Text variant="headlineMd">{k.v}</Text>
              <Badge label={k.target} tone={k.ok ? 'success' : 'warning'} icon={k.ok ? 'check' : 'alert-triangle'} />
            </Card>
          </Col>
        ))}
      </GridRow>

      <SectionHeader title="ผลลัพธ์เฉลี่ยตามกรรมวิธี" subtitle="ระดับอาการก่อน → หลัง (n = 128)" />
      <Card>
        <BeforeAfterBars
          data={[
            { label: 'นวดเส้น + ประคบปูเลย', before: 6.4, after: 3.1 },
            { label: 'ยาพอก + เข้าเฝือกไม้ไผ่', before: 5.9, after: 3.4 },
            { label: 'อบสมุนไพร + ยาต้ม', before: 4.2, after: 2.9 },
          ]}
        />
      </Card>

      <Card variant="filled">
        <VStack gap={1}>
          <HStack gap={2}>
            <Badge label="ต้องปรับปรุง" tone="warning" />
            <Text variant="titleSm">อัตราตอบ Follow-up ต่ำกว่าเป้า</Text>
          </HStack>
          <Text variant="bodySm" tone="secondary">
            ข้อเสนอ: ให้ อสม. โทรถามคนไข้วันที่ 7 และส่งแจ้งเตือนช่วง 19:00–20:00
          </Text>
        </VStack>
      </Card>
    </Screen>
  );
}
