import React from 'react';
import { View } from 'react-native';
import { AppBar, Button, Screen, Text, Mascot } from '../../design-system';
import { space } from '../../design-system/tokens';
import { useNav } from '../../navigation/types';

/** ข้อมูลของหน้านี้ไม่มีแล้ว (ยกเลิก/ใช้ไปแล้ว/ลิงก์เก่า) → บอกชัด ๆ และมีทางกลับ ไม่ปล่อยจอว่าง */
export function NotFoundScreen({ title, message = 'ไม่พบข้อมูลนี้แล้ว' }: { title: string; message?: string }) {
  const nav = useNav();
  const back = () => (nav.canGoBack() ? nav.goBack() : nav.popTo('ClientTabs', { screen: 'Home' }));
  return (
    <Screen header={<AppBar title={title} onBack={back} />} footer={<Button label="กลับ" variant="secondary" onPress={back} />}>
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
        <Mascot pose="confused" size={140} />
        <Text variant="bodyMd" tone="secondary" align="center">
          {message}
        </Text>
      </View>
    </Screen>
  );
}
