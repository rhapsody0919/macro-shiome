import { describe, expect, it } from 'vitest';
import { isCurrentPath } from './path';

describe('isCurrentPath (#245)', () => {
  it('完全一致は現在地', () => {
    expect(isCurrentPath('/economy', '/economy')).toBe(true);
  });

  it('末尾スラッシュの有無を無視する (静的エクスポート本番ビルド対応)', () => {
    expect(isCurrentPath('/economy/', '/economy')).toBe(true);
    expect(isCurrentPath('/economy', '/economy/')).toBe(true);
  });

  it('ルートは特別扱いする (空文字列に正規化しない)', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
  });

  it('別ページは現在地ではない', () => {
    expect(isCurrentPath('/economy', '/market')).toBe(false);
    expect(isCurrentPath('/economy/', '/market')).toBe(false);
  });

  it('前方一致だけでは現在地としない', () => {
    // /economy2 は /economy とは別ページ。normalize が誤って前方一致にならないことを確認する。
    expect(isCurrentPath('/economy2', '/economy')).toBe(false);
  });
});
