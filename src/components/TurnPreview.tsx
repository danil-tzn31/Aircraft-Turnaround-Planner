import type { Category, ScheduleResult } from "@/lib/types";

const FILL: Record<Category, string> = {
  passenger: "fill-cat-passenger",
  baggage: "fill-cat-baggage",
  fuel: "fill-cat-fuel",
  catering: "fill-cat-catering",
  cleaning: "fill-cat-cleaning",
  technical: "fill-cat-technical",
  departure: "fill-cat-departure",
};

const W = 300;
const ROW = 5;
const BAR = 3;

// Compact, non-interactive timeline: thin bars only, critical ones in yellow.
export default function TurnPreview({ result }: { result: ScheduleResult }) {
  const { tasks, turnMinutes } = result;
  const height = tasks.length * ROW;
  const x = (m: number) => (m / turnMinutes) * W;
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block h-14 w-full"
    >
      {tasks.map((t, i) => (
        <rect
          key={t.key}
          x={x(t.earlyStart)}
          y={i * ROW + (ROW - BAR) / 2}
          width={Math.max(1, x(t.earlyFinish) - x(t.earlyStart))}
          height={BAR}
          rx={1}
          className={t.critical ? "fill-critical" : FILL[t.category]}
        />
      ))}
    </svg>
  );
}
