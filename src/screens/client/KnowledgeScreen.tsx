import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Banner, Icon, IconBox, Panel, ReplyChips, RowLink, Screen, SectionHeader, TINT, Tag, Text, TextField, radius, space, useTheme } from '../../design-system';
import { useNav } from '../../navigation/types';
import { KNOWLEDGE_TOPICS, bookOf } from '../../data/knowledgeTopics';
import { loadKnowledge, pageCounts, quoteAround, searchKnowledge, type KBPage } from '../../services/knowledgeSearch';
import { NotFoundScreen } from './NotFound';

const TOPIC_TINT = [TINT.slate, TINT.green, TINT.amber, TINT.blue];

/**
 * คลังความรู้ — หัวข้อ → เล่ม (Knowledge Hub หมอพื้นบ้าน)
 * เนื้อหาชุดเดียวกับที่ AI ใช้ตอบในแชท (assets/kb/kb.txt) · แตะเล่มเพื่ออ่านสรุปและค้นในเล่ม
 */
export function KnowledgeScreen() {
  const nav = useNav();
  const [pages, setPages] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    pageCounts().then(setPages).catch(() => {});
  }, []);
  return (
    <Screen header={<AppBar title="คลังความรู้" onBack={() => nav.goBack()} />}>
      {KNOWLEDGE_TOPICS.map((t, ti) => (
        <View key={t.id} style={{ gap: space[2] }}>
          <SectionHeader title={t.title} subtitle={t.sub} />
          {t.pending ? (
            <Panel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <IconBox icon="clock" tint={TINT.slate} />
                <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
                  หัวข้อชุดนี้กำลังเตรียมเนื้อหา
                </Text>
                <Tag text="รอข้อมูล" tone="warn" />
              </View>
            </Panel>
          ) : (
            <Panel flush>
              {t.books.map((b, i) => (
                <RowLink
                  key={b.f}
                  icon={b.icon}
                  tint={TOPIC_TINT[ti % TOPIC_TINT.length]}
                  title={b.f}
                  sub={pages[b.f] ? `${pages[b.f]} ${b.unit ?? 'หน้า'} · ${b.by}` : b.by}
                  last={i === t.books.length - 1}
                  onPress={() => nav.navigate('KnowledgeBook', { f: b.f })}
                />
              ))}
            </Panel>
          )}
        </View>
      ))}
    </Screen>
  );
}

/** เล่มหนึ่งในคลัง: สรุป + สารบัญ (ถ้ามี) + ค้นในเล่ม (ไม่ใช้ AI — ค้นคำตรงตัวจากข้อความรายหน้า) · แตะผลลัพธ์เพื่ออ่านทั้งหน้า */
export function KnowledgeBookScreen({ route }: { route: { params: { f: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const book = bookOf(route.params.f);
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState<KBPage[] | null>(null);
  const [open, setOpen] = React.useState<number | null>(null);
  /** หัวข้อในสารบัญที่เปิดอ่าน + ข้อความของหัวข้อนั้น */
  const [sec, setSec] = React.useState<{ p: number; t: string } | null>(null);
  const unit = book?.unit ?? 'หน้า';
  const read = (p: number) => {
    if (!book || sec?.p === p) return setSec(null);
    loadKnowledge()
      .then((all) => setSec({ p, t: all.filter((pg) => pg.f === book.f && pg.p === p).map((pg) => pg.t).join('\n') }))
      .catch(() => setSec(null));
  };
  const run = React.useCallback(
    (text: string) => {
      setQ(text);
      setOpen(null);
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length || !book) return setHits(null);
      searchKnowledge(words, 8, book.f)
        .then(setHits)
        .catch(() => setHits([]));
    },
    [book],
  );
  if (!book) return <NotFoundScreen title="คลังความรู้" />;
  const words = q.split(/\s+/).filter(Boolean);
  return (
    <Screen header={<AppBar title={book.f} onBack={() => nav.goBack()} />}>
      <Panel icon={book.icon} title="เล่มนี้ว่าด้วย">
        <Text variant="bodyMd">{book.about}</Text>
        <Text variant="bodyXs" tone="secondary">
          {book.by}
        </Text>
      </Panel>
      {book.toc ? (
        <Panel title="สารบัญ" flush>
          {book.toc.map((c, i) => (
            <Pressable
              key={c.p}
              accessibilityRole="button"
              accessibilityLabel={`${unit} ${c.p} ${c.title} ${sec?.p === c.p ? 'ย่อ' : 'อ่าน'}`}
              onPress={() => read(c.p)}
              style={({ pressed }) => ({ gap: space[2], paddingVertical: space[3], paddingHorizontal: space[4], borderTopWidth: i ? 1 : 0, borderTopColor: colors.border.subtle, backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Text variant="labelMd" tone="secondary" style={{ width: 24 }}>
                  {c.p}
                </Text>
                <Text variant="labelLg" style={{ flex: 1 }}>
                  {c.title}
                </Text>
                <Icon name={sec?.p === c.p ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.text.tertiary} />
              </View>
              {sec?.p === c.p ? (
                <Text variant="bodySm" tone="secondary">
                  {sec.t.replace(/^[^\n]*\n/, '')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </Panel>
      ) : null}
      <TextField iconLeft="search" placeholder={`ค้นในเล่มนี้ เช่น ${book.ask[0]}`} value={q} onChangeText={setQ} onSubmitEditing={() => run(q)} returnKeyType="search" />
      <ReplyChips options={book.ask} selected={q} onPick={run} />
      {hits === null ? null : hits.length ? (
        <View style={{ gap: space[2] }}>
          <SectionHeader title={`พบ ${hits.length} ${unit}`} />
          {hits.map((pg, i) => (
            <Pressable
              key={`${pg.p}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${unit} ${pg.p} ${open === i ? 'ย่อ' : `อ่านทั้ง${unit}`}`}
              onPress={() => setOpen(open === i ? null : i)}
              style={{ gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Icon name="file-text" size="xs" color={colors.brand.primary} />
                <Text variant="labelSm" style={{ flex: 1 }}>
                  {unit} {pg.p}
                </Text>
                <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size="xs" color={colors.text.tertiary} />
              </View>
              <Text variant="bodySm" tone="secondary">
                {open === i ? pg.t : quoteAround(pg.t, words)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="bodyMd" tone="secondary" align="center">
          ไม่พบ “{q}” ในเล่มนี้
        </Text>
      )}
      {book.toc ? null : <Banner tone="info" icon="info" title="ข้อความถอดจากเอกสารต้นฉบับ" message="บางคำอาจสะกดเพี้ยนจากการแปลงไฟล์ · ใช้เพื่อการเรียนรู้ ไม่ใช่คำแนะนำการรักษา" />}
    </Screen>
  );
}
