"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock, type Status, type Summary } from "@/lib/clock";
import type { Category, ScheduleResult, ScheduledTask } from "@/lib/types";

// Layout in px. The SVG is drawn at the measured container width,
// never narrower than MIN_WIDTH; the wrapper scrolls sideways below that.
const MIN_WIDTH = 640;
const LABEL_W = 196; // fits "Close doors and remove bridges" at 12px
const RIGHT_PAD = 20;
const TOP = 40; // two rows of marker labels (STD, Pushback)
const ROW_H = 26;
const BAR_H = 14;
const AXIS_H = 28;
const MIN_TICK_GAP = 40; // px between clock labels before we thin them out

// Full class names so Tailwind picks them up.
const CATEGORY: Record<
  Category,
  { name: string; fill: string; stroke: string; bg: string }
> = {
  passenger: { name: "Passengers", fill: "fill-cat-passenger", stroke: "stroke-cat-passenger", bg: "bg-cat-passenger" },
  baggage: { name: "Baggage", fill: "fill-cat-baggage", stroke: "stroke-cat-baggage", bg: "bg-cat-baggage" },
  fuel: { name: "Fuel", fill: "fill-cat-fuel", stroke: "stroke-cat-fuel", bg: "bg-cat-fuel" },
  catering: { name: "Catering", fill: "fill-cat-catering", stroke: "stroke-cat-catering", bg: "bg-cat-catering" },
  cleaning: { name: "Cleaning", fill: "fill-cat-cleaning", stroke: "stroke-cat-cleaning", bg: "bg-cat-cleaning" },
  technical: { name: "Technical", fill: "fill-cat-technical", stroke: "stroke-cat-technical", bg: "bg-cat-technical" },
  departure: { name: "Departure", fill: "fill-cat-departure", stroke: "stroke-cat-departure", bg: "bg-cat-departure" },
};

// Line in the status colour, label in its darker text shade (12px text needs 4.5:1).
const STATUS: Record<Status, { stroke: string; fill: string }> = {
  "on-time": { stroke: "stroke-status-on-time", fill: "fill-status-on-time-text" },
  tight: { stroke: "stroke-status-tight", fill: "fill-status-tight-text" },
  late: { stroke: "stroke-status-late", fill: "fill-status-late-text" },
};

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, Math.max(MIN_WIDTH, width)] as const;
}

// Marker labels are 12px semibold with tabular digits; 7px a character
// slightly overestimates, which only adds clearance.
const CHAR_W = 7;
const LABEL_GAP = 4; // label to its own line
const ROW1 = 14; // baselines of the two marker label rows
const ROW2 = 30;
const CAP = 10; // text height above the baseline

function textWidth(text: string) {
  return text.length * CHAR_W;
}

type MarkerLayout = {
  stacked: boolean;
  // textX is the label's right edge for STD and its left edge for Pushback.
  std: { textX: number; baseline: number; lineTop: number; tickFrom?: number };
  push: { textX: number; baseline: number; lineTop: number };
};

// STD label sits left of its line, Pushback right of its line. Those only
// collide when pushback comes before STD; then Pushback moves to the top row
// and the STD line starts below it, so neither line crosses any text.
export function layoutMarkers(
  stdX: number,
  pushX: number,
  stdW: number,
  pushW: number,
): MarkerLayout {
  const stdBox = [stdX - LABEL_GAP - stdW, stdX - LABEL_GAP];
  const pushBox = [pushX + LABEL_GAP, pushX + LABEL_GAP + pushW];
  const hits = (box: number[], lineX: number) =>
    lineX > box[0] - 2 && lineX < box[1] + 2;
  const boxesOverlap = stdBox[1] + 6 > pushBox[0] && pushBox[1] + 6 > stdBox[0];

  const push = { textX: pushBox[0], baseline: ROW1, lineTop: 4 };
  if (!boxesOverlap && !hits(stdBox, pushX) && !hits(pushBox, stdX)) {
    const lineTop = ROW2 - CAP - 6;
    return {
      stacked: false,
      std: { textX: stdBox[1], baseline: ROW2, lineTop },
      push: { ...push, baseline: ROW2, lineTop },
    };
  }

  // Stacked: STD on the lower row. If its usual spot would sit on the
  // Pushback line, it moves left of that line with a short tick to its own.
  const lineTop = ROW2 - CAP / 2 + 1;
  if (!hits(stdBox, pushX)) {
    return {
      stacked: true,
      std: { textX: stdBox[1], baseline: ROW2, lineTop: ROW2 - CAP },
      push,
    };
  }
  const textX = pushX - LABEL_GAP;
  return {
    stacked: true,
    std: { textX, baseline: ROW2, lineTop, tickFrom: textX + 2 },
    push,
  };
}

