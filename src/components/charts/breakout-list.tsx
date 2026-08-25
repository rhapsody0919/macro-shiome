import { formatDate, formatNumber } from '@/lib/format';
import type { BreakoutAsset } from '@/lib/data/types';
import { ChartFrame } from './chart-frame';
import { PatternChart } from './pattern-chart';

/**
 * CHoCH (Change of Character) の検出結果 (#268)。
 *
 * カップウィズハンドル・ダブルボトム・逆三尊・High Tight Flag・N日高値抜け (#264) を
 * 置き換える。**検出された銘柄のみ** `PatternChart` (#260) で下落構造の主要点
 * (1つ目の安値・前回の高値・2つ目の安値・ブレイクアウト) を視覚化する。
 * 0 件はテキストのみ (0 件は正常な状態 — ビューが生成されていること自体が
 * 「検出を試みた」証拠になる)。
 */
export function BreakoutList({
  title,
  subtitle,
  assets,
  notes,
  explanation,
  badges,
}: {
  title: string;
  subtitle: string;
  assets: BreakoutAsset[];
  notes: React.ReactNode[];
  /** 指標の読者向け解説 (#208)。`ChartFrame` にそのまま渡す。 */
  explanation?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  const detected = assets.filter(
    (asset): asset is BreakoutAsset & { detection: NonNullable<BreakoutAsset['detection']> } =>
      asset.detection !== null,
  );

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      badges={badges}
      headingLevel={3}
      contentClassName="min-h-24"
      notes={notes}
      explanation={explanation}
    >
      {detected.length === 0 ? (
        <p className="text-sm text-slate-500">
          現在、該当する銘柄はありません ({assets.length} 銘柄を毎日検査しています)。
        </p>
      ) : (
        <ul className="space-y-3">
          {detected.map((asset) => (
            <li
              key={asset.symbol}
              className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              {/*
                銘柄名だけを常時表示し、詳細 (スイング点・チャート) は折りたたむ (#302)。
                初心者は「該当銘柄がある/ない」が一覧だけで分かればよく、
                スイング点の詳細は関心のある人だけが開けばよいため。
              */}
              <details>
                <summary className="cursor-pointer font-semibold">{asset.name}</summary>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    1つ目の安値: {formatDate(asset.detection.firstLowDate)} (
                    {formatNumber(asset.detection.firstLowPrice, 2)})
                  </span>
                  <span>
                    前回の高値: {formatDate(asset.detection.priorHighDate)} (
                    {formatNumber(asset.detection.priorHighPrice, 2)})
                  </span>
                  <span>
                    2つ目の安値: {formatDate(asset.detection.secondLowDate)} (
                    {formatNumber(asset.detection.secondLowPrice, 2)})
                  </span>
                  <span>
                    ブレイクアウト: {formatDate(asset.detection.breakoutDate)} (
                    {formatNumber(asset.detection.breakoutPrice, 2)})
                  </span>
                </div>
                {asset.priceSeries && (
                  <div className="mt-3">
                    <PatternChart
                      priceSeries={asset.priceSeries}
                      markers={[
                        {
                          date: asset.detection.firstLowDate,
                          price: asset.detection.firstLowPrice,
                          label: '1つ目の安値',
                        },
                        {
                          date: asset.detection.priorHighDate,
                          price: asset.detection.priorHighPrice,
                          label: '前回の高値',
                        },
                        {
                          date: asset.detection.secondLowDate,
                          price: asset.detection.secondLowPrice,
                          label: '2つ目の安値',
                        },
                        {
                          date: asset.detection.breakoutDate,
                          price: asset.detection.breakoutPrice,
                          label: 'ブレイクアウト',
                        },
                      ]}
                      levels={[{ value: asset.detection.priorHighPrice, label: '上抜けた水準' }]}
                    />
                  </div>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}
