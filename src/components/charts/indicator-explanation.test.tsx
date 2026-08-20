import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IndicatorExplanations, sourceIdOf } from './indicator-explanation';
import { indicators } from '@/lib/data/indicators';

describe('sourceIdOf', () => {
  it('FRED は系列 ID を返す', () => {
    expect(sourceIdOf(indicators['nfci'])).toBe('NFCI');
  });

  it('統計ダッシュボードは指標コードを返す', () => {
    expect(sourceIdOf(indicators['jp-topix'])).toBe('0702020590000090010');
  });

  // FactSet の PDF は項目名で抽出しており系列 ID を持たない。
  // 「不明」などの文字列を出すと、あるのに取れていないように見える。
  it('系列 ID を持たない出所は null を返す', () => {
    expect(sourceIdOf(indicators['sp500-forward-pe'])).toBeNull();
  });
});

describe('IndicatorExplanations', () => {
  it('解説を持つ指標が 1 つも無ければ何も描かない', () => {
    // 空の折りたたみを出すと、開いても何も無いことを毎回試させることになる。
    const { container } = render(<IndicatorExplanations ids={['dfii10']} />);
    expect(container.querySelector('details')).toBeNull();
  });

  it('単位・頻度・出所・系列 ID を指標マスタから組み立てる', () => {
    render(<IndicatorExplanations ids={['commercial-loans']} />);
    // #198 で百万ドルと書き誤った指標。手書きさせず指標マスタ 1 か所から出す。
    expect(screen.getByText(/単位: 十億ドル/)).toBeInTheDocument();
    expect(screen.getByText(/BUSLOANS/)).toBeInTheDocument();
  });

  it('解説のある指標だけを並べる', () => {
    // dfii10 は検算用で画面に出さない指標 (#115)。解説を持たない側の代表として使う。
    render(<IndicatorExplanations ids={['nfci', 'dfii10']} />);
    expect(screen.getByText(indicators['nfci'].name)).toBeInTheDocument();
    expect(screen.queryByText(indicators['dfii10'].name)).toBeNull();
  });

  it('指標マスタに無い ID は落とす', () => {
    // 黙って無視すると、消えた指標を画面が指し続けても気付けない。
    expect(() => render(<IndicatorExplanations ids={['no-such-indicator']} />)).toThrow(
      /指標マスタに無い ID/,
    );
  });
});
