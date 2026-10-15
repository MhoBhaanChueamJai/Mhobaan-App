import React from 'react';
import { View } from 'react-native';
import { AppBar, Button, Icon, Panel, ReplyChips, Screen, Text, TextField, TINT, space, useTheme, PlayOnceIcon } from '../../design-system';
import { ASSESS_LOCK_TEXT, assessLock, preVisitOpensOn } from '../../state/appointments';
import { FU_ADVERSE, FU_RISK } from '../../data/homeFeed';
import { preVisitRed, preVisitSummary } from '../../data/preVisit';
import { useJourney } from '../../state/JourneyContext';
import { PainPicker } from './home/PainPicker';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';

/**
 * ประเมินคนไข้ก่อนรักษา (กรอกเอง ไม่ต้องคุยกับ AI) — ผลเหมือนตอบในแชท: บันทึกเป็นอาการก่อนรักษาครั้งนี้ · ลง ม.บ.5 · สรุปว่าครั้งนี้จะรักษาอย่างไร
 * ประเมินแล้ว → เปิดมาที่ผลประเมิน (แก้ไขได้จนถึงเช็กอิน · หลังเช็กอิน = แจ้งอาการเพิ่มเป็นข้อความแยก ไม่แทนผลเดิม)
 */
export function PreVisitScreen({ route }: { route?: { params?: { caseId?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { cases, caseToday, caseAppts, setCaseToday, log, addSymptomNote } = useJourney();
  const [note, setNote] = React.useState('');
  const [noteSent, setNoteSent] = React.useState(false);
  const tc = cases.find((c) => c.id === route?.params?.caseId);
  const saved = tc ? caseToday[tc.id] : undefined;
  const [editing, setEditing] = React.useState(!saved);
  const [pain, setPain] = React.useState<number | undefined>(saved?.pain);
  const [adverse, setAdverse] = React.useState<string | undefined>(saved?.adverse);
  const [risk, setRisk] = React.useState<string | undefined>(saved?.risk);
  if (!tc) return <NotFoundScreen title="ประเมินก่อนรักษา" message="ไม่พบคนไข้ที่รักษา" />;
  const last = tc.visits[tc.visits.length - 1];
  const no = tc.course.done + 1;
  const hasAppt = tc.appointment.date !== '-';
  const complete = pain !== undefined && !!adverse && !!risk;
  // เช็กอินแล้ว → ใช้ผลนี้ในการรักษา (แก้ไม่ได้)
  const lock = hasAppt ? assessLock(caseAppts[tc.id] ?? tc.appointment) : null;

  const submit = () => {
    const red = preVisitRed(adverse, risk);
    setCaseToday(tc.id, { pain: pain!, adverse, risk, red });
    log('ระบบ → ม.บ.5', `ก่อนรักษา${tc.short}: วันนี้อาการ ${pain}/10 · หลังรักษาครั้งก่อน ${adverse}${risk !== 'ไม่มี' ? ` · ${risk}` : ''}${red ? ' · ควรส่งต่อแพทย์ก่อนรักษา' : ''}`);
    // ส่งเข้าแถวนัดครั้งนี้ที่หลังบ้าน (setCaseToday จัดการคิวรอส่ง/ข้อความสำรอง)
    setEditing(false);
  };

  // ยังไม่ถึงช่วงประเมิน (เปิด 1 วันก่อนนัด) → บอกวันที่เปิด
  const opensOn = !saved && hasAppt ? preVisitOpensOn(tc.appointment.date) : null;
  if (opensOn)
    return (
      <Screen header={<AppBar title={`ก่อนรักษาครั้งที่ ${no}`} onBack={() => nav.goBack()} />}>
        <Panel icon="calendar" tint={TINT.slate} title={`ประเมินได้ตั้งแต่${opensOn === 'พรุ่งนี้' ? '' : ' '}${opensOn}`}>
          <Text variant="bodySm" tone="secondary">
            ประเมินใกล้วันนัด ให้ตรงกับอาการคนไข้วันที่มารักษา
          </Text>
        </Panel>
      </Screen>
    );

  // ผลประเมิน
  if (!editing && saved) {
    const s = preVisitSummary(tc, saved);
    const tone = s.status === 'red' ? colors.status.danger : s.status === 'caution' ? colors.status.warning : colors.status.success;
    return (
      <Screen
        header={<AppBar title={`ก่อนรักษาครั้งที่ ${no}`} onBack={() => nav.goBack()} />}
        footer={
          <>
            {s.status === 'red' ? (
              <Button label="ดูคำแนะนำ" onPress={() => nav.navigate('RedFlag', { reason: `ผลประเมินก่อนรักษา${tc.short}` })} />
            ) : tc.appointment.today ? (
              <Button label={lock ? 'ดูคิว' : 'เช็กอิน'} iconLeft={lock ? 'eye' : 'maximize'} onPress={() => nav.navigate('CheckIn', { caseId: tc.id })} />
            ) : null}
            {lock ? null : <Button label="แก้ไขคำตอบ" variant="secondary" onPress={() => setEditing(true)} />}
          </>
        }
      >
        <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[2] }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
            {/* บันทึกผลประเมินก่อนรักษาแล้ว: ไอคอนวาดเส้น 1 รอบ */}
            <PlayOnceIcon name={s.status === 'red' ? 'alert-triangle' : s.status === 'caution' ? 'alert-circle' : 'check-circle'} size={34} color={tone.fg} />
          </View>
          <Text variant="headlineSm" align="center">
            {s.label}
          </Text>
          <Text variant="bodySm" tone="secondary" align="center">
            บันทึกลง ม.บ.5 แล้ว{hasAppt ? ` · นัด ${tc.appointment.date} ${tc.appointment.time}` : ''}
          </Text>
        </View>
        <Panel title="วันนี้">
          <Text variant="bodyMd">
            อาการ {saved.pain}/10 · หลังรักษาครั้งก่อน {s.prevAfter}/10 {s.diff > 0 ? `(อาการกลับมา +${s.diff})` : '(ผลยังคงอยู่)'}
          </Text>
          {(saved.adverse && saved.adverse !== 'ไม่มี') || (saved.risk && saved.risk !== 'ไม่มี') ? (
            <Text variant="bodySm" color={s.status === 'red' ? colors.status.danger.fg : colors.status.warning.fg}>
              {[saved.adverse && saved.adverse !== 'ไม่มี' ? `หลังรักษาครั้งก่อน${saved.adverse}` : '', saved.risk && saved.risk !== 'ไม่มี' ? saved.risk : ''].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </Panel>
        <Panel title={s.status === 'red' ? 'ครั้งนี้' : 'ครั้งนี้จะรักษาด้วย'}>
          {s.plan.map((it) => (
            <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name={s.status === 'red' ? 'alert-triangle' : 'check-circle'} size="xs" color={s.status === 'red' ? colors.status.danger.fg : colors.brand.primary} />
              <Text variant="bodySm" style={{ flex: 1 }}>
                {it}
              </Text>
            </View>
          ))}
          {s.status !== 'red' && tc.prep.length ? (
            <Text variant="bodySm" tone="secondary">
              ให้คนไข้เตรียม: {tc.prep.join(' · ')}
            </Text>
          ) : null}
        </Panel>
        {/* ล็อกหลังเช็กอิน: บอกเหตุผล + แจ้งอาการเพิ่ม (ข้อความแยก เห็นว่ามาหลังเช็กอิน) */}
        {lock ? (
          <Panel icon="lock" tint={TINT.slate} title="แก้ผลประเมินไม่ได้แล้ว">
            <Text variant="bodySm" tone="secondary">
              {ASSESS_LOCK_TEXT[lock]}
            </Text>
            {lock === 'checked_in' ? (
              noteSent ? (
                <Text variant="bodySm" color={colors.brand.primary}>
                  บันทึกลง ม.บ.5 แล้ว
                </Text>
              ) : (
                <>
                  <TextField placeholder="เช่น ปวดร้าวลงแขนมากขึ้น" value={note} onChangeText={setNote} multiline />
                  <Button
                    label="แจ้งอาการเพิ่ม"
                    variant="secondary"
                    disabled={!note.trim()}
                    onPress={() => {
                      addSymptomNote({ caseId: tc.id }, `${tc.short} ครั้งที่ ${no}`, note.trim());
                      log('พ่อหมอ → ม.บ.5', `แจ้งอาการเพิ่มหลังเช็กอิน (${tc.short}): ${note.trim()}`);
                      setNoteSent(true);
                    }}
                  />
                </>
              )
            ) : null}
          </Panel>
        ) : null}
      </Screen>
    );
  }

  // แบบฟอร์ม 3 ข้อ
  return (
    <Screen
      header={<AppBar title={`ประเมินก่อนรักษาครั้งที่ ${no}`} onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button label="บันทึกผลประเมิน" disabled={!complete} onPress={submit} />
          {/* อยากเล่าเพิ่ม/ถาม → คุยกับหมอบ้าน AI ในแชทของคนไข้นี้แทนได้ */}
          <Button label="คุยกับ AI แทน" variant="secondary" onPress={() => nav.popTo('ClientTabs', { screen: 'Home', params: { assessCase: tc.id } })} />
        </>
      }
    >
      <Panel title="วันนี้คนไข้อาการเท่าไหร่">
        <PainPicker value={pain} onChange={setPain} compareValue={last.selfPain ?? last.painAfter} compareLabel="หลังรักษาครั้งก่อน" />
      </Panel>
      <Panel title="หลังรักษาครั้งก่อน มีอาการผิดปกติไหม">
        <ReplyChips options={FU_ADVERSE} selected={adverse} onPick={setAdverse} />
      </Panel>
      <Panel title="ช่วงนี้มีข้อใดต่อไปนี้ไหม">
        <ReplyChips options={FU_RISK} selected={risk} onPick={setRisk} />
        {preVisitRed(adverse, risk) ? (
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <Icon name="alert-triangle" size="xs" color={TINT.red} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              ควรส่งต่อแพทย์ก่อนรักษาครั้งนี้
            </Text>
          </View>
        ) : null}
      </Panel>
    </Screen>
  );
}
