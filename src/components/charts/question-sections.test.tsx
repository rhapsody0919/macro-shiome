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
    // 求人 → 失業率 (雇用) → 所得と消費 → 賃金の順 (#170 #180)。
    // #202 で総消費動向指数が加わった。求人 → 失業率 → 所得と消費 → 賃金の順。
    // #204 で総実労働時間が加わった。賃金は時間 × 単価なので実質賃金の手前に置く。
    expect(titles).toEqual([
      '求人倍率',
      '完全失業率 (日本)',
      '家計の余力 (日本)',
      '総消費動向指数 (日本)',
      '平均消費性向 (日本)',
      '総実労働時間 (日本)',
      '実質賃金指数',
    ]);
  });

  it('先行する新規求人倍率を先に置く', () => {
    // 上流 → 下流の順に並べる (#89)。転換点は新規に先に出る。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-labor');
    const labels = section?.textContent ?? '';
    expect(labels.indexOf('新規求人倍率')).toBeLessThan(labels.indexOf('有効求人倍率'));
  });
});

describe('日本の走査で見つかった指標 (#202)', () => {
  it('コアコアを物価チャートに足す', () => {
    // 日本の「コア」は生鮮のみ除く。米国のコアと同じ定義はコアコア。
    render(<JapanPage />);
    expect(screen.getByText('コアコア (生鮮・エネルギー除く)')).toBeInTheDocument();
    expect(screen.getByText(/米国のコア CPI と同じ定義/)).toBeInTheDocument();
  });

  it('TOPIX は日経平均と別チャートにする', () => {
    // 日経 6 万台 / TOPIX 3 千台で水準が桁違い。同じ軸だと片方が潰れる (#118)。
    render(<JapanPage />);
    expect(screen.getByRole('heading', { name: 'TOPIX (東証株価指数)' })).toBeInTheDocument();
    expect(screen.getByText(/水準が桁違いなので同じ図に載せていない/)).toBeInTheDocument();
  });

  it('在庫率を鉱工業生産の直後に置く', () => {
    // 生産 → 在庫率の順。作った量と売れ行きに対する在庫を並べる。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-cycle');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles.indexOf('在庫率と稼働率 (日本)')).toBe(
      titles.indexOf('鉱工業 生産・出荷・在庫 (日本)') + 1,
    );
  });
});

describe('日本の失業率と企業物価 (#180)', () => {
  it('失業率は求人倍率の直後に置く', () => {
    // 逆方向に動く関係を見るため隣に置く (#89 の上流 → 下流)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-labor');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles.indexOf('完全失業率 (日本)')).toBe(titles.indexOf('求人倍率') + 1);
  });

  it('企業物価は消費者物価の直後に置く', () => {
    // 企業物価は消費者物価の上流。転嫁されているかを並べて読む。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-price');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles.indexOf('国内企業物価指数 (日本)')).toBe(
      titles.indexOf('消費者物価指数 (日本)') + 1,
    );
  });

  it('米国の同名指標と同じ図に載せない', () => {
    // 調査方法も基準年も違う。同じ図に載せると差が定義の違いに見える。
    render(<EconomyPage />);
    expect(screen.queryByRole('heading', { name: '完全失業率 (日本)' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '国内企業物価指数 (日本)' })).toBeNull();
  });
});

// #208 以降、凡例と解説の両方に指標名が出るため、名前の照合は getAllByText を使う。
// ここで見たいのは「この系列が図にある」ことで、出現回数ではない。
describe('労働市場の質 (#196)', () => {
  it('広義失業率と公式失業率を同じ図に載せない', () => {
    // U-6 は不完全就業を含む別の定義。重ねると差が定義の違いに見える。
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: '労働市場の質' })).toBeInTheDocument();
    expect(screen.getAllByText('広義失業率 (U-6)').length).toBeGreaterThan(0);
  });

  it('失業保険は新規と継続を重ねる', () => {
    // 同じ単位・同じ週次。2 本の差が再就職の速さを示す。
    render(<EconomyPage />);
    expect(screen.getByText('新規申請')).toBeInTheDocument();
    expect(screen.getByText('継続受給')).toBeInTheDocument();
  });

  it('JOLTS は求人・採用・離職を重ねる', () => {
    // 同じ調査・同じ単位 (千人)。求人 → 採用 → 離職の順で見る。
    render(<EconomyPage />);
    expect(screen.getAllByText('採用').length).toBeGreaterThan(0);
    expect(screen.getAllByText('自発的離職').length).toBeGreaterThan(0);
  });
});

