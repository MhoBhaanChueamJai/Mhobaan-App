import React from 'react';
import { Linking, View } from 'react-native';
import { AppBar, Banner, Button, Icon, InfoRow, Panel, ProfileAvatar, Screen, Tag, Text, space, useTheme } from '../../design-system';
import { useNav } from '../../navigation/types';
import { ARCHIVED_CASES } from '../../data/homeFeed';
import { herbDrugCautions, patientOfCase } from '../../data/patients';
import { useJourney } from '../../state/JourneyContext';
import { NotFoundScreen } from './NotFound';

/**
 * รายละเอียดคนไข้ (แตะการ์ดคนไข้บนหน้าแรก) — สิ่งที่หมอต้องรู้ก่อนรักษา + ทะเบียนการรักษา ม.บ.5 ทุกครั้ง
 * ส่วนผู้ป่วยของแบบ ม.บ.5 · ความยินยอม 2 ระดับ (FR-11) · HOSxP HN (FR-12) · ส่งต่อจาก รพ. (flow C) · สมุนไพร–ยา (FR-32 ตัวอย่าง)
 */
export function PatientDetailScreen({ route }: { route: { params: { caseId: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { cases, drafts } = useJourney();
  const p = patientOfCase(route.params.caseId);
  const tc = [...cases, ...ARCHIVED_CASES].find((c) => c.id === route.params.caseId);
  const draft = drafts.find((d) => d.id === route.params.caseId);
  // คนไข้ใหม่ (เพิ่มเองด้วยปุ่ม +): ยังไม่มีข้อมูล → บอกว่าต้องกรอกอะไรบ้าง
  if (!p && draft)
    return (
      <Screen header={<AppBar title={draft.title} subtitle="คนไข้ใหม่" onBack={() => nav.goBack()} />}>
        <Banner tone="warning" icon="user-plus" title="ยังไม่มีข้อมูลคนไข้" message="ขอความยินยอมก่อนบันทึก แล้วกรอกข้อมูลตามแบบ ม.บ.5 ส่วนผู้ป่วย หรืออัดบทสนทนาการรักษาให้ AI ช่วยเติม" />
        <Panel title="ที่ต้องกรอก (แบบ ม.บ.5 ส่วนผู้ป่วย)">
          {['เลขบัตรประชาชน 13 หลัก', 'ชื่อ–นามสกุล เพศ อายุ', 'ที่อยู่ เบอร์โทร', 'โรคประจำตัว ยาที่ใช้ ประวัติแพ้', 'น้ำหนัก ส่วนสูง', 'ความยินยอม 2 ระดับ (บันทึก / เปิดเผยกับหน่วยบริการ)'].map((x) => (
            <View key={x} style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
              <Icon name="circle" size="xs" color={colors.text.tertiary} />
              <Text variant="bodyMd">{x}</Text>
            </View>
          ))}
        </Panel>
        <Panel title="ทะเบียนการรักษา ม.บ.5">
          <Text variant="bodySm" tone="secondary">
            ยังไม่มีบันทึก
          </Text>
        </Panel>
      </Screen>
    );
  if (!p || !tc) return <NotFoundScreen title="ข้อมูลคนไข้" />;
  const cautions = herbDrugCautions(p);
  const visits = [...tc.visits].reverse();
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'ไม่มี');
  return (
    <Screen header={<AppBar title={p.name} subtitle={`${p.sex} · ${p.age} ปี`} onBack={() => nav.goBack()} />}>
      {p.referral ? (
        <Banner tone="info" icon="inbox" title={`ส่งต่อจาก ${p.referral.from} (${p.referral.at})`} message={`${p.referral.doctor} · ${p.referral.reason}`} />
      ) : null}

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <ProfileAvatar sex={p.sex} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleLg">{p.name}</Text>
            <Text variant="bodySm" tone="secondary">
              {p.sex} · {p.age} ปี · {p.village}
            </Text>
          </View>
        </View>
        <InfoRow k="เลขบัตรประชาชน" v={p.cid} />
        <InfoRow k="ที่อยู่" v={p.village} />
        <InfoRow k="โทร" v={p.phone} />
        <InfoRow k="HOSxP" v={p.hn ? `จับคู่แล้ว · HN ${p.hn}` : 'ยังไม่จับคู่ (จับคู่ด้วยเลขบัตรเมื่อมาโรงพยาบาล)'} />
      </Panel>

      <Panel title="ข้อมูลสุขภาพ">
        <InfoRow k="โรคประจำตัว" v={list(p.chronic)} />
        <InfoRow k="ยาที่ใช้อยู่" v={list(p.meds)} />
        <InfoRow k="ประวัติแพ้" v={list(p.allergy)} color={p.allergy.length ? colors.status.danger.fg : undefined} />
        {p.weight ? <InfoRow k="น้ำหนัก / ส่วนสูง" v={`${p.weight} กก. / ${p.height ?? '-'} ซม.`} /> : null}
      </Panel>

      {p.referral ? (
        <Panel title="ข้อห้ามจากแพทย์ผู้ส่ง">
          <Text variant="bodySm" tone="secondary">
            {p.referral.diagnosis}
          </Text>
          {p.referral.precautions.map((x) => (
            <View key={x} style={{ flexDirection: 'row', gap: space[2] }}>
              <Icon name="x-octagon" size="sm" color={colors.status.danger.fg} />
              <Text variant="bodyMd" style={{ flex: 1 }}>
                {x}
              </Text>
            </View>
          ))}
        </Panel>
      ) : null}

      {cautions.length ? (
        <Panel title="ข้อควรระวังสมุนไพรกับยาที่ใช้อยู่">
          {cautions.map((c) => (
            <View key={c} style={{ flexDirection: 'row', gap: space[2] }}>
              <Icon name="alert-triangle" size="sm" color={colors.status.warning.fg} />
              <Text variant="bodySm" style={{ flex: 1 }}>
                {c}
              </Text>
            </View>
          ))}
          <Text variant="bodyXs" tone="tertiary">
            ตัวอย่าง · ต้องผ่านการตรวจทานโดยเภสัชกรก่อนใช้จริง
          </Text>
        </Panel>
      ) : null}

      <Panel title="ความยินยอม (PDPA)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <Tag text={p.consent.record ? 'ยินยอมให้บันทึก' : 'ยังไม่ยินยอม'} tone={p.consent.record ? 'good' : 'bad'} />
          <Tag text={p.consent.share ? 'ยินยอมเปิดเผยกับหน่วยบริการ' : 'ไม่เปิดเผยกับหน่วยบริการ'} tone={p.consent.share ? 'good' : 'warn'} />
        </View>
        <Text variant="bodyXs" tone="secondary">
          ให้ความยินยอมเมื่อ {p.consent.at} · {p.consent.method === 'เซ็น' ? 'เซ็นชื่อบนจอ' : 'ยินยอมด้วยเสียง'}
        </Text>
      </Panel>

      <Panel title={`ทะเบียนการรักษา ม.บ.5 · ${tc.visits.length} ครั้ง`}>
        {visits.map((v, i) => {
          const no = tc.visits.length - i;
          const r = v.record;
          return (
            <View key={`${v.date}-${no}`} style={{ gap: space[1], paddingBottom: space[3], borderBottomWidth: i === visits.length - 1 ? 0 : 1, borderBottomColor: colors.border.subtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Text variant="labelLg" style={{ flex: 1 }}>
                  ครั้งที่ {no} · {v.date}
                </Text>
                <Tag text={`อาการ ${v.painBefore} → ${v.selfPain ?? v.painAfter}`} tone={(v.selfPain ?? v.painAfter) < v.painBefore ? 'good' : undefined} />
              </View>
              {r?.findings ? <InfoRow k="ตรวจร่างกาย" v={r.findings} /> : null}
              <InfoRow k="วินิจฉัย" v={r?.diagnoses?.join(', ') || tc.condition} />
              <InfoRow k="การรักษา" v={r?.procedures?.join(', ') || tc.plan} />
              {r?.advice ? <InfoRow k="คำแนะนำ" v={r.advice} /> : null}
            </View>
          );
        })}
      </Panel>

      <View style={{ gap: space[2] }}>
        <Button label="ส่งต่อโรงพยาบาล" variant="secondary" iconLeft="send" onPress={() => nav.navigate('ClientTabs', { screen: 'Places', params: { mode: 'doctor' } })} />
        <Button label={`โทรหาคนไข้ ${p.phone}`} variant="ghost" iconLeft="phone" onPress={() => void Linking.openURL(`tel:${p.phone.replace(/\D/g, '')}`)} />
      </View>
    </Screen>
  );
}
