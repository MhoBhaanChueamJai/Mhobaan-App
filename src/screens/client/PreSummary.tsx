import React from 'react';
import { Linking, View } from 'react-native';
import {
  AILabel,
  AppBar,
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  HStack,
  Icon,
  JourneyStepper,
  KeyValue,
  ListItem,
  Placeholder,
  Screen,
  SectionHeader,
  Text,
  VStack,
  regionLabel,
  safetyMeta,
  useTheme,
  type RegionId,
 Panel, TINT, Tag, TextField, fontFamily, space, PlayOnceIcon } from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { useAppointment } from '../../state/appointments';
import { NotFoundScreen } from './NotFound';
import { QrScanner, qrScanSupported } from './QrScanner';
import { readAvailability } from '../../services/clinicBridge';
import { refreshAvailability } from '../../services/cloudBridge';

/* ============================================================ 07 PRE-SERVICE SUMMARY */

export function PreSummaryScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { chiefComplaint, goal, symptoms, before, safety, profile, log, lastAssess } = useJourney();
  // มาจากแชท AI → ใช้ผลประเมินในแชท (ข้อมูลชุดเดียวกับการ์ด) แทนข้อมูลจากแบบฟอร์มเดิม
  const fromChat = !!lastAssess;
  const regions = (Object.entries(symptoms) as [RegionId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  // มาจากแชท → ผลความปลอดภัยของแชทนั้น (ไม่ใช่จากโปรไฟล์อย่างเดียว)
  const level = fromChat && lastAssess?.red ? 'red' : fromChat && lastAssess?.caution && safety.level === 'green' ? 'amber' : safety.level;
  const meta = safetyMeta[level];
  const isRed = level === 'red';

  return (
    <Screen
      header={<AppBar title="สรุปบันทึก ม.บ.5" onBack={() => nav.goBack()} />}
      footer={
        isRed ? (
          <Button label="ดูคำแนะนำเพื่อความปลอดภัย" variant="danger" iconRight="arrow-right" onPress={() => nav.navigate('RedFlag', lastAssess?.red ? { reason: `ผลประเมิน${lastAssess.symptoms.join(', ')}` } : undefined)} />
        ) : (
          <Button
            label={fromChat ? 'นัดคนไข้' : 'ยืนยันและนัดติดตามอาการ'}
            iconRight={fromChat ? 'calendar' : 'send'}
            onPress={() => {
              log('พ่อหมอ', 'ยืนยันสรุปบันทึก ม.บ.5');
              // บันทึกแล้ว → นัดคนไข้ (เช็กอินต้องมีนัดก่อน)
              nav.navigate('Booking');
            }}
          />
        )
      }
    >
      {fromChat ? null : <JourneyStepper current={1} />}

      {/* Safety status first — Serial position + Von Restorff */}
      <Banner
        tone={meta.tone}
        title={meta.label}
        message={
          // ยังไม่ได้บอกโรคประจำตัว/ยา → ไม่บอกว่า "ไม่พบข้อควรระวัง"
          profile.healthKnown === false
            ? 'ยังไม่มีข้อมูลโรคประจำตัวและยาของคนไข้ ควรซักเพิ่มก่อนรักษา'
            : level === 'amber' && lastAssess?.caution && safety.level === 'green'
            ? lastAssess.caution
            : safety.level === 'green'
            ? `ตรวจแล้ว ${safety.checkedRules} ข้อ ไม่พบข้อควรระวัง`
            : isRed
              ? 'พบสัญญาณอันตราย ไม่ควรรักษาพื้นบ้านวันนี้ ควรส่งต่อโรงพยาบาล'
              : `พบ ${safety.hits.length} ข้อที่ควรตรวจสอบกับคนไข้ก่อนเริ่มรักษา เพื่อปรับกรรมวิธีให้เหมาะสม`
        }
      />

      <Card>
        <HStack justify="space-between">
          <Text variant="titleMd">ข้อมูลที่จะบันทึกลง ม.บ.5</Text>
          <AILabel text="สรุปโดย AI" />
        </HStack>
        {fromChat && lastAssess ? (
          <>
            <KeyValue label="อาการหลัก" value={lastAssess.symptoms.join(', ') || '-'} emphasis />
            <KeyValue label="ระดับอาการ" value={`${lastAssess.pain}/10`} />
            {lastAssess.cause && lastAssess.cause !== 'ไม่แน่ใจ' ? <KeyValue label="สาเหตุ" value={lastAssess.cause} /> : null}
          </>
        ) : (
          <>
            <KeyValue label="อาการหลัก" value={chiefComplaint} emphasis />
            <KeyValue label="ตำแหน่ง" value={regions.map(([r, v]) => `${regionLabel[r]} (${v})`).join(', ')} />
            <KeyValue label="ความปวด / ตึง" value={`${before.pain}/10 · ${before.stiffness}/10`} />
          </>
        )}
        <KeyValue label="โรคประจำตัว" value={profile.conditions.join(', ') || '-'} />
        <KeyValue label="ยา" value={profile.medications.join(', ') || '-'} />
        {fromChat ? null : <KeyValue label="เป้าหมาย" value={goal} />}
        <Divider />
        <Button label="แก้ไขข้อมูล" variant="ghost" iconLeft="edit-2" fullWidth={false} onPress={() => (fromChat ? nav.goBack() : nav.navigate('BodyMap'))} />
      </Card>

      {safety.hits.length ? (
        <Card>
          <Text variant="titleSm">สิ่งที่ระบบพบ</Text>
          {safety.hits.map((h) => (
            <HStack key={h.ruleId} gap={2} align="flex-start">
              <Icon name={h.level === 'red' ? 'x-octagon' : 'alert-triangle'} size="sm" color={h.level === 'red' ? colors.status.danger.fg : colors.status.warning.fg} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMd">{h.title}</Text>
                <Text variant="bodySm" tone="secondary">
                  {h.evidence}
                </Text>
              </View>
            </HStack>
          ))}
        </Card>
      ) : null}

    </Screen>
  );
}

/* ============================================================ 08 CHECK-IN */

export function CheckInScreen({ route }: { route?: { params?: { caseId?: string; draftId?: string; looseId?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const target = route?.params ?? {};
  // นัดของคนไข้ที่แตะมา (ไม่ใช่นัดล่าสุดที่นัดไว้)
  const appt = useAppointment(target);
  const { caseToday, clinicCloseVisit, checkIn, cloudRefOf, checkinErrors } = useJourney();
  // นัดที่ผ่าน cloud: เปิดหน้านี้ในวันนัด = เช็กอินที่หน่วยบริการ → หน่วยบริการออกเลขคิวส่งกลับมาแสดงตรงนี้ (หน่วยบริการเป็นคนปิดการรักษา ไม่ต้องจำลอง)
  const linked = cloudRefOf(target) !== undefined;
  const canCheckIn = !!appt && appt.today && !appt.red && !(target.caseId && caseToday[target.caseId]?.red) && !appt.pending;
  // เช็กอิน = สแกน QR ที่เคาน์เตอร์ (หรือพิมพ์รหัสใต้ QR) → หน่วยบริการตรวจรหัสแล้วออกเลขคิวตามลำดับที่มาถึง
  const ref = cloudRefOf(target);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sentAt, setSentAt] = React.useState<number | null>(null);
  const issue = ref ? checkinErrors[ref] : undefined;
  const submit = async (c: string) => {
    setScanOpen(false);
    setSending(true);
    const ok = await checkIn(target, c);
    setSending(false);
    setSentAt(ok ? Date.now() : null);
    if (!ok) setSentAt(-1);
  };
  // สถานะคิวของหน่วยบริการ (อีกกี่คิว · กำลังให้บริการคิวไหน) — อัปเดตทุก 5 วินาที
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!linked || !appt?.today) return;
    const t = setInterval(() => void refreshAvailability().then(tick), 5000);
    return () => clearInterval(t);
  }, [linked, appt?.today]);
  const q = readAvailability()?.queue;
  const ahead = appt?.queue && q ? q.waiting.filter((x) => x < appt.queue!).length : null;
  if (!appt) return <NotFoundScreen title="เช็กอิน" message="ยังไม่มีนัดสำหรับเช็กอิน" />;
  // ต้นแบบ: ข้ามช่วงรักษา → ปิดการรักษาในหลังบ้าน (ครั้งใหม่ + คะแนนอาการ + ค่าครู/ค่ายา) → หน้าผลการรักษาของคนไข้นี้
  // นัดคนไข้ใหม่ที่ยังไม่ได้บันทึกอาการ (ไม่มีใบ) → แบบประเมินหลังรักษาแบบเดิม
  const finish = () => {
    const caseId = appt.target.looseId ? undefined : clinicCloseVisit(appt.target);
    if (caseId) nav.navigate('SessionResult', { caseId });
    else nav.navigate('PostAssessment', appt.target);
  };
  // คนไข้ที่รักษาอยู่: ต้องประเมินอาการก่อนรักษาครั้งนี้ (คะแนนวันนี้ + อาการหลังรักษาครั้งก่อน + ข้อห้ามใหม่)
  const pre = target.caseId ? caseToday[target.caseId] : undefined;
  const needPre = appt.kind === 'case' && !pre;
  const blocked = appt.red || !!pre?.red;
  return (
    <Screen
      header={<AppBar title="เช็กอิน" onBack={() => nav.goBack()} />}
      footer={
        appt.today && !blocked && !appt.pending ? (
          <>
            {/* ยังไม่ได้บันทึกอาการ / ยังไม่ได้ประเมินก่อนรักษาครั้งนี้ → ทำก่อน */}
            {appt.assessed ? null : <Button label="เล่าอาการคนไข้ก่อนรักษา" onPress={() => nav.popTo('ClientTabs', { screen: 'Home' })} />}
            {needPre ? <Button label="ประเมินก่อนรักษา" onPress={() => nav.popTo('ClientTabs', { screen: 'Home', params: { assessCase: target.caseId } })} /> : null}
            {/* ต้นแบบ: ข้ามช่วงที่หมอรักษา → ไปผลการรักษา (ของคนไข้นี้) */}
            {linked ? null : <Button label="จำลอง: รักษาเสร็จแล้ว" variant="secondary" onPress={finish} />}
          </>
        ) : (
          <Button label="กลับ" variant="secondary" onPress={() => nav.goBack()} />
        )
      }
    >
      {blocked ? (
        <Panel icon="alert-triangle" tint={TINT.red} title="ควรส่งต่อแพทย์ก่อนรักษา">
          <Text variant="bodySm" tone="secondary">
            อาการคนไข้มีสัญญาณที่ต้องให้แพทย์ตรวจก่อน แนะนำเลื่อนนัดนี้
          </Text>
          <Button label="ดูคำแนะนำ" variant="secondary" size="md" onPress={() => nav.navigate('RedFlag', { reason: appt.topic })} />
        </Panel>
      ) : appt.pending ? (
        // คำขอนัดยังไม่ได้รับการยืนยัน → ยังเช็กอินไม่ได้
        <Panel icon="clock" tint={TINT.amber} title="รอหน่วยบริการยืนยันนัด">
          <Text variant="bodySm" tone="secondary">
            {appt.date} {appt.time} · {appt.clinic} จะแจ้งเตือนในแอปเมื่อยืนยันแล้ว
          </Text>
        </Panel>
      ) : !appt.today ? (
        // เช็กอินได้เฉพาะวันนัด
        <Panel icon="calendar" tint={TINT.amber} title="เช็กอินได้ในวันนัด">
          <Text variant="bodySm" tone="secondary">
            นัดคนไข้ {appt.date} {appt.time} · {appt.clinic}
          </Text>
        </Panel>
      ) : (
        <>
          {linked && !appt.queue ? (
            // ยังไม่ได้เช็กอิน → สแกน QR ที่เคาน์เตอร์
            <Panel icon="maximize" tint={TINT.green} title="เช็กอินที่หน่วยบริการ">
              <Text variant="bodySm" tone="secondary">
                พาคนไข้มาถึงแล้ว สแกน QR เช็กอินบนจอที่เคาน์เตอร์ เพื่อรับเลขคิวตามลำดับ
              </Text>
              {qrScanSupported ? <Button label="สแกน QR เช็กอิน" iconLeft="maximize" onPress={() => setScanOpen(true)} disabled={sending} /> : null}
              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <TextField label="หรือพิมพ์รหัส 6 ตัวใต้ QR" value={code} onChangeText={(v) => setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))} placeholder="เช่น K7P2QX" autoCapitalize="characters" autoCorrect={false} />
                </View>
                <Button label="เช็กอิน" size="md" fullWidth={false} style={{ alignSelf: 'flex-end' }} disabled={code.length !== 6 || sending} loading={sending} onPress={() => void submit(code)} />
              </View>
              {issue ? (
                <Text variant="bodySm" color={colors.status.danger.fg}>
                  {issue}
                </Text>
              ) : sentAt === -1 ? (
                <Text variant="bodySm" color={colors.status.danger.fg}>
                  ส่งเช็กอินไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่
                </Text>
              ) : sentAt ? (
                <Text variant="bodySm" color={colors.brand.primary}>
                  เช็กอินแล้ว · รอหน่วยบริการออกเลขคิว…
                </Text>
              ) : null}
            </Panel>
          ) : null}
          {linked && !appt.queue ? null : (
          /* คิว + สถานะคิว */
          <Panel>
            <View style={{ alignItems: 'center', gap: 2 }}>
              {/* เช็กอินสำเร็จ ได้เลขคิวแล้ว: ติ๊กวาดเส้น 1 รอบ (เลขคิวใหม่ = เล่นใหม่) */}
              {linked && appt.queue ? <PlayOnceIcon key={appt.queue} name="check-circle" size={32} color={colors.brand.primary} /> : null}
              <Text variant="bodyXs" tone="secondary">
                {appt.queue ? 'คิวคนไข้' : linked ? 'เช็กอินแล้ว · รอออกเลขคิว' : 'นัดวันนี้'}
              </Text>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 56, lineHeight: 72, color: colors.brand.primary }}>{appt.queue ?? appt.time}</Text>
              <Text variant="bodySm" tone="secondary">
                {[appt.queue ? appt.time : '', appt.therapist].filter(Boolean).join(' · ')}
              </Text>
              {linked ? (
                // สถานะคิวจากหน่วยบริการ (สด)
                <View style={{ marginTop: space[2], paddingHorizontal: space[3], paddingVertical: 6, borderRadius: 999, backgroundColor: appt.stage === 'called' || appt.stage === 'in_service' ? colors.brand.primary : colors.surface.sunken }}>
                  <Text variant="labelMd" color={appt.stage === 'called' || appt.stage === 'in_service' ? '#FFFFFF' : colors.text.secondary}>
                    {appt.stage === 'called' ? 'ถึงคิวแล้ว เชิญเข้ารับการรักษา' : appt.stage === 'in_service' ? 'กำลังรักษา' : appt.queue ? 'รอเรียกคิว…' : 'กำลังขอเลขคิวจากหน่วยบริการ…'}
                  </Text>
                </View>
              ) : null}
            </View>
            {linked && appt.queue && appt.stage !== 'called' && appt.stage !== 'in_service' ? (
              // อีกกี่คิว (จากหน่วยบริการ · เฉพาะเลขคิว ไม่มีชื่อ)
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <View style={{ flex: 1, alignItems: 'center', padding: space[3], borderRadius: 16, backgroundColor: colors.surface.sunken }}>
                  <Text variant="bodyXs" tone="secondary">
                    รออีก
                  </Text>
                  <Text variant="titleLg">{ahead === null ? '–' : ahead === 0 ? 'คิวถัดไป' : `${ahead} คิว`}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', padding: space[3], borderRadius: 16, backgroundColor: colors.surface.sunken }}>
                  <Text variant="bodyXs" tone="secondary">
                    กำลังให้บริการ
                  </Text>
                  <Text variant="titleLg">{q?.serving ?? '–'}</Text>
                </View>
              </View>
            ) : null}
            {!linked ? (
              <View style={{ alignSelf: 'center', width: 190, height: 190, borderRadius: 20, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
                <Icon name="maximize" size="xl" color={colors.text.secondary} />
                <Text variant="bodyXs" tone="secondary">
                  แสดง QR นี้ที่เคาน์เตอร์
                </Text>
              </View>
            ) : null}
          </Panel>
          )}
          <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onCode={(c) => void submit(c)} />
          <Panel icon="list" tint={TINT.green} title="ขั้นตอนวันนี้">
            {(
              [
                // บันทึกแล้วจริงเฉพาะเมื่อเล่าอาการคนไข้แล้ว
                appt.kind === 'case'
                  ? [pre ? `ประเมินก่อนรักษาแล้ว · วันนี้อาการ ${pre.pain}/10` : 'ประเมินอาการคนไข้ก่อนรักษา', !!pre]
                  : [appt.assessed ? 'บันทึกอาการคนไข้ลง ม.บ.5 แล้ว' : 'เล่าอาการคนไข้ให้หมอบ้าน AI', appt.assessed],
                ['วัดความดันและจับชีพจรก่อนรักษา', false],
                ['ตกลงกรรมวิธีรักษากับคนไข้', false],
              ] as [string, boolean][]
            ).map(([t, ok], i) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? colors.brand.primary : colors.surface.sunken }}>
                  {ok ? <Icon name="check" size="xs" color="#FFFFFF" /> : <Text variant="labelSm" tone="secondary">{i + 1}</Text>}
                </View>
                <Text variant="bodyMd" tone={ok ? 'primary' : 'secondary'}>
                  {t}
                </Text>
              </View>
            ))}
          </Panel>
        </>
      )}
    </Screen>
  );
}