describe('コア物価と期待インフレ率 (#194)', () => {
  it('コア PCE を先頭に置く', () => {
    // FRB の物価目標そのもの。上流 → 下流ではなく「政策に効く順」(#89 の趣旨)。
    render(<EconomyPage />);
    const core = screen.getByText('コア PCE');
    const cpi = screen.getByText('コア CPI');
    expect(core.compareDocumentPosition(cpi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('総合物価と同じ図に載せない', () => {
    // コアは食品・エネルギーを除く別の定義。重ねると差が振れ幅の違いに見える。
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: 'コア物価' })).toBeInTheDocument();
    // #196 で労働市場の質にも同じ注記が付いたため 2 か所に出るのが正しい。
    expect(screen.getAllByText(/定義が違うため同じ図に載せていない/).length).toBe(2);
  });

  it('期待インフレ率は日次で市場ページに置く', () => {
    // 実績 (経済ページ) と先行き (市場ページ) を分ける。日次で取れる。
    render(<MarketPage />);
    expect(screen.getByRole('heading', { name: '期待インフレ率' })).toBeInTheDocument();
    expect(screen.getByText('5年先5年')).toBeInTheDocument();
  });
});

describe('設備稼働率と在庫循環 (#191)', () => {
  it('稼働率は水準で出す', () => {
    // 前年同月比にすると「80% を割った」という水準の意味が消える。
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: '設備稼働率' })).toBeInTheDocument();
    expect(screen.getByText(/水準で読む/)).toBeInTheDocument();
  });

  it('受注と在庫を 1 枚に重ねる', () => {
    // 同じ単位 (前年同月比 %)。2 本の差が在庫循環を示すので分けると読めない。
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: '耐久財受注と在庫' })).toBeInTheDocument();
    expect(screen.getAllByText('耐久財新規受注').length).toBeGreaterThan(0);
    expect(screen.getAllByText('企業在庫').length).toBeGreaterThan(0);
  });

  it('資本財受注と同じ図に載せない', () => {
    // 耐久財は資本財を含む上位概念。重ねると二重計上に見える。
    render(<EconomyPage />);
    expect(screen.getByText(/含む関係にあるため同じ図には載せていない/)).toBeInTheDocument();
  });
});

describe('金融環境指数と短期金利 (#190)', () => {
  it('3 つの指数を 1 枚に重ねる', () => {
    // いずれも 0 が平均の同じスケール。3 本の差が「何を測っているか」の違いを示す。
    render(<MarketPage />);
    expect(screen.getByRole('heading', { name: '金融環境指数' })).toBeInTheDocument();
    expect(screen.getByText('NFCI (総合)')).toBeInTheDocument();
    expect(screen.getByText('ANFCI (景気調整済み)')).toBeInTheDocument();
    expect(screen.getByText('金融ストレス指数')).toBeInTheDocument();
  });

  it('総合指数を部品より前に置く', () => {
    // 信用スプレッド・信用状況は NFCI の構成要素にあたる。上流 → 下流 (#89)。
    render(<MarketPage />);
    const section = document.getElementById('q-financial');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles.indexOf('金融環境指数')).toBeLessThan(titles.indexOf('信用スプレッド'));
  });

  it('短期金利は金利の内訳と別チャートにする', () => {
    // あちらは 10年債を名目・期待インフレ率・実質に分解する図。
    // 6 本にすると何と何を比べるのか読めなくなる。
    render(<MarketPage />);
    expect(screen.getByRole('heading', { name: '短期金利' })).toBeInTheDocument();
    expect(screen.getByText('2年債')).toBeInTheDocument();
    expect(screen.getByText('SOFR')).toBeInTheDocument();
  });
});

describe('米国の家計の余力 (#178)', () => {
  it('所得と消費を 1 枚に重ねる', () => {
    // 同じ単位 (前年同月比 %)。2 本の差が買い控えか余力喪失かを分ける (#95)。
    render(<EconomyPage />);
    expect(screen.getByRole('heading', { name: '家計の余力' })).toBeInTheDocument();
    expect(screen.getByText('実質可処分所得')).toBeInTheDocument();
    expect(screen.getByText('実質消費支出')).toBeInTheDocument();
  });

  it('日本の家計の余力とは別ページに置く', () => {
    // 定義は揃えたが対象世帯も基準も違う。同じ図に載せると差が定義の違いに見える。
    render(<EconomyPage />);
    expect(screen.queryByRole('heading', { name: '家計の余力 (日本)' })).toBeNull();
  });
});

