'use client';

import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@/lib/format';
import type { PatternPricePoint } from '@/lib/data/types';
import { SharedTooltip } from './chart-frame';

/** チャートに打つ主要点 (ピボット)。#260 の要望どおり、判定の根拠を視覚化する。 */
export interface PatternMarker {
  date: string;
  price: number;
  label: string;
}

/** チャートに帯で示す期間 (単一の点で表せないもの)。 */
export interface PatternPeriod {
  from: string;
  to: string;
  label: string;
}

/** チャートに水平線で示す価格水準 (ブレイクアウトで上抜けた高値など)。 */
export interface PatternLevel {
  value: number;
  label: string;
}

/**
 * 検出されたパターンのチャート (#260)。
 *
 * `MacroChart` (Recharts の `LineChart`) と同じ基盤を使う。新しいライブラリは導入しない
 * (#253 で検討済みの案 A)。**検出された銘柄だけ**呼ばれる想定で、対象期間はパターンの
 * 起点から基準日まで (`view.ts` の `slicePriceSeries` が切り出す)。
 *
 * 終値の折れ線だけでは形が伝わらないことが #253 のモックアップで判明したため、
 * ピボット (主要点) を `ReferenceDot` で明示する。
 */
export function PatternChart({
  priceSeries,
  markers,
  periods = [],
  levels = [],
}: {
  priceSeries: ReadonlyArray<PatternPricePoint>;
  markers: ReadonlyArray<PatternMarker>;
  periods?: ReadonlyArray<PatternPeriod>;
  levels?: ReadonlyArray<PatternLevel>;
}) {
  return (
    <div className="h-40 w-full sm:h-48">
      <ResponsiveContainer>
        <LineChart data={priceSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={40} fontSize={10} />
          <YAxis
            domain={['auto', 'auto']}
            width={48}
            fontSize={10}
            tickFormatter={(value: number) => value.toLocaleString('ja-JP')}
          />
          <Tooltip content={<SharedTooltip kind="number" />} />

          {periods.map((period) => (
            <ReferenceArea
              key={`${period.from}-${period.to}`}
              x1={period.from}
              x2={period.to}
              fill="currentColor"
              fillOpacity={0.08}
              label={{ value: period.label, position: 'insideTop', fontSize: 9 }}
            />
          ))}

          {levels.map((level) => (
            <ReferenceLine
              key={`${level.value}-${level.label}`}
              y={level.value}
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeDasharray="6 3"
              label={{ value: level.label, position: 'insideBottomLeft', fontSize: 9 }}
            />
          ))}

          <Line
            type="monotone"
            dataKey="close"
            name="終値"
            stroke="#2563eb"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />

          {markers.map((marker) => (
            <ReferenceDot
              key={`${marker.date}-${marker.label}`}
              x={marker.date}
              y={marker.price}
              r={4}
              fill="#f97316"
              stroke="none"
              label={{ value: marker.label, position: 'top', fontSize: 9 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