/* ============================================================ 07b RED FLAG REFERRAL */

export function RedFlagScreen({ route }: { route?: { params?: { reason?: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { safety, log, lastAssess, drafts } = useJourney();
  const reds = safety.hits.filter((h) => h.level === 'red');
  // เหตุที่ส่งมา (แชท/ติดตามผล) + ผลประเมินที่ให้พบแพทย์ + สัญญาณอันตรายจากโปรไฟล์ → ไม่ขึ้น "ไม่พบสัญญาณ" ใต้หัวข้อที่บอกว่าควรส่งต่อ
  const reasons = [
    ...(route?.params?.reason ? [route.params.reason] : []),
    ...drafts.filter((d) => d.red).map((d) => `ผลประเมิน${d.title}`),
    ...(lastAssess?.red && !drafts.some((d) => d.red) ? [`ผลประเมิน${lastAssess.symptoms.join(', ')}`] : []),
  ].filter((x, i, all) => all.indexOf(x) === i);
  const call1669 = () => {
    log('พ่อหมอ', 'โทรฉุกเฉิน 1669');
    Linking.openURL('tel:1669').catch(() => {});
  };
  return (
    <Screen
      header={<AppBar title="สัญญาณอันตราย" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button label="โทร 1669 (ฉุกเฉิน)" variant="danger" iconLeft="phone" onPress={call1669} />
          {/* ส่งต่อโรงพยาบาล/รพ.สต. (นำทาง/โทรได้จากหน้ารายละเอียด) */}
          <Button label="ส่งต่อโรงพยาบาล" variant="secondary" iconLeft="map-pin" onPress={() => nav.popTo('ClientTabs', { screen: 'Places', params: { mode: 'doctor' } })} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.status.danger.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x-octagon" size="xl" color={colors.status.danger.fg} />
        </View>
        <Text variant="headlineSm" align="center">
          ควรส่งต่อคนไข้ไปโรงพยาบาล
        </Text>
        <Text variant="bodyMd" tone="secondary" align="center">
          อาการคนไข้มีสัญญาณอันตรายที่ควรให้แพทย์ประเมินก่อน การรักษาพื้นบ้านอาจไม่เหมาะในตอนนี้
        </Text>
      </View>

      {reasons.length || reds.length ? (
        <Panel title="สิ่งที่ระบบพบ">
          {reasons.map((r) => (
            <Text key={r} variant="bodyMd">
              {r}
            </Text>
          ))}
          {reds.map((h) => (
            <VStack key={h.ruleId} gap={1}>
              <HStack justify="space-between">
                <Text variant="bodyMd">{h.title}</Text>
                <Tag text={h.ruleId} tone="bad" />
              </HStack>
              <Text variant="bodySm" tone="secondary">
                ข้อมูล: {h.evidence}
              </Text>
            </VStack>
          ))}
        </Panel>
      ) : null}

      <Panel icon="phone" tint={TINT.red} title="โทร 1669 ทันทีถ้ามีอาการเหล่านี้">
        <Text variant="bodySm" tone="secondary">
          ปากเบี้ยว แขนขาอ่อนแรงทันที เจ็บแน่นหน้าอก งูกัดแล้วหนังตาตก ไข้สูงในเด็กเล็ก
        </Text>
      </Panel>
    </Screen>
  );
}