function barTitle(task: ScheduledTask, onBlock: number) {
  const parts = [
    task.label,
    `${formatClock(onBlock + task.earlyStart)}–${formatClock(onBlock + task.earlyFinish)}`,
  ];
  if (task.startDelay > 0) parts.push(`team ${task.startDelay} min late`);
  parts.push(
    task.critical
      ? "on the critical path"
      : `can slip ${task.float} min without delaying pushback`,
  );
  return parts.join(" · ");
}

// Every 10 min, unless that would crowd the labels (very long inbound delays).
function tickStep(span: number, plotWidth: number) {
  for (const step of [10, 20, 30, 60]) {
    if ((step / span) * plotWidth >= MIN_TICK_GAP) return step;
  }
  return 120;
}

export default function Gantt({
  result,
  summary,
}: {
  result: ScheduleResult;
  summary: Summary;
}) {
  const [wrapperRef, width] = useWidth();
  const { tasks, turnMinutes } = result;
  const { onBlock, stdOffset } = summary;

  const stdText = `STD ${formatClock(summary.std)}`;
  const pushText = `Pushback ${formatClock(summary.offBlock)}`;

  const domainStart = Math.min(0, stdOffset);
  const domainEnd = Math.max(turnMinutes, stdOffset) + 5;
  const span = domainEnd - domainStart;
  const scale = (rightPad: number) => (m: number) =>
    LABEL_W + ((m - domainStart) / span) * (width - LABEL_W - rightPad);
  // The Pushback label sits right of its line, so make room for it at the
  // right edge: solve LABEL_W + f·(width − LABEL_W − pad) ≤ width − room for pad.
  const room = LABEL_GAP + textWidth(pushText) + 6;
  const f = (turnMinutes - domainStart) / span;
  const rightPad = Math.max(
    RIGHT_PAD,
    Math.ceil(width - LABEL_W - (width - room - LABEL_W) / f),
  );
  const plotWidth = width - LABEL_W - rightPad;
  const x = scale(rightPad);

  const rowsEnd = TOP + tasks.length * ROW_H;
  const height = rowsEnd + AXIS_H;

  const step = tickStep(span, plotWidth);
  const ticks: number[] = [];
  for (let m = Math.ceil(domainStart / step) * step; m <= domainEnd; m += step) {
    ticks.push(m);
  }

  const stdX = x(stdOffset);
  const pushX = x(turnMinutes);
  const markers = layoutMarkers(
    stdX,
    pushX,
    textWidth(stdText),
    textWidth(pushText),
  );
  const status = STATUS[summary.status];

  const critical = tasks.filter((t) => t.critical).map((t) => t.label);
  const ariaLabel =
    `Turnaround timeline, ${tasks.length} tasks over ${turnMinutes} minutes from on-block at ${formatClock(onBlock)}. ` +
    `Critical path: ${critical.join(", ")}. ` +
    `Pushback ${formatClock(summary.offBlock)}, STD ${formatClock(summary.std)}.`;

  const usedCategories = (Object.keys(CATEGORY) as Category[]).filter((c) =>
    tasks.some((t) => t.category === c),
  );

  return (
    <figure className="rounded-lg border border-line bg-panel p-2 sm:p-3">
      <div ref={wrapperRef} className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="block font-sans text-xs tabular-nums"
        >
          {/* Row bands and labels */}
          {tasks.map((task, i) => {
            const y = TOP + i * ROW_H;
            return (
              <g key={task.key}>
                {i % 2 === 0 && (
                  <rect
                    x={0}
                    y={y}
                    width={width}
                    height={ROW_H}
                    className="fill-stripe"
                  />
                )}
                <text
                  x={LABEL_W - 12}
                  y={y + ROW_H / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-ink"
                >
                  {task.label}
                </text>
              </g>
            );
          })}

          {/* Grid and clock axis */}
          {ticks.map((m) => (
            <g key={m}>
              <line
                x1={x(m)}
                x2={x(m)}
                y1={TOP}
                y2={rowsEnd + 4}
                className={m === 0 ? "stroke-control" : "stroke-grid"}
                strokeWidth={1}
                strokeDasharray={m === 0 ? undefined : "2 3"}
              />
              <text
                x={x(m)}
                y={rowsEnd + 18}
                textAnchor="middle"
                className={m === 0 ? "fill-ink" : "fill-muted"}
              >
                {formatClock(onBlock + m)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {tasks.map((task, i) => {
            const y = TOP + i * ROW_H + (ROW_H - BAR_H) / 2;
            const cat = CATEGORY[task.category];
            const x0 = x(task.earlyStart);
            const x1 = x(task.earlyFinish);
            const barW = Math.max(2, x1 - x0);
            const tailW = x(task.earlyFinish + task.float) - x1;
            const waitX = x(task.earlyStart - task.startDelay);
            return (
              <g key={task.key}>
                <title>{barTitle(task, onBlock)}</title>
                {task.startDelay > 0 && (
                  <line
                    x1={waitX}
                    x2={x0 - 2}
                    y1={y + BAR_H / 2}
                    y2={y + BAR_H / 2}
                    className={cat.stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="0 5"
                  />
                )}
                {tailW > 0 && (
                  <rect
                    x={x1}
                    y={y + 3}
                    width={tailW}
                    height={BAR_H - 6}
                    rx={2}
                    className={cat.fill}
                    opacity={0.25}
                  />
                )}
                <rect
                  x={x0}
                  y={y}
                  width={barW}
                  height={BAR_H}
                  rx={2}
                  className={task.critical ? "fill-critical" : cat.fill}
                />
                {task.critical && (
                  <>
                    <rect
                      x={x0}
                      y={y}
                      width={Math.min(3, barW)}
                      height={BAR_H}
                      className={cat.fill}
                    />
                    {/* Dark edge so the yellow holds its shape on white */}
                    <rect
                      x={x0 + 0.5}
                      y={y + 0.5}
                      width={Math.max(1, barW - 1)}
                      height={BAR_H - 1}
                      rx={2}
                      fill="none"
                      className="stroke-critical-ink"
                      strokeWidth={1}
                    />
                  </>
                )}
                {/* Wider invisible hit area so the tooltip is easy to reach */}
                <rect
                  x={Math.min(waitX, x0)}
                  y={y - 4}
                  width={Math.max(barW, x1 + Math.max(0, tailW) - Math.min(waitX, x0))}
                  height={BAR_H + 8}
                  fill="transparent"
                />
              </g>
            );
          })}

          {/* STD (label left of its line) and Pushback (label right of its line) */}
          <line
            x1={stdX}
            x2={stdX}
            y1={markers.std.lineTop}
            y2={rowsEnd + 4}
            className="stroke-ink"
            strokeWidth={1.5}
          />
          {markers.std.tickFrom !== undefined && (
            <line
              x1={markers.std.tickFrom}
              x2={stdX}
              y1={markers.std.lineTop}
              y2={markers.std.lineTop}
              className="stroke-ink"
              strokeWidth={1.5}
            />
          )}
          <text
            x={markers.std.textX}
            y={markers.std.baseline}
            textAnchor="end"
            className="fill-ink font-semibold"
          >
            {stdText}
          </text>
          <line
            x1={pushX}
            x2={pushX}
            y1={markers.push.lineTop}
            y2={rowsEnd + 4}
            className={status.stroke}
            strokeWidth={2}
          />
          <text
            x={markers.push.textX}
            y={markers.push.baseline}
            textAnchor="start"
            className={`${status.fill} font-semibold`}
          >
            {pushText}
          </text>
        </svg>
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        {usedCategories.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${CATEGORY[c].bg}`} />
            {CATEGORY[c].name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-l-[3px] border-critical-ink border-l-cat-passenger bg-critical" />
          Critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-sm bg-cat-passenger/25" />
          Room to slip
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dotted border-muted" />
          Waiting for team
        </span>
      </figcaption>
    </figure>
  );
}
