import React from 'react';
import { View } from 'react-native';
import {
  AppBar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  HStack,
  Icon,
  Placeholder,
  Screen,
  Text,
  VStack,
  useTheme,
  type IconName,
  Panel,
  Tag,
} from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { saveConsents } from '../../services/auth';

/* ============================================================ 02 CONSENT */

export function ConsentScreen({ route }: { route?: { params?: { from?: 'signup' } } }) {
  const nav = useNav();
  const fromSignup = route?.params?.from === 'signup';
  const { consents, setConsents, log, account } = useJourney();
  const ready = consents.service && consents.aiProcessing;
  return (
    <Screen
      header={<AppBar title="ความยินยอมและความเป็นส่วนตัว" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button
            label={ready ? 'ยินยอมและดำเนินการต่อ' : 'โปรดยอมรับข้อที่จำเป็น (2 ข้อ)'}
            disabled={!ready}
            onPress={() => {
              log('พ่อหมอ', 'ให้ความยินยอม (บริการ, AI' + (consents.followUp ? ', ติดตามผล' : '') + (consents.research ? ', วิจัย' : '') + ')');
              // บัญชีจริง → เก็บความยินยอมกับบัญชี (เข้าเครื่องอื่นไม่ต้องถามซ้ำ)
              if (account?.userId) void saveConsents(consents).catch(() => undefined);
              // มาจากการสมัคร → เข้าหน้าแรกแบบเริ่มต้นใช้งาน (ย้อนกลับไปหน้าสมัครไม่ได้)
              if (fromSignup) nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
              else nav.replace('Interview');
            }}
          />
          <Text variant="labelSm" tone="tertiary" align="center">
            เปลี่ยนแปลงหรือถอนความยินยอมได้ตลอดเวลาที่ “โปรไฟล์ › ความเป็นส่วนตัว”
          </Text>
        </>
      }
    >
      <Text variant="bodyMd" tone="secondary">
        เราใช้ข้อมูลการรักษาเท่าที่จำเป็นเพื่อทำทะเบียน ม.บ.5 และส่งต่อคนไข้ เลือกได้ว่าจะอนุญาตเรื่องใด
      </Text>

      <Panel title="จำเป็นสำหรับการบันทึกการรักษา" right={<Tag text="จำเป็น" />}>
        <Checkbox
          label="ใช้ข้อมูลคนไข้เพื่อบันทึกและส่งต่อการรักษา"
          description="อาการ โรคประจำตัว ยา — เฉพาะหน่วยบริการที่คนไข้ยินยอมเท่านั้นที่เห็น"
          checked={consents.service}
          onChange={(v) => setConsents({ ...consents, service: v })}
        />
        <Divider />
        <Checkbox
          label="ให้หมอบ้าน AI ช่วยกรอกทะเบียน ม.บ.5"
          description="AI เป็นผู้ช่วยเท่านั้น ไม่วินิจฉัยโรค พ่อหมอเป็นผู้ยืนยันทุกครั้ง"
          checked={consents.aiProcessing}
          onChange={(v) => setConsents({ ...consents, aiProcessing: v })}
        />
      </Panel>

      <Panel title="เลือกได้ตามต้องการ" right={<Tag text="ไม่บังคับ" />}>
        <Checkbox
          label="ติดตามอาการคนไข้หลังรักษา"
          description="แจ้งเตือนถามอาการคนไข้ หลังรักษา 1, 3 และ 7 วัน"
          checked={consents.followUp}
          onChange={(v) => setConsents({ ...consents, followUp: v })}
        />
        <Divider />
        <Checkbox
          label="ใช้ข้อมูลแบบไม่ระบุตัวตนเพื่อการวิจัย"
          description="ช่วยพัฒนาองค์ความรู้การแพทย์พื้นบ้าน"
          checked={consents.research}
          onChange={(v) => setConsents({ ...consents, research: v })}
        />
      </Panel>

      <Button label="อ่านนโยบายฉบับเต็ม" variant="ghost" iconRight="external-link" fullWidth={false} />

    </Screen>
  );
}
