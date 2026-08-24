import { describe, expect, it } from 'vitest';
import { parseShillerDate, parseShillerSheet } from './shiller';

describe('シラーの日付形式 (ADR-0010)', () => {
  it('月が2桁ならそのまま読む', () => {
    expect(parseShillerDate(2025.12)).toBe('2025-12-01');
    expect(parseShillerDate(2025.01)).toBe('2025-01-01');
  });

  it('10月は小数点以下の末尾ゼロが浮動小数点表現で落ちる (2025.10 === 2025.1)', () => {
    // 9月は "2025.09" (2桁のまま)。10月だけ "2025.1" になり、
    // 文字列としてそのまま "." で分割すると「1月」と誤読する。
    expect(parseShillerDate(2025.09)).toBe('2025-09-01');
    expect(parseShillerDate(2025.1)).toBe('2025-10-01');
  });

  it('存在しない月は例外にする', () => {
    expect(() => parseShillerDate(2025.13)).toThrow();
    expect(() => parseShillerDate(2025.0)).toThrow();
  });
});

describe('Data シートのパース (#291)', () => {
  // 実ファイルの行構造を模す。0〜7 行目はタイトル・複数行ヘッダーで、
  // "Date" と "CAPE" が両方揃う行 (実データでは7行目) がヘッダー。
  const header = [
    'Date', 'P', 'D', 'E', 'CPI', 'Fraction', 'Rate GS10', 'Price', 'Dividend',
    'Price', 'Earnings', 'Earnings', 'CAPE', undefined, 'TR CAPE', undefined,
    'Yield', 'Returns', 'Returns', 'Real Return', 'Real Return', 'Returns',
  ];

  it('Date と CAPE が両方揃う行をヘッダーとして CAPE 列を特定する', () => {
    const rows = [
      ['taitoru'],
      [],
      [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'CAPE'], // タイトル行に単体の "CAPE" が出るが Date が無いので誤って拾わない
      header,
      [1881.01, 6.05, 0.36, 0.53, 12.35, 1881.04, 3.34, 100, 100, 100, 100, 100, 18.47],
      [1881.02, 6.06, 0.37, 0.53, 12.4, 1881.13, 3.35, 100, 100, 100, 100, 100, 18.5],
    ];
    const observations = parseShillerSheet(rows);
    expect(observations['1881-01-01']).toBe(18.47);
    expect(observations['1881-02-01']).toBe(18.5);
  });

  it('数値でない脚注行は飛ばす', () => {
    const rows = [
      header,
      [2026.07, 100, 1, 1, 100, 2026.5, 4, 100, 100, 100, 100, 100, 40.6],
      [undefined, undefined, undefined, undefined, "Oct '25/July/Aug CPI estimated"],
    ];
    const observations = parseShillerSheet(rows);
    expect(Object.keys(observations)).toEqual(['2026-07-01']);
  });

  it('ヘッダー行が見つからなければ例外にする (構造変更を検知する)', () => {
    expect(() => parseShillerSheet([['何か別のタイトル'], [1881.01, 18.47]])).toThrow();
  });

  it('CAPE を1件も抽出できなければ例外にする', () => {
    expect(() => parseShillerSheet([header])).toThrow();
  });
});
