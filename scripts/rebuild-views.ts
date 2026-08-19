/**
 * 保存済みの観測値からビューだけを作り直す。
 *
 * データ取得を伴わないため API キーが不要。ビューの構造を変えたときや、
 * 導出値の計算を直したときに使う。
 *
 * 実行: pnpm rebuild:views
 */
import {
  buildDrawdownView,
  buildEconomyView,
  buildMacroView,
  buildMarketDailyView,
  buildRevisionSeries,
  buildValuationView,
  type ObservationMap,
} from '../src/lib/calc/view';
import { appConfig, indicators } from '../src/lib/data/indicators';
import { DRAWDOWN_ASSETS } from '../src/lib/data/drawdown-assets';
import drawdownSeed from '../data/seed/stock-bot-drawdown.json';
import { readObservations, writeView } from '../src/lib/data/store';

const VIEW_START_YEARS = 10;

function main(): void {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - VIEW_START_YEARS, now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const observations: ObservationMap = Object.fromEntries(
    Object.keys(indicators).map((id) => [id, readObservations(id)]),
  );

  const options = { observations, config: appConfig, start, today: now };
  writeView('valuation', buildValuationView(options));
  writeView('revisions', buildRevisionSeries(options));
  writeView('macro', buildMacroView(options));
  writeView('market-daily', buildMarketDailyView(options));
  writeView('economy', buildEconomyView(options));
  writeView(
    'drawdown',
    buildDrawdownView({
      observations,
      config: appConfig,
      start,
      today: now,
      seed: drawdownSeed,
      assets: DRAWDOWN_ASSETS,
      names: Object.fromEntries(
        Object.entries(indicators).map(([id, indicator]) => [id, indicator.name]),
      ),
    }),
  );

  console.log(`ビューを再生成した (起点 ${start})`);
}

main();