describe('日本の対外収支 (#174)', () => {
  it('交易条件と収支を同じ問いに置き、価格を先にする', () => {
    // どちらも「稼いだ分が海外に流出しているか」を見る (#184)。
    // 交易条件 (価格) が先に動き、収支に結果が出る。上流 → 下流の順 (#89)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-external');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toEqual([
      '交易条件 (輸出物価と輸入物価)',
      '経常収支と貿易収支 (日本)',
    ]);
  });

  it('1 枚だけの問いを作らない (#184)', () => {
    // 細分化しすぎると、問いが多いだけで読み筋が伝わらなくなる。
    // #89 が解いた「その他の肥大」の逆方向の失敗。
    render(<JapanPage />);
    for (const id of Object.keys(JAPAN_QUESTIONS)) {
      const section = document.getElementById(`q-${id}`);
      const charts = section?.querySelectorAll('h3').length ?? 0;
      expect(charts, id).toBeGreaterThan(1);
    }
  });

  it('季調値であることと符号が変わる例を書く', () => {
    // 原数値は月ごとの振れで符号が変わる。方向を読み違えないよう実測値を出す。
    render(<JapanPage />);
    expect(screen.getByText(/符号が変わる/)).toBeInTheDocument();
  });

  it('マネーストックは物価の問いに置く', () => {
    // 通貨量は物価の背景。対外収支とは別の話。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-price');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toContain('マネーストック M2 (日本)');
  });
});

describe('日本の家計の余力 (#170)', () => {
  it('可処分所得と消費支出を 1 枚に重ねる', () => {
    // 同じ単位 (前年同月比 %)。2 本の差が「所得を使っているか」を示すので、
    // 分けると片方だけ見て買い控えと所得減を取り違える。
    render(<JapanPage />);
    expect(screen.getByRole('heading', { name: '家計の余力 (日本)' })).toBeInTheDocument();
    expect(screen.getByText('実質可処分所得')).toBeInTheDocument();
    expect(screen.getByText('実質消費支出')).toBeInTheDocument();
  });

  it('平均消費性向は単位が違うので別チャートにする', () => {
    render(<JapanPage />);
    expect(screen.getByRole('heading', { name: '平均消費性向 (日本)' })).toBeInTheDocument();
  });

  it('実質賃金の注記を実態に合わせる', () => {
    // #156 では「家計調査は使えない」と書いていたが、本来の指標が入ったので
    // 実質賃金は「賃金であって消費ではない」という説明に変えた。
    render(<JapanPage />);
    expect(screen.queryByText(/家計調査の月次消費支出は代わりに使えない/)).toBeNull();
    expect(screen.getByText(/賃金であって消費ではない/)).toBeInTheDocument();
  });
});

describe('日本の鉱工業生産 (#164)', () => {
  it('景気動向指数と同じ図に載せない', () => {
    // あちらは原数値しか提供されていない。季調値と重ねると季節性の有無が
    // 動きの違いに見える (#116〜#118 と同じ型)。
    render(<JapanPage />);
    // #204 で出荷・在庫が加わりチャート名が変わった。
    expect(
      screen.getByRole('heading', { name: '鉱工業 生産・出荷・在庫 (日本)' }),
    ).toBeInTheDocument();
  });

  it('水準で出していることを画面に書く', () => {
    // 公表の前年同月比が無く、指数が小数 1 桁なので導出すると丸め誤差が出る (#162 の型)。
    render(<JapanPage />);
    expect(screen.getByText(/前年同月比にせず水準で出している/)).toBeInTheDocument();
  });
});

