import { formatDate, formatNumber } from '@/lib/format';
import type { HeadAndShouldersBottomAsset } from '@/lib/data/types';
import { ChartFrame } from './chart-frame';

/**
 * ヘッド・アンド・ショルダーズ・ボトム (逆三尊) の検出結果 (#258)。
 *
 * `DoubleBottomList` (#256) / `CupWithHandleList` (#230) と同じ設計。時系列チャートではなく
 * リスト表示。**0 件は正常** — ビューが生成されていること自体が「検出を試みた」証拠になる。
 */
export function HeadAndShouldersBottomList({
  title,
  subtitle,
  assets,
  notes,
  explanation,
  badges,
}: {
  title: string;
  subtitle: string;
  assets: HeadAndShouldersBottomAsset[];
  notes: React.ReactNode[];
  /** 指標の読者向け解説 (#208)。`ChartFrame` にそのまま渡す。 */
  explanation?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  const detected = assets.filter(
    (
      asset,
    ): asset is HeadAndShouldersBottomAsset & {
      detection: NonNullable<HeadAndShouldersBottomAsset['detection']>;
    } => asset.detection !== null,
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
                  左肩: {formatDate(asset.detection.leftShoulderDate)} (
                  {formatNumber(asset.detection.leftShoulderPrice, 2)})
                </span>
                <span>
                  頭: {formatDate(asset.detection.headDate)} (
                  {formatNumber(asset.detection.headPrice, 2)})
                </span>
                <span>
                  右肩: {formatDate(asset.detection.rightShoulderDate)} (
                  {formatNumber(asset.detection.rightShoulderPrice, 2)})
                </span>
                <span>
                  ネックライン: {formatNumber(asset.detection.necklinePrice, 2)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}
