"use client";

import { useState } from "react";
import { formatClock, summarise, type Status, type Summary } from "@/lib/clock";
import { defaultInput, effectiveToggles } from "@/lib/defaults";
import { schedule } from "@/lib/schedule";
import type { Aircraft } from "@/lib/templates";
import type { ScenarioInput, TemplateTask } from "@/lib/types";

type Props = {
  aircraft: Aircraft;
  tasks: TemplateTask[];
  initialInput?: ScenarioInput;
  readOnly?: boolean;
};

const STATUS_STYLE: Record<Status, { text: string; edge: string }> = {
  "on-time": { text: "text-status-on-time", edge: "border-status-on-time" },
  tight: { text: "text-status-tight", edge: "border-status-tight" },
  late: { text: "text-status-late", edge: "border-status-late" },
};

function resultSentence(summary: Summary) {
  const pushback = `Pushback ${formatClock(summary.offBlock)}`;
  if (summary.status === "late") return `${pushback} — ${summary.departureDelay} min late.`;
  if (summary.buffer === 0) return `${pushback} — on time, with no time to spare.`;
  return `${pushback} — on time, ${summary.buffer} min to spare.`;
}

// readOnly is wired up in P6.
export default function Planner({ aircraft, tasks, initialInput }: Props) {
  // Setter comes in with the controls in P4b.
  const [input] = useState<ScenarioInput>(() => initialInput ?? defaultInput(aircraft));

  const result = schedule(
    tasks,
    effectiveToggles(input.toggles, aircraft.twoDoorAvailable),
    input.adjustments,
  );
  const summary = summarise(input, result);

  const labelFor = new Map(tasks.map((t) => [t.key, t.label]));
  const criticalLabels = result.criticalPath.map((key) => labelFor.get(key) ?? key);
  const style = STATUS_STYLE[summary.status];

  return (
    <div className="mt-6">
      <section
        aria-live="polite"
        className={`sticky top-0 z-10 -mx-4 border-l-4 bg-asphalt-950/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md ${style.edge}`}
      >
        <p className={`text-xl font-semibold sm:text-2xl ${style.text}`}>{resultSentence(summary)}</p>
        <p className="mt-1 text-sm text-asphalt-200">
          Critical path: {criticalLabels.join(" → ")}
        </p>
        <p className="text-xs text-asphalt-400">
          The tasks that set the time. Delay any of them and pushback moves.
        </p>
      </section>

      <p className="mt-4 text-sm text-asphalt-400 tabular-nums">
        Arrives {formatClock(summary.onBlock)} · Due out {formatClock(summary.std)} · Turn takes{" "}
        {result.turnMinutes} min
      </p>

      <div className="mt-6 flex min-h-64 items-center justify-center rounded-lg border border-dashed border-asphalt-600 bg-asphalt-800 text-sm text-asphalt-400">
        Timeline goes here
      </div>
    </div>
  );
}
