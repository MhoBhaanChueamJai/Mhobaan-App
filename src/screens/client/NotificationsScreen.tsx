import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppBar, Button, Icon, IconBox, Panel, Screen, TINT, Text, useTheme, type IconName, Mascot } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { noticeTs, useJourney, type ApptNotice } from '../../state/JourneyContext';
import { useAppointment } from '../../state/appointments';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';

/**
 * การแจ้งเตือน — จากหน่วยบริการ (รพ. ส่งเคสมา · นัดติดตามคนไข้ · ค่าครู/ค่ายา · ติดตามผล · ใบรับรองใกล้หมดอายุ)
 * รายการ: กรองตามประเภท · จัดกลุ่มตามเวลา (วันนี้ · เมื่อวาน · 7 วันที่ผ่านมา · ก่อนหน้า) · ยังไม่อ่าน = จุดสี
 * แตะ = หน้ารายละเอียด (อ่านแล้ว) → สถานะล่าสุดของเรื่องนั้น + ปุ่มทำต่อ
 */
const KIND: Record<ApptNotice['kind'], { icon: IconName; tint: string; title: string; group: Filter }> = {
  moved: { icon: 'calendar', tint: TINT.amber, title: 'เลื่อนนัด', group: 'appt' },
  cancelled: { icon: 'x-circle', tint: TINT.red, title: 'ยกเลิกนัด', group: 'appt' },
  confirmed: { icon: 'check-circle', tint: TINT.green, title: 'ยืนยันนัด', group: 'appt' },
  rejected: { icon: 'slash', tint: TINT.red, title: 'คำขอนัดไม่สำเร็จ', group: 'appt' },
  reminder: { icon: 'clock', tint: TINT.blue, title: 'ถึงวันนัดติดตาม', group: 'appt' },
  noshow: { icon: 'user-x', tint: TINT.red, title: 'คนไข้ไม่มาตามนัด', group: 'appt' },
  waitlist: { icon: 'users', tint: TINT.violet, title: 'รพ. ส่งเคสมา', group: 'appt' },
  bill: { icon: 'credit-card', tint: TINT.amber, title: 'ค่าครูยังไม่ได้รับ', group: 'pay' },
  receipt: { icon: 'file-text', tint: TINT.green, title: 'รับค่าครูแล้ว', group: 'pay' },
  followup: { icon: 'activity', tint: TINT.violet, title: 'ติดตามอาการคนไข้', group: 'care' },
};
type Filter = 'all' | 'appt' | 'pay' | 'care';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'appt', label: 'นัดหมาย' },
  { key: 'pay', label: 'ค่าครู' },
  { key: 'care', label: 'ติดตามผล' },
];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DAY = 86400000;
const startOfDay = (t: number) => new Date(new Date(t).toDateString()).getTime();
const tsOf = (n: ApptNotice) => n.ts ?? noticeTs(n.at);
/** เวลาที่แสดง (คิดใหม่ทุกครั้ง — "วันนี้" ของเมื่อวานกลายเป็น "เมื่อวาน") */
export function noticeTime(n: ApptNotice) {
  const t = tsOf(n);
  const d = new Date(t);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (days <= 0) return `วันนี้ ${hm}`;
  if (days === 1) return `เมื่อวาน ${hm}`;
  const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear() + 543}` : '';
  return `${d.getDate()} ${TH_MON[d.getMonth()]}${y} ${hm}`;
}
/** คำบอกวันในข้อความ (วันนี้ / พรุ่งนี้) เขียนตอนแจ้ง → ผ่านวันนั้นไปแล้วแสดงเป็นวันที่จริง (ไม่ให้ "พรุ่งนี้" ของสัปดาห์ก่อนชวนเข้าใจผิด) */
export function noticeText(n: ApptNotice) {
  const t = tsOf(n);
  if (startOfDay(t) === startOfDay(Date.now())) return n.text;
  const dayOf = (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()} ${TH_MON[d.getMonth()]}`;
  };
  return n.text.replace(/วันนี้/g, dayOf(t)).replace(/พรุ่งนี้/g, dayOf(t + DAY));
}
const bucketOf = (n: ApptNotice) => {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(tsOf(n))) / DAY);
  return days <= 0 ? 'วันนี้' : days === 1 ? 'เมื่อวาน' : days <= 7 ? '7 วันที่ผ่านมา' : 'ก่อนหน้า';
};
const BUCKETS = ['วันนี้', 'เมื่อวาน', '7 วันที่ผ่านมา', 'ก่อนหน้า'];
/** ก่อนหน้า: แสดงทีละชุด (แจ้งเตือนเก่าสะสมได้ยาว) */
const OLD_PAGE = 10;