describe('日本の消費者物価 (#162)', () => {
  it('コアと総合を 1 枚に重ねる', () => {
    // 同じ基準・同じ単位。2 本の差が生鮮食品の影響を示す。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-price');
    expect(section).not.toBeNull();
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    // 消費者物価 → 上流の企業物価 → 背景の通貨量の順 (#174 #180)。
    // #204 でマネタリーベースと銀行貸出が加わった。
    expect(titles).toEqual([
      '消費者物価指数 (日本)',
      '国内企業物価指数 (日本)',
      'マネーストック M2 (日本)',
      'マネタリーベースと銀行貸出 (日本)',
    ]);
  });

  it('日銀が見るコアを先に置く', () => {
    // 政策判断に効くのはコア。総合は天候で振れる。
    // 文字列の出現位置では測れない (「総合」はサブタイトルに先に出る) ため、
    // 凡例の 2 つを DOM の前後関係で比べる。
    render(<JapanPage />);
    const core = screen.getByText('コア (生鮮食品を除く)');
    const total = screen.getByText('総合', { exact: true });
    expect(core.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('公表値をそのまま出していることを画面に書く', () => {
    // 指数から導出すると丸めで公表値とずれる。日米で経路が違うことを明記する。
    // #180 で企業物価にも同じ注記が付いたため、2 か所に出るのが正しい。
    render(<JapanPage />);
    expect(screen.getAllByText(/公表されている前年同月比をそのまま出している/).length).toBe(2);
  });
});

describe('街角景気 (#160)', () => {
  it('景気動向指数と同じ図に載せない', () => {
    // 一方は 2020年平均 = 100 の合成指数、もう一方は 50 が中立の DI。
    // 同じ図に載せると水準の違いが動きの違いに見える (#116〜#118 と同じ型)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-cycle');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    expect(titles).toHaveLength(4);
  });

  it('現状判断と先行き判断を 1 枚に重ねる', () => {
    // 同じ DI で単位が揃っており、2 本の差が「先を見ているか」を示す。
    render(<JapanPage />);
    expect(screen.getByText('現状判断')).toBeInTheDocument();
    expect(screen.getByText('先行き判断')).toBeInTheDocument();
  });
});

describe('日本の交易条件 (#155)', () => {
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
    // 街角景気は DI (50 が中立)、鉱工業生産は季調値なのでそれぞれ別チャートにする。
    // 合成 (景気動向指数) / 体感 (街角景気) / 実量 (鉱工業生産) が並ぶ。
    // #202 で在庫率が加わった。合成 / 体感 / 実量 / 需給の 4 層。
    // #204 で出荷・在庫・稼働率が加わりチャート名が変わった。
    expect(titles).toEqual([
      '景気動向指数',
      '街角景気 (景気ウォッチャー調査)',
      '鉱工業 生産・出荷・在庫 (日本)',
      '在庫率と稼働率 (日本)',
    ]);
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
    // #202 で TOPIX が加わった。水準が桁違いなので日経平均とは別チャート。
    expect(titles).toEqual(['日経平均株価', 'TOPIX (東証株価指数)', 'USD/JPY']);
  });

  it('住宅は総戸数と内訳を別のチャートに分ける', () => {
    // 総戸数は年率換算、内訳は季調値そのもので水準が 1 桁違う (#129)。
    render(<JapanPage />);
    const section = document.getElementById('q-jp-housing');
    const titles = Array.from(section?.querySelectorAll('h3') ?? []).map((h) => h.textContent);
    // #204 で公共工事受注額が加わった。家計の需要 → 政策の需要の順。
    expect(titles).toEqual([
      '新設住宅着工戸数 (日本)',
      '新設住宅着工戸数の内訳 (日本)',
      '公共工事受注額 (日本)',
    ]);
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

describe('市場ページの問いの分割 (#219)', () => {
  it('金利と金融環境を別の問いに分け、金利を先に置く', () => {
    // 12 枚が 1 つの問いに集まり全ページで最大になっていた。金利は「いまどこにあるか」、
    // 環境指数や信用スプレッドは「緩いか厳しいか」で、目的が違う。
    // 順序は上流 → 下流 (#89) — 金利の水準を読んでから環境の緩さを測る。
    render(<MarketPage />);
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toContain('金利はどこにあるか');
    expect(titles.indexOf('金利はどこにあるか')).toBeLessThan(
      titles.indexOf('金融環境は緩いか厳しいか'),
    );
  });

  it('どの問いも 2〜9 枚に収まる', () => {
    // 下限は #184 (1 枚だけの問いを作らない)、上限は #219。
    // **9 は現時点で最大の問い** (`/economy` の「景気は減速しているか」) に合わせた。
    //
    // 全ページで見たいが、重いページを 3 つ描画するとこのファイルがタイムアウトする。
    // **問題が起きた `/market` で押さえる。**
    render(<MarketPage />);
    for (const id of Object.keys(MARKET_QUESTIONS)) {
      const section = document.getElementById(`q-${id}`);
      const charts = section?.querySelectorAll('h3').length ?? 0;
      expect(charts, id).toBeGreaterThan(1);
      expect(charts, id).toBeLessThanOrEqual(9);
    }
  });
});
