import React from 'react';
import { ScrollView, View } from 'react-native';
import {
  AppBar,
  Button,
  HStack,
  ProgressBar,
  Screen,
  Text,
  VStack,
  space,
  Panel,
  ReplyChips,
  Mascot,
  ELEMENT_PASTEL,
  ElementMascotAnimated,
} from '../../design-system';
import {
  ELEMENT_INFO,
  ELEMENT_PRINCIPLE,
  ELEMENT_QUIZ,
  dominantElement,
  elementPercents,
  type ElementKey,
} from '../../data/thaiMassageKnowledge';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

const ORDER: ElementKey[] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];

/**
 * ธาตุเจ้าเรือน (CPG_PCU หน้า 163–164)
 *   มีผลแล้ว = หน้ารายละเอียด: ผลของคุณ (ความหมาย · ลักษณะ · ควรระวัง · อาหาร) + ปุ่ม "ประเมินใหม่" ด้านล่าง
 *   ยังไม่เคยทำ / กดประเมินใหม่ = โหมดแบบประเมิน 14 ข้อ (ไม่ปนกับผล) → บันทึกแล้วกลับมาหน้าผล
 * ลักษณะของธาตุ = คำตอบของธาตุนั้นในแบบประเมิน
 */
export function ElementQuizScreen() {
  const nav = useNav();
  const { elements, setElements, log, newPatient, elementsDone } = useJourney();
  // คนใหม่ที่ยังไม่เคยทำ → ไม่มี "ผลที่บันทึกไว้" (ไม่แสดงค่าตัวอย่าง)
  const hasSaved = elementsDone || !newPatient;
  const [retake, setRetake] = React.useState(false);
  const quiz = !hasSaved || retake;
  const blank = () => Array<ElementKey | undefined>(ELEMENT_QUIZ.length).fill(undefined);
  const [answers, setAnswers] = React.useState<(ElementKey | undefined)[]>(blank);
  const answered = answers.filter(Boolean).length;
  const done = answered === ELEMENT_QUIZ.length;
  const top = dominantElement(elements);
  const info = ELEMENT_INFO[top];
  // "ธาตุไฟ (ปิตตะ)" → ชื่อ + ชื่อบาลีบรรทัดรอง
  const [, name = info.label, pali] = /^(.*?)(?: \((.*)\))?$/.exec(info.label) ?? [];
  const scrollRef = React.useRef<ScrollView | null>(null);
  const toTop = () => setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 0);

  const save = () => {
    const pct = elementPercents(answers);
    const t = dominantElement(pct);
    setElements(pct);
    log('พ่อหมอ', `ประเมินธาตุเจ้าเรือนปัจจุบัน: ${ELEMENT_INFO[t].label} ${pct[t]}%`);
    // กลับมาหน้าผล (ผลใหม่)
    setAnswers(blank());
    setRetake(false);
    toTop();
  };
  // ออกจากแบบประเมินที่เปิดจากหน้าผล → กลับหน้าผล (ไม่ออกจากหน้า)
  const back = () => {
    if (retake) {
      setRetake(false);
      setAnswers(blank());
      toTop();
    } else nav.goBack();
  };

  if (quiz)
    return (
      <Screen
        scrollRef={scrollRef}
        header={<AppBar title={retake ? 'ประเมินธาตุใหม่' : 'ธาตุเจ้าเรือน'} onBack={back} />}
        footer={<Button label={done ? 'บันทึกผลธาตุเจ้าเรือน' : `ตอบแล้ว ${answered}/${ELEMENT_QUIZ.length} ข้อ`} disabled={!done} onPress={save} />}
      >
        {retake ? null : (
          <Panel title="ธาตุเจ้าเรือนคืออะไร">
            <View style={{ alignItems: 'center' }}>
              <Mascot pose="assess" size={140} />
            </View>
            <Text variant="bodySm">{ELEMENT_PRINCIPLE.replace(' · ', ' ')}</Text>
            <Text variant="bodySm" tone="secondary">
              ตอบ 14 ข้อด้านล่าง เพื่อรู้ว่าธาตุไหนเด่นในตัวคุณ
            </Text>
          </Panel>
        )}
        {/* 14 ข้อ ข้อละ 1 คำตอบ · ความคืบหน้าบอกที่ปุ่มด้านล่าง */}
        <ProgressBar value={answered / ELEMENT_QUIZ.length} />
        {ELEMENT_QUIZ.map((q, i) => {
          const labels = ORDER.map((k) => q.options[k]);
          const current = answers[i] ? q.options[answers[i]!] : undefined;
          return (
            <Panel key={q.topic} title={`${i + 1}. ${q.topic}`}>
              <ReplyChips
                options={labels}
                selected={current}
                onPick={(picked) => {
                  const key = ORDER.find((k) => q.options[k] === picked);
                  const next = [...answers];
                  next[i] = key;
                  setAnswers(next);
                }}
              />
            </Panel>
          );
        })}
      </Screen>
    );

  return (
    <Screen
      scrollRef={scrollRef}
      header={<AppBar title="ธาตุเจ้าเรือน" onBack={back} />}
      footer={
        <Button
          label="ประเมินใหม่"
          variant="secondary"
          onPress={() => {
            setRetake(true);
            toTop();
          }}
        />
      }
    >
      {/* การ์ดธาตุ: ป้ายเล็ก → ชื่อธาตุ (+ ชื่อบาลี) → ความหมาย · ชิดซ้ายเหมือนหัวข้อ · น้องประคบในวงพาสเทลของธาตุด้านขวา */}
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
          <View style={{ flex: 1, gap: space[2] }}>
            <Text variant="labelSm" tone="tertiary">
              ธาตุเจ้าเรือนของคุณ
            </Text>
            <View style={{ gap: 2 }}>
              <Text variant="titleLg">{name}</Text>
              {pali ? (
                <Text variant="bodyXs" tone="tertiary">
                  {pali}
                </Text>
              ) : null}
            </View>
            <Text variant="bodySm" tone="secondary">
              {info.meaning}
            </Text>
          </View>
          {/* ทุกธาตุขนาดเท่ากัน · ฐานของธาตุ (ดิน · คลื่น · เมฆ · กองไฟ) ชิดขอบล่างของวง */}
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: ELEMENT_PASTEL[top], overflow: 'hidden' }}>
            {/* ย่อให้ของบนหัว (บัว · กังหัน · เทียน สูงกว่าต้นอ่อน) ไม่ชนขอบโค้งของวง รวมตอนขยับ */}
            <View style={{ position: 'absolute', left: 5, bottom: -1 }}>
              <ElementMascotAnimated element={top} size={94} />
            </View>
          </View>
        </View>
      </Panel>
      {/* ลักษณะของคนธาตุนี้ = คำตอบของธาตุนั้นในแบบประเมิน */}
      <Panel title={`ลักษณะของคน${info.label.replace(/ \(.*\)/, '')}`}>
        <VStack gap={2}>
          {ELEMENT_QUIZ.slice(0, 8).map((q) => (
            <HStack key={q.topic} gap={3} align="flex-start">
              <Text variant="bodySm" tone="secondary" style={{ width: 92 }}>
                {q.topic}
              </Text>
              <Text variant="bodySm" style={{ flex: 1 }}>
                {q.options[top]}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Panel>
      <Panel title="ควรระวัง">
        <Text variant="bodySm">{info.tendency}</Text>
      </Panel>
      {info.foods ? (
        <Panel title="อาหารที่ช่วยปรับสมดุล">
          <Text variant="bodySm">{info.foods}</Text>
        </Panel>
      ) : null}
    </Screen>
  );
}
