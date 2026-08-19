import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EconomyPage from '@/app/economy/page';
import JapanPage from '@/app/japan/page';
import MarketPage from '@/app/market/page';
import { ECONOMY_QUESTIONS, JAPAN_QUESTIONS, MARKET_QUESTIONS } from '@/lib/questions';
import { Badges } from './badges';

// チャートは期間フィルター (URL) を読む。ページ全体を描くのでここで差し替える。
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

/**
 * 実画面の確認はブラウザ pane では取れない (`document.hidden: true` で
 * React が画面下部のハイドレーションを遅らせ、Recharts が描画されない)。
 * 代わりにここで構造を検証する。
 */

describe('問いによる画面構成 (#89)', () => {
  it('経済ページは 5 つの問いをすべて見出しに出す', () => {
    render(<EconomyPage />);
    for (const question of Object.values(ECONOMY_QUESTIONS)) {
      // 目次リンクと見出しの 2 か所に出るため、見出しに限って探す。
      expect(screen.getByRole('heading', { name: question.title })).toBeInTheDocument();
    }
  });

  it('日本ページは 2 つの問いをすべて見出しに出す', () => {
    render(<JapanPage />);
    for (const question of Object.values(JAPAN_QUESTIONS)) {
      expect(screen.getByRole('heading', { name: question.title })).toBeInTheDocument();
    }
  });

  it('市場ページは残りの問いをすべて見出しに出す', () => {
    render(<MarketPage />);
    for (const question of Object.values(MARKET_QUESTIONS)) {
      expect(screen.getByRole('heading', { name: question.title })).toBeInTheDocument();
    }
  });

  it('10年債の理論値は金利の内訳の直後に置く (#93)', () => {
    // ブラウザ pane はハイドレーション途中の DOM しか取れず順序を確認できないため、
    // ここで担保する。理論値は「金利の内訳」で構造を見た直後に読むもの。
    render(<MarketPage />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles.indexOf('10年債の理論値')).toBe(titles.indexOf('金利の内訳') + 1);
  });

  it('目次から各問いへ飛べる', () => {
    // 問いが 5 つ並ぶとモバイルでは全体像が見えないため、先頭に目次を置いている。
    render(<EconomyPage />);
    const index = screen.getByRole('navigation', { name: 'このページで答える問い' });
    const links = within(index).getAllByRole('link');
    expect(links).toHaveLength(Object.keys(ECONOMY_QUESTIONS).length);
    // href の先が実在しないと目次が機能しない。
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('週次と月次が同じ問いに混ざる場合も頻度が判別できる', () => {
    // 更新頻度でページを分けた #64 の判断を撤回したため、バッジが唯一の手がかりになる。
    render(<EconomyPage />);
    expect(screen.getAllByText('週次').length).toBeGreaterThan(0);
    expect(screen.getAllByText('月次').length).toBeGreaterThan(0);
  });
});

describe('価格系列の日次表示 (#137)', () => {
  it('日次チャートに日次バッジが出る', () => {
    // 「先週から動いていない」のか「月次だから動かない」のかを判別するための表示 (#64)。
    // 日次を週次と表示すると、この判別ができなくなる。
    render(<MarketPage />);
    expect(screen.getAllByText('日次').length).toBeGreaterThan(0);
  });

  it('日次チャートの変化は前日比と明記する', () => {
    // グリッドの粒度を変えると差分の意味も変わる。週の変化と読み違えないようにする。
    render(<MarketPage />);
    expect(screen.getAllByText('(前日比)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('(前週比)').length).toBeGreaterThan(0);
  });
});

describe('チャートのバッジ', () => {
  it('景気サイクルの分類が無ければ頻度だけ出す', () => {
    // 分類の無い指標に分類を付けない (#62)。
    render(<Badges frequency="weekly" />);
    expect(screen.getByText('週次')).toBeInTheDocument();
    expect(screen.queryByText('先行')).not.toBeInTheDocument();
  });

  it('分類があれば説明付きで出す', () => {
    render(<Badges frequency="monthly" cyclePosition="leading" />);
    expect(screen.getByText('月次')).toBeInTheDocument();
    expect(screen.getByText('先行')).toHaveAttribute('title', expect.stringContaining('先立って'));
  });
});

describe('日本の雇用と所得 (#156)', () => {
  it('求人倍率は 2 本を重ね、実質賃金は分ける', () => {
    // 求人倍率は同じ単位 (倍) なので重ねられる。実質賃金は指数なので別の軸になる。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-labor');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual(['求人倍率', '実質賃金指数']);
  });

  it('先行する新規求人倍率を先に置く', () => {
    // 上流 → 下流の順に並べる (#89)。転換点は新規に先に出る。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-labor');
    const labels = section?.textContent ?? '';
    expect(labels.indexOf('新規求人倍率')).toBeLessThan(labels.indexOf('有効求人倍率'));
  });
});

describe('街角景気 (#160)', () => {
  it('景気動向指数と同じ図に載せない', () => {
    // 一方は 2020年平均 = 100 の合成指数、もう一方は 50 が中立の DI。
    // 同じ図に載せると水準の違いが動きの違いに見える (#116〜#118 と同じ型)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-cycle');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toHaveLength(2);
  });

  it('現状判断と先行き判断を 1 枚に重ねる', () => {
    // 同じ DI で単位が揃っており、2 本の差が「先を見ているか」を示す。
    render(<JapanPage />);
    expect(screen.getByText('現状判断')).toBeInTheDocument();
    expect(screen.getByText('先行き判断')).toBeInTheDocument();
  });
});

describe('日本の交易条件 (#155)', () => {
  it('輸出物価と輸入物価を 1 枚に重ねる', () => {
    // 同じ基準・同じ円ベースなので重ねられる。2 本の差が交易条件そのもの。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-trade');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual(['交易条件 (輸出物価と輸入物価)']);
  });

  it('米国の交易条件とは別のチャートにする', () => {
    // 基準年も対象品目も違う (#98)。同じ図に載せると差が定義の違いに見える。
    render(<EconomyPage />);
    expect(
      screen.queryByRole('heading', { name: '交易条件 (輸出物価と輸入物価)' }),
    ).toBeNull();
  });
});

describe('日本の景気動向指数 (#154)', () => {
  it('先行・一致・遅行を 1 枚に重ねる', () => {
    // 3 本とも同じ基準 (2020年平均 = 100)・同じ単位なので重ねられる。
    // 位置関係そのものが局面を示すため、分けると読めなくなる。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-cycle');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    // 街角景気は基準が違う (DI は 50 が中立) ので別チャートにする (#160)。
    expect(titles).toEqual(['景気動向指数', '街角景気 (景気ウォッチャー調査)']);
  });

  it('米国の景気指標と同じ図に載せない', () => {
    // 米国は LEI が取れず構成要素で代替している (#62)。定義が違うので比べられない。
    render(<EconomyPage />);
    expect(screen.queryByRole('heading', { name: '景気動向指数' })).toBeNull();
  });
});

describe('日本ページ (#152)', () => {
  it('日経平均と USD/JPY が同じ問いに入る', () => {
    // 円安は日経平均の押し上げ要因。2 つを並べて業績と為替を切り分ける (#118)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-market');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual(['日経平均株価', 'USD/JPY']);
  });

  it('住宅は総戸数と内訳を別のチャートに分ける', () => {
    // 総戸数は年率換算、内訳は季調値そのもので水準が 1 桁違う (#129)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-housing');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual(['新設住宅着工戸数 (日本)', '新設住宅着工戸数の内訳 (日本)']);
  });

  it('市場ページから日本単独のチャートが消える', () => {
    // 分けた意味が無くなるため、両方に出さない。
    render(<MarketPage />);
    expect(screen.queryByRole('heading', { name: '日経平均株価' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'USD/JPY' })).toBeNull();
  });

  it('経済ページから日本の住宅が消える', () => {
    render(<EconomyPage />);
    expect(screen.queryByRole('heading', { name: '新設住宅着工戸数 (日本)' })).toBeNull();
  });

  it('国際比較のチャートは市場ページに残る', () => {
    // 複数国を並べること自体が目的なので、日本ページに置くと何を見る図か分からない。
    render(<MarketPage />);
    expect(
      screen.getByRole('heading', { name: '10年債利回りの国際比較' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '各国の下落率' })).toBeInTheDocument();
  });
});