export function NotificationsScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { apptNotices, markAllNoticesRead } = useJourney();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [oldShown, setOldShown] = React.useState(OLD_PAGE);
  const list = apptNotices.filter((n) => filter === 'all' || KIND[n.kind].group === filter).sort((a, b) => tsOf(b) - tsOf(a));
  const unread = apptNotices.some((n) => !n.read);

  const row = (n: ApptNotice, last: boolean) => {
    const k = KIND[n.kind];
    return (
      <Pressable
        key={n.id}
        accessibilityRole="button"
        accessibilityLabel={`${k.title} ${noticeText(n)}${n.read ? '' : ' ยังไม่อ่าน'}`}
        onPress={() => nav.navigate('NotificationDetail', { id: n.id })}
        style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
          <IconBox icon={k.icon} tint={k.tint} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Text variant="labelMd" style={{ flex: 1 }}>
                {k.title}
              </Text>
              <Text variant="caption" tone="tertiary">
                {/* กลุ่มบอกวันแล้ว (วันนี้ / เมื่อวาน) → เหลือแค่เวลา */}
                {noticeTime(n).replace(/^(วันนี้|เมื่อวาน) /, '')}
              </Text>
            </View>
            <Text variant="bodySm" tone={n.read ? 'secondary' : 'primary'} numberOfLines={2}>
              {noticeText(n)}
            </Text>
          </View>
          {/* ยังไม่อ่าน = จุดสีหลักของแอป */}
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 8, backgroundColor: n.read ? 'transparent' : colors.brand.primary }} />
        </View>
      </Pressable>
    );
  };

  return (
    <Screen
      header={
        <AppBar
          title="การแจ้งเตือน"
          onBack={() => nav.goBack()}
          right={
            unread ? (
              <Pressable accessibilityRole="button" onPress={markAllNoticesRead} hitSlop={8}>
                <Text variant="labelMd" color={colors.brand.primary}>
                  อ่านทั้งหมด
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space[4] }} contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4] }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          const n = f.key === 'all' ? 0 : apptNotices.filter((x) => !x.read && KIND[x.kind].group === f.key).length;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => (setFilter(f.key), setOldShown(OLD_PAGE))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], height: 36, paddingHorizontal: space[4], borderRadius: radius.full, backgroundColor: on ? colors.text.primary : colors.surface.default, borderWidth: 1, borderColor: on ? colors.text.primary : colors.border.subtle }}
            >
              <Text variant="labelMd" color={on ? colors.text.inverse : colors.text.primary}>
                {f.label}
              </Text>
              {n ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.primary }} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {list.length ? (
        BUCKETS.map((b) => {
          const all = list.filter((n) => bucketOf(n) === b);
          if (!all.length) return null;
          const items = b === 'ก่อนหน้า' ? all.slice(0, oldShown) : all;
          return (
            <Panel key={b} title={b} flush>
              {items.map((n, i) => row(n, i === items.length - 1))}
              {items.length < all.length ? (
                <Pressable accessibilityRole="button" onPress={() => setOldShown((v) => v + OLD_PAGE)} style={{ alignItems: 'center', paddingVertical: space[3], borderTopWidth: 1, borderTopColor: colors.border.subtle, marginHorizontal: space[4] }}>
                  <Text variant="labelMd" color={colors.brand.primary}>
                    {`ดูเพิ่ม (${all.length - items.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </Panel>
          );
        })
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <Mascot pose="reminder" size={140} />
          <Text variant="bodyMd" tone="secondary">
            {filter === 'all' ? 'ยังไม่มีการแจ้งเตือน' : 'ไม่มีการแจ้งเตือนประเภทนี้'}
          </Text>
        </View>
      )}
    </Screen>
  );
}

/**
 * รายละเอียดแจ้งเตือน — ข้อความเต็ม · สถานะล่าสุดของคนไข้นั้น (นัดตอนนี้ · รับค่าครูแล้วหรือยัง) · ปุ่มทำต่อ
 * แจ้งเตือนเก่าที่เรื่องเปลี่ยนไปแล้ว (นัดผ่านไปแล้ว · รับค่าครูแล้ว) → บอกสถานะปัจจุบัน ไม่ชวนทำสิ่งที่หมดเวลาแล้ว
 */
export function NotificationDetailScreen({ route }: { route: { params: { id: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { apptNotices, dismissNotice, bills, cases } = useJourney();
  const n = apptNotices.find((x) => x.id === route.params.id);
  const appt = useAppointment(n ? { caseId: n.caseId, draftId: n.draftId, looseId: n.looseId } : null);
  React.useEffect(() => {
    if (n && !n.read) dismissNotice(n.id);
  }, [n, dismissNotice]);
  if (!n) return <NotFoundScreen title="การแจ้งเตือน" message="ไม่พบการแจ้งเตือนนี้" />;
  const k = KIND[n.kind];
  const bill = n.billId ? bills.find((b) => b.id === n.billId) : undefined;
  const tc = n.caseId ? cases.find((c) => c.id === n.caseId) : undefined;
  const old = bucketOf(n) !== 'วันนี้';

  // ปุ่มทำต่อ ตามประเภท + สถานะปัจจุบัน
  const action: { label: string; icon: IconName; go: () => void } | null = bill
    ? bill.status === 'paid'
      ? { label: 'ดูใบรับค่าครู', icon: 'file-text', go: () => nav.navigate('Bill', { id: bill.id }) }
      : { label: `บันทึกรับ ${bill.total.toLocaleString()} บาท`, icon: 'credit-card', go: () => nav.navigate('Bill', { id: bill.id }) }
    : n.kind === 'followup' && n.draftId
      ? // คนไข้ที่พักไว้ (สัญญาณอันตราย/ส่งต่อ) → ประเมินแบบสั้น
        { label: 'ประเมินใหม่', icon: 'refresh-cw', go: () => nav.popTo('ClientTabs', { screen: 'Home', params: { recheckDraft: n.draftId } } as never) }
      : n.kind === 'followup'
      ? { label: 'อัปเดตอาการคนไข้', icon: 'activity', go: () => nav.popTo('ClientTabs', { screen: 'Home', params: { assessCase: n.caseId } }) }
      : n.kind === 'waitlist' || n.kind === 'rejected' || n.kind === 'cancelled' || n.kind === 'noshow'
        ? { label: 'นัดคนไข้ใหม่', icon: 'calendar', go: () => nav.navigate('Booking') }
        : appt
          ? { label: 'ดูรายละเอียดนัด', icon: 'calendar', go: () => nav.navigate('AppointmentDetail', { caseId: n.caseId, draftId: n.draftId, looseId: n.looseId }) }
          : null;

  const info = (label: string, value?: string) =>
    value ? (
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Text variant="bodySm" tone="secondary" style={{ width: 96 }}>
          {label}
        </Text>
        <Text variant="bodySm" style={{ flex: 1, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
    ) : null;

  return (
    <Screen header={<AppBar title="การแจ้งเตือน" onBack={() => nav.goBack()} />} footer={action ? <Button label={action.label} iconLeft={action.icon} onPress={action.go} /> : undefined}>
      <View style={{ alignItems: 'center', gap: space[2], paddingTop: space[4] }}>
        <IconBox icon={k.icon} tint={k.tint} size={56} />
        <Text variant="titleLg">{k.title}</Text>
        <Text variant="caption" tone="tertiary">
          {noticeTime(n)}
        </Text>
      </View>
      <Panel>
        <Text variant="bodyMd">{noticeText(n)}</Text>
      </Panel>
      {/* สถานะล่าสุดของคนไข้นี้ (อาจเปลี่ยนไปหลังแจ้งเตือน) */}
      {bill ? (
        <Panel title="ค่าครู/ค่ายา">
          {info('รายการ', bill.title)}
          {info('ยอด', `${bill.total.toLocaleString()} บาท`)}
          {info('สถานะ', bill.status === 'paid' ? `รับแล้ว${bill.paidAt ? ` · ${bill.paidAt}` : ''}` : 'ยังไม่ได้รับ')}
          {info('เลขที่ใบรับ', bill.status === 'paid' ? bill.receiptNo : undefined)}
        </Panel>
      ) : appt ? (
        <Panel title="นัดตอนนี้">
          {info('คนไข้', appt.topic ?? tc?.short)}
          {info('วันเวลา', `${appt.date} ${appt.time}`)}
          {info('หน่วยบริการ', appt.clinic)}
          {info('ผู้ดูแล', appt.therapist)}
          {info('สถานะ', appt.pending ? 'รอหน่วยบริการยืนยัน' : appt.stage === 'in_service' ? 'กำลังรักษา' : appt.stage === 'checked_in' || appt.stage === 'called' ? 'เช็กอินแล้ว' : 'ยืนยันแล้ว')}
        </Panel>
      ) : n.caseId || n.draftId || n.looseId ? (
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Icon name="info" size="sm" color={colors.text.tertiary} />
            <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
              {old ? 'นัดนี้ผ่านไปแล้ว หรือไม่มีนัดที่รออยู่ในตอนนี้' : 'ยังไม่มีนัดที่รออยู่ของคนไข้นี้'}
            </Text>
          </View>
        </Panel>
      ) : null}
    </Screen>
  );
}
