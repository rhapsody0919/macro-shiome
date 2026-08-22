import { formatDate, formatNumber } from '@/lib/format';
import type { DoubleBottomAsset } from '@/lib/data/types';
import { ChartFrame } from './chart-frame';

/**
 * ダブルボトムの検出結果 (#256)。
 *
 * `CupWithHandleList` (#230) / `HighTightFlagList` (#231) と同じ設計。時系列チャートではなく
 * リスト表示。**0 件は正常** — ビューが生成されていること自体が「検出を試みた」証拠になる。
 */
export function DoubleBottomList({
  title,
  subtitle,
  assets,
  notes,
  explanation,
  badges,
}: {
  title: string;
  subtitle: string;
  assets: DoubleBottomAsset[];
  notes: React.ReactNode[];
  /** 指標の読者向け解説 (#208)。`ChartFrame` にそのまま渡す。 */
  explanation?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  const detected = assets.filter(
    (asset): asset is DoubleBottomAsset & { detection: NonNullable<DoubleBottomAsset['detection']> } =>
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
              <div className="font-semibold">{asset.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  1 つ目の安値: {formatDate(asset.detection.firstBottomDate)} (
                  {formatNumber(asset.detection.firstBottomPrice, 2)})
                </span>
                <span>
                  ネックライン: {formatDate(asset.detection.necklineDate)} (
                  {formatNumber(asset.detection.necklinePrice, 2)})
                </span>
                <span>
                  2 つ目の安値: {formatDate(asset.detection.secondBottomDate)} (
                  {formatNumber(asset.detection.secondBottomPrice, 2)})
                </span>
                {asset.detection.volumeDecreased && <span>2 つ目の安値は出来高少なめ</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}
