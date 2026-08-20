import { describe, expect, it } from 'vitest';
import { indicators } from './indicators';
import { sourceIdOf } from '@/components/charts/indicator-explanation';

/**
 * 読者向け解説が守るべき約束 (#208)。
 *
 * 171 件を別々の PR で書くため、書き手 (将来の自分) が忘れても落ちるようにしておく。
 * #209〜#211 で 165 件を書き足す予定で、**そのときに効かせるための固定**。
 */
const explained = Object.entries(indicators).filter(([, i]) => i.explanation !== undefined);

describe('指標の読者向け解説', () => {
  it('実証ぶんが存在する', () => {
    expect(explained.length).toBeGreaterThan(0);
  });

  // #52: 恣意的な閾値を置かない。「上がると悪い」と書くのは線を引くのと同じ。
  // 定義から決まる基準は baseline で示す。
  it.each(explained)('%s: 評価語を含まない', (_id, indicator) => {
    const text = Object.values(indicator.explanation ?? {}).join('');
    expect(text).not.toMatch(/危険|悪化のサイン|買い時|売り時|望ましい水準/);
  });

  // #198: BUSLOANS を百万ドルと書き誤った。単位は unitLabel 1 か所に持ち、
  // 本文に埋め込むと同じ誤りが読者に届く。
  it.each(explained)('%s: 本文に単位を書かない', (_id, indicator) => {
    const text = Object.values(indicator.explanation ?? {}).join('');
    expect(text).not.toMatch(/百万ドル|十億ドル|千戸|億円/);
  });

  // 出所と系列 ID は指標マスタから自動生成する。
  //
  // 「大文字の連続を禁じる」形にはしない。NASDAQ・TOPIX・VIX・CPI のような、
  // 読者が読む文章に当然出てよい語まで弾いてしまう。**自分の系列 ID だけ**を禁じる。
  it.each(explained)('%s: 本文に自分の系列 ID を書かない', (_id, indicator) => {
    const sourceId = sourceIdOf(indicator);
    if (sourceId === null) return;
    const text = Object.values(indicator.explanation ?? {}).join('');
    // 部分一致では落とせない。NFCI の解説は ANFCI (図の 2 本目の凡例名) に触れており、
    // 部分文字列としては自分の ID を含んでしまう。単語境界で見る。
    expect(text).not.toMatch(new RegExp(`\\b${sourceId}\\b`));
  });

  // note は開発メモ。Issue 番号やコード識別子が読者に出ないよう分けている。
  it.each(explained)('%s: 開発メモを混ぜない', (_id, indicator) => {
    const text = Object.values(indicator.explanation ?? {}).join('');
    expect(text).not.toMatch(/#\d+|`/);
  });
});

/**
 * 検査そのものが働くことを確かめる (障害注入)。
 *
 * 全件が通るだけでは「検査が緩くて素通りしている」のか「本当に守れている」のかが
 * 区別できない。#102 の「緑だが検証していない」と同じ形の落とし穴になる。
 */
describe('解説の検査が実際に落ちること', () => {
  it('評価語を検知する', () => {
    expect('いま買い時である').toMatch(/危険|悪化のサイン|買い時|売り時|望ましい水準/);
  });

  it('単位の手書きを検知する', () => {
    expect('残高は十億ドル単位で示す').toMatch(/百万ドル|十億ドル|千戸|億円/);
  });

  it('開発メモの混入を検知する', () => {
    expect('#83 で採った指標').toMatch(/#\d+|`/);
  });

  it('自分の系列 ID の混入を検知する', () => {
    expect('BUSLOANS を使う').toMatch(/\bBUSLOANS\b/);
  });

  it('別の系列 ID の一部に一致しない', () => {
    // NFCI の解説が ANFCI に触れても落ちてはいけない。
    expect('景気の影響を除いた ANFCI と並べる').not.toMatch(/\bNFCI\b/);
  });
});
