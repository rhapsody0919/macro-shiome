import { formatDate, formatNumber } from '@/lib/format';
import type { HighTightFlagAsset } from '@/lib/data/types';
import { ChartFrame } from './chart-frame';

/**
 * High Tight Flag の検出結果 (#231)。
 *
 * 時系列チャートではなくリスト表示。検出は稀なパターンなので、
 * 通常は「該当銘柄なし」の状態が続く。**0 件は正常** — ビューが生成されていること
 * 自体が「検出を試みた」証拠になる (型定義のコメント参照)。取得・計算が壊れていれば
 * ビルド時に型エラーで落ちるため、0 件と壊れている状態は画面上で混同しない。
 */
export function HighTightFlagList({
  title,
  subtitle,
  assets,
  notes,
  explanation,
  badges,
}: {
  title: string;
  subtitle: string;
  assets: HighTightFlagAsset[];
  notes: React.ReactNode[];
  /** 指標の読者向け解説 (#208)。`ChartFrame` にそのまま渡す。 */
  explanation?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  const detected = assets.filter(
    (asset): asset is HighTightFlagAsset & { detection: NonNullable<HighTightFlagAsset['detection']> } =>
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
          現在、該当する銘柄はありません。High Tight Flag は極めて稀なパターンです
          ({assets.length} 銘柄を毎日検査しています)。
        </p>
      ) : (
        <ul className="space-y-3">
          {detected.map((asset) => (
            <li
              key={asset.symbol}
              className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <div className="font-semibold">{asset.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  ポール: {formatDate(asset.detection.pole.startDate)} →{' '}
                  {formatDate(asset.detection.pole.endDate)} (
                  {formatNumber(asset.detection.pole.weeks, 1)} 週で +
                  {formatNumber(asset.detection.pole.gainPercent, 0)}%)
                </span>
                <span>
                  フラッグ: {formatNumber(asset.detection.flagWeeks, 1)} 週、ポール高値から −
                  {formatNumber(asset.detection.flagLowPercent, 1)}%
                </span>
                {asset.detection.volumeDecreased && <span>出来高は減少傾向</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}
