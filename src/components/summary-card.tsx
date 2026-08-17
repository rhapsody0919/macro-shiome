import { changeMark, formatSigned } from '@/lib/format';

/**
 * 画面上部に並べる要約カード (#76)。
 *
 * **評価語は使わない** (screens UI/UX 方針 2)。数値と差分だけを出し、判断は読み手に委ねる。
 *
 * 比較の単位はページによって違う (週次なら前週比、月次なら前月比) ため、
 * ラベルは呼び出し側が決める。
 */
export function SummaryCard({
  label,
  value,
  delta,
  deltaUnit = '',
  deltaLabel,
  asOf,
  note,
}: {
  label: string;
  /** 整形済みの値。単位も含めて呼び出し側で作る。 */
  value: string;
  /** 前回との差。欠測なら null。 */
  delta: number | null;
  deltaUnit?: string;
  /** 「前週比」「前月比」など。欠測を跨いだ場合は「3週前比」のように具体的に。 */
  deltaLabel: string;
  /** いつ時点の値か。月次なら対象月。 */
  asOf?: string | null;
  note?: string;
}) {
  return (
    <div className="rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>

      <div className="text-[11px] tabular-nums text-slate-500">
        {delta === null ? (
          `${deltaLabel} —`
        ) : (
          <>
            {/* 色だけに頼らず記号でも向きを示す (screens UI/UX 方針 3)。 */}
            {changeMark(delta)} {formatSigned(delta, 2, deltaUnit)}
            <span className="ml-1">{deltaLabel}</span>
          </>
        )}
      </div>

      {note !== undefined && <div className="mt-1 text-[10px] text-slate-500">{note}</div>}
      {asOf !== undefined && asOf !== null && (
        <div className="text-[10px] text-slate-400">{asOf}</div>
      )}
    </div>
  );
}

/** カードを並べる枠。列数は画面幅で変える。 */
export function SummaryGrid({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      {/* モバイルは 2 列。1 列だと縦に長くなりすぎ、3 列以上だと数値が潰れる。 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">{children}</div>
      {note !== undefined && <p className="text-[11px] text-slate-500">{note}</p>}
    </section>
  );
}
