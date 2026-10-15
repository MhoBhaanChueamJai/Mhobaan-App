import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Button, Icon, IconBox, Panel, Screen, TINT, Text, fontFamily, useTheme, Mascot } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney, type Bill } from '../../state/JourneyContext';
import { CASE_CLINIC_DEFAULT } from '../../state/appointments';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';
import { ReceiptSlip } from './ReceiptSlip';

/** วิธีรับค่าครู/ค่ายา (ชุดเดียวกับหลังบ้าน) → ป้ายในแอป · รับผ่านแอป หรือรับเงินสด */
const METHOD: Record<NonNullable<Bill['method']>, { label: string; where: 'app' | 'counter' }> = {
  app: { label: 'รับผ่านแอป', where: 'app' },
  cash: { label: 'เงินสด · รับที่บ้าน', where: 'counter' },
  promptpay: { label: 'QR พร้อมเพย์ · ที่บ้าน', where: 'counter' },
  credit: { label: 'ยกครูไว้แล้ว', where: 'counter' },
};
const methodLabel = (b: Bill) => (b.method ? METHOD[b.method].label : 'รับแล้ว');

/**
 * ค่าครู/ค่ายา — ยังไม่ได้รับ (รับผ่านแอป หรือเงินสด) · รับแล้ว (ใบรับค่าครูจากระบบ) · แล้วแต่ศรัทธา
 * ⚠️ ต้นแบบ: ยังไม่ได้ต่อระบบชำระเงินจริง
 */
export function BillsScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { bills } = useJourney();
  const pending = bills.filter((b) => b.status === 'pending');
  const paid = bills.filter((b) => b.status === 'paid');
  const row = (b: Bill, last: boolean) => (
    <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.title} ${b.total} บาท`} onPress={() => nav.navigate('Bill', { id: b.id })} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
        <IconBox icon={b.status === 'pending' ? 'credit-card' : 'file-text'} tint={b.status === 'pending' ? TINT.amber : TINT.green} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="labelMd">{b.title}</Text>
          <Text variant="bodyXs" tone="secondary">
            {b.status === 'pending' ? `รักษา ${b.date}` : `${methodLabel(b)} · ${b.paidAt ?? ''}`}
          </Text>
        </View>
        <Text variant="labelLg">{b.total.toLocaleString()} ฿</Text>
        <Icon name="chevron-right" size="sm" color={colors.text.tertiary} />
      </View>
    </Pressable>
  );
  return (
    <Screen header={<AppBar title="ค่าครู / ค่ายา" onBack={() => nav.goBack()} />}>
      {bills.length ? (
        <>
          {pending.length ? (
            <Panel title="ยังไม่ได้รับ" flush>
              {pending.map((b, i) => row(b, i === pending.length - 1))}
            </Panel>
          ) : null}
          {paid.length ? (
            <Panel title="รับแล้ว" flush>
              {paid.map((b, i) => row(b, i === paid.length - 1))}
            </Panel>
          ) : null}
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <Mascot pose="rest" size={140} />
          <Text variant="bodyMd" tone="secondary">
            ยังไม่มีรายการค่าครู
          </Text>
        </View>
      )}
    </Screen>
  );
}

export function BillScreen({ route }: { route: { params: { id: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { bills, payBill, log, cases, client } = useJourney();
  const b = bills.find((x) => x.id === route.params.id);
  if (!b) return <NotFoundScreen title="ค่าครู/ค่ายา" />;
  const paid = b.status === 'paid';
  const tc = cases.find((c) => c.id === b.caseId);
  const clinic = tc?.clinic ?? CASE_CLINIC_DEFAULT;

  // รับแล้ว → ใบรับค่าครู (หน้าตาเดียวกับใบรับของหลังบ้าน)
  if (paid) {
    return (
      <Screen header={<AppBar title="ใบรับค่าครู" onBack={() => nav.goBack()} />}>
        <ReceiptSlip
          clinic={clinic}
          total={b.total}
          method={methodLabel(b)}
          no={b.receiptNo ?? '-'}
          date={b.paidAt ?? b.date}
          patient={client.name}
          hn={client.hn}
          therapist={b.therapist || tc?.therapist}
          items={b.items}
        />
      </Screen>
    );
  }

  // ยังไม่ได้รับ → บันทึกรับในแอป หรือรับเงินสด (บันทึกแล้วใบรับเข้าแอปเอง)
  return (
    <Screen
      header={<AppBar title="รับค่าครู/ค่ายา" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label={`บันทึกรับเงิน ${b.total.toLocaleString()} บาท`}
          iconLeft="credit-card"
          onPress={() => {
            payBill(b.id);
            log('พ่อหมอ', `รับค่าครู/ค่ายา ${b.title} ${b.total} บาท ในแอป`);
          }}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: space[1], paddingVertical: space[3] }}>
        <Text variant="bodySm" tone="secondary">
          ยอดที่ยังไม่ได้รับ
        </Text>
        <Text style={{ fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 52, color: colors.text.primary }}>
          {b.total.toLocaleString()}
          <Text variant="titleSm" tone="secondary">
            {' '}
            บาท
          </Text>
        </Text>
        <Text variant="bodySm" tone="secondary">
          {b.title} · {b.date}
        </Text>
      </View>
      <Panel title="รายการ">
        {b.items.map((it) => (
          <View key={it.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
            <Text variant="bodyMd" style={{ flex: 1 }}>
              {it.name}
            </Text>
            <Text variant="bodyMd">{it.amount.toLocaleString()} ฿</Text>
          </View>
        ))}
      </Panel>
      <Panel title="รับได้ 2 ทาง">
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <IconBox icon="smartphone" tint={TINT.green} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelMd">บันทึกรับในแอป</Text>
            <Text variant="bodySm" tone="secondary">
              กดปุ่มด้านล่าง ใบรับค่าครูขึ้นในแอปทันที
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <IconBox icon="home" tint={TINT.amber} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelMd">รับที่บ้านพ่อหมอ</Text>
            <Text variant="bodySm" tone="secondary">
              เงินสดหรือ QR พร้อมเพย์ แล้วแต่ศรัทธา ใบรับเข้าแอปหลังบันทึก
            </Text>
          </View>
        </View>
      </Panel>
    </Screen>
  );
}

/** เส้นประคั่นแบบใบรับ */
function Dash() {
  const { colors } = useTheme();
  return <View style={{ height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border.default }} />;
}
