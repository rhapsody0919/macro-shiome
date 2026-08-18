import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appDir = join(process.cwd(), 'src/app');

/**
 * favicon の担保 (#70)。
 *
 * 画像そのものは目で見るしかないが、**壊れると気付けない性質**が 2 つある。
 * ライト/ダーク両方で見えること (= 背景を塗ってあること) と、
 * `/favicon.ico` が存在すること。ここではその 2 つだけを検証する。
 */
describe('favicon', () => {
  const svg = readFileSync(join(appDir, 'icon.svg'), 'utf8');

  it('背景を塗っている', () => {
    // 透過にすると、ブラウザのタブ背景がライト/ダークで変わったとき
    // どちらかで見えなくなる。全面の矩形が塗られていることを見る。
    expect(svg).toMatch(/<rect[^>]*width="32"[^>]*height="32"[^>]*fill="#[0-9a-fA-F]{6}"/);
  });

  it('viewBox が正方形', () => {
    // 非正方形だとブラウザ側で歪む。
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  it('favicon.ico を同梱している', () => {
    // /favicon.ico を直接取りに来るブラウザ・クローラのため (#70 の報告はこの 404)。
    const ico = readFileSync(join(appDir, 'favicon.ico'));
    // ICO のマジックナンバー: 予約 0x0000 + タイプ 0x0001。
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    // 16 / 32 / 48 の 3 サイズ。小さい表示で潰れないよう専用サイズを持たせている。
    expect(ico.readUInt16LE(4)).toBe(3);
  });
});
