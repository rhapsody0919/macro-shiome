import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CalendarPage from './page';

describe('発表予定カレンダー (#270)', () => {
  it('見出しと各エントリの次回発表予定日を表示する', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('heading', { name: '発表予定カレンダー' })).toBeInTheDocument();

    const items = document.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.textContent).toMatch(/次回: /);
    }
  });

  it('次回発表予定日が近い順に並ぶ', () => {
    render(<CalendarPage />);
    const items = Array.from(document.querySelectorAll('li'));
    const dates = items
      .map((item) => item.querySelector('.tabular-nums')?.textContent ?? '')
      .filter((text) => text !== '不明');
    // "YYYY/MM/DD" 表記のまま文字列比較しても昇順になる。
    expect(dates).toEqual([...dates].sort());
  });

  it('対象は FRED・FactSet のみと明記する', () => {
    render(<CalendarPage />);
    expect(document.body.textContent).toContain('FRED・FactSet 由来の指標のみ');
  });
});
