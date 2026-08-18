import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexSwitch } from './index-switch';
import { INDEX_KEYS, INDEX_LABELS } from '@/lib/data/indices';

describe('指数の切り替え (#58)', () => {
  it('INDEX_LABELS の全指数をボタンにする', () => {
    // 指数を足したときに UI 側の変更が要らないことの担保。
    render(<IndexSwitch value="sp500" onChange={() => {}} />);
    for (const key of INDEX_KEYS) {
      expect(screen.getByRole('button', { name: INDEX_LABELS[key] })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(INDEX_KEYS.length);
  });

  it('選択中を aria-pressed で示す', () => {
    // 色だけに頼らず状態を伝える (screens UI/UX 方針 3)。
    render(<IndexSwitch value="nasdaq100" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'NASDAQ-100' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'S&P 500' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('押されたキーを onChange に渡す', () => {
    const onChange = vi.fn();
    render(<IndexSwitch value="sp500" onChange={onChange} />);
    screen.getByRole('button', { name: 'NASDAQ-100' }).click();
    expect(onChange).toHaveBeenCalledWith('nasdaq100');
  });
});

describe('指数の表示名', () => {
  it('INDEX_KEYS は INDEX_LABELS と一致する', () => {
    // 別々に持つと同期が要る。#58 で消した重複を復活させないための番人。
    expect(INDEX_KEYS).toEqual(Object.keys(INDEX_LABELS));
  });
});
