import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MIN_WEEKS_FOR_LINE } from '@/lib/series-state';
import { ChartFrame } from './chart-frame';

const CHART = <div data-testid="chart">図</div>;

describe('チャート外枠の蓄積中表示', () => {
  it('線を引けるときは図を出す', () => {
    render(
      <ChartFrame title="理論値" notes={[]} state={{ kind: 'ok', count: 168 }} stateLabel="理論値">
        {CHART}
      </ChartFrame>,
    );
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });

  it('蓄積中は図の代わりに状態を出す', () => {
    render(
      <ChartFrame
        title="理論値"
        notes={[]}
        state={{ kind: 'accumulating', count: 1, from: '2026-08-14' }}
        stateLabel="理論値"
      >
        {CHART}
      </ChartFrame>,
    );
    // 空の図を描くと「壊れている」と読まれるため、図自体を出さない。
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    expect(screen.getByText(/理論値 は蓄積中/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${MIN_WEEKS_FOR_LINE} 週分が要る`))).toBeInTheDocument();
  });

  it('蓄積できない理由を添えられる', () => {
    // 「取得経路が無い」(恒久的) と混同させないため、時間で解消することを示す。
    render(
      <ChartFrame
        title="理論値"
        notes={[]}
        state={{ kind: 'accumulating', count: 1, from: '2026-08-14' }}
        stateLabel="理論値"
        stateNote="提供元が現在値しか出さないため過去に遡れない。"
      >
        {CHART}
      </ChartFrame>,
    );
    expect(screen.getByText(/過去に遡れない/)).toBeInTheDocument();
    expect(screen.getByText(/週を追うごとに増える/)).toBeInTheDocument();
  });

  it('state を渡さなければ常に図を出す', () => {
    // 蓄積の概念が無いチャート (マクロ指標など) は今までどおり動く。
    render(
      <ChartFrame title="VIX" notes={[]}>
        {CHART}
      </ChartFrame>,
    );
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });
});
