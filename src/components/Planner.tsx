"use client";

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveScenario } from "@/app/actions";
import Gantt from "@/components/Gantt";
import { formatClock, summarise, type Status, type Summary } from "@/lib/clock";
import { defaultInput, effectiveToggles } from "@/lib/defaults";
import { schedule } from "@/lib/schedule";
import type { Aircraft } from "@/lib/templates";
import type { Adjustment, ScenarioInput, TemplateTask } from "@/lib/types";

// Shared by the task header row and each task row so the columns line up.
const ROW_COLS =
  "items-center sm:gap-x-6 lg:gap-x-3 xl:gap-x-6 sm:grid-cols-[minmax(0,1fr)_auto_auto_6.5rem]";

const STEP = 5;
const MAX_DELAY = 180;
const MAX_ADJUST = 120;

function clamp(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}

function Stepper({
  label,
  value,
  onChange,
  max,
  downLabel,
  upLabel,
  stacked = false,
  hideLabelOnWide = false,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  max: number;
  downLabel: string;
  upLabel: string;
  stacked?: boolean; // label above the control, in the same style as the time fields
  hideLabelOnWide?: boolean; // a column header stands in for the label from sm up
  disabled?: boolean;
}) {
  const btn = `flex ${stacked ? "size-11" : "size-10"} sm:size-8 items-center justify-center rounded-md border border-control bg-panel text-lg leading-none enabled:hover:bg-ground disabled:opacity-40`;
  return (
    <div
      className={
        stacked
          ? "text-sm font-medium text-ink"
          : "flex min-w-0 items-center gap-2 max-sm:flex-col max-sm:items-stretch max-sm:gap-0.5"
      }
    >
      <span
        className={
          stacked
            ? "block"
            : `min-w-20 text-xs text-muted max-sm:min-w-0 ${hideLabelOnWide ? "sm:hidden" : ""}`
        }
      >
        {label}
      </span>
      <div
        className={stacked
            ? "mt-1 flex h-11 items-center gap-2"
            : "contents max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-1"}
      >
        <button
          type="button"
          className={btn}
          aria-label={downLabel}
          disabled={disabled || value <= 0}
          onClick={() => onChange(clamp(value - STEP, max))}
        >
          −
        </button>
        <span
          className={`w-14 text-center tabular-nums ${stacked ? "" : "max-sm:w-auto max-sm:flex-1 max-sm:text-sm"}`}
          aria-live="polite"
        >
          {value} min
        </span>
        <button
          type="button"
          className={btn}
          aria-label={upLabel}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + STEP, max))}
        >
          +
        </button>
      </div>
    </div>
  );
}

type Props = {
  aircraft: Aircraft;
  tasks: TemplateTask[];
  initialInput?: ScenarioInput;
  initialTitle?: string;
  readOnly?: boolean;
  header?: ReactNode; // page title block, placed at the top of the controls column
};

// Edge in the status colour, words in its darker text shade so they pass AA.
const STATUS_STYLE: Record<Status, { text: string; edge: string }> = {
  "on-time": { text: "text-status-on-time-text", edge: "border-l-status-on-time" },
  tight: { text: "text-status-tight-text", edge: "border-l-status-tight" },
  late: { text: "text-status-late-text", edge: "border-l-status-late" },
};

function resultSentence(summary: Summary) {
  const pushback = `Pushback ${formatClock(summary.offBlock)}`;
  if (summary.status === "late")
    return `${pushback} — ${summary.departureDelay} min late.`;
  if (summary.buffer === 0)
    return `${pushback} — on time, with no time to spare.`;
  return `${pushback} — on time, ${summary.buffer} min to spare.`;
}

// One-line version for the pinned bar on phones.
function compactSentence(summary: Summary) {
  const pushback = `Pushback ${formatClock(summary.offBlock)}`;
  return summary.status === "late"
    ? `${pushback} — ${summary.departureDelay} min late`
    : `${pushback} — on time`;
}

const HINT_KEY = "turnaround-planner:hint-dismissed";

const hintListeners = new Set<() => void>();
function subscribeHint(listener: () => void) {
  hintListeners.add(listener);
  return () => void hintListeners.delete(listener);
}
let hintDismissedInMemory = false; // fallback when storage is unavailable
function readHintDismissed() {
  if (hintDismissedInMemory) return true;
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function formatChange(delta: number) {
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} min`;
}

type SavedLink = { url: string; copied: boolean; forState: string };

export default function Planner({
  aircraft,
  tasks,
  initialInput,
  initialTitle = "",
  readOnly = false,
  header,
}: Props) {
  const [input, setInput] = useState<ScenarioInput>(
    () => initialInput ?? defaultInput(aircraft),
  );
  const [locked, setLocked] = useState(readOnly);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [link, setLink] = useState<SavedLink | null>(null);
  const linkField = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  // True once the full result block has scrolled off the top (phones only
  // show the compact bar then).
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const el = resultRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setPinned(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A saved link only matches the state it was saved from; editing hides it.
  const state = JSON.stringify([input, title.trim()]);
  const shownLink = link && link.forState === state ? link : null;

  const result = schedule(
    tasks,
    effectiveToggles(input.toggles, aircraft.twoDoorAvailable),
    input.adjustments,
  );
  const summary = summarise(input, result);

  const labelFor = new Map(tasks.map((t) => [t.key, t.label]));
  const criticalLabels = result.criticalPath.map(
    (key) => labelFor.get(key) ?? key,
  );
  const style = STATUS_STYLE[summary.status];

  // Compare each new schedule with the previous one. The ref holds the last
  // one seen; the signature keeps the effect from firing on unrelated renders.
  const signature = JSON.stringify([
    summary.offBlock,
    result.tasks.map((t) => [t.key, t.earlyStart, t.earlyFinish]),
  ]);
  const prevSchedule = useRef<{
    offBlock: number;
    times: Map<string, string>;
  } | null>(null);
  const [change, setChange] = useState<{
    id: number;
    delta: number;
    keys: ReadonlySet<string>;
  } | null>(null);
  const [showDelta, setShowDelta] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deltaTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const times = new Map(
      result.tasks.map((t) => [t.key, `${t.earlyStart}-${t.earlyFinish}`]),
    );
    const prev = prevSchedule.current;
    prevSchedule.current = { offBlock: summary.offBlock, times };
    if (!prev) return;
    const keys = new Set(
      [...times].filter(([key, span]) => prev.times.get(key) !== span).map(([key]) => key),
    );
    const delta = summary.offBlock - prev.offBlock;
    if (keys.size === 0 && delta === 0) return;
    setChange((c) => ({ id: (c?.id ?? 0) + 1, delta, keys }));
    setShowDelta(delta !== 0);
    clearTimeout(flashTimer.current);
    clearTimeout(deltaTimer.current);
    flashTimer.current = setTimeout(() => setChange((c) => c && { ...c, keys: new Set() }), 1000);
    deltaTimer.current = setTimeout(() => setShowDelta(false), 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature stands in for result/summary
  }, [signature]);

  useEffect(
    () => () => {
      clearTimeout(flashTimer.current);
      clearTimeout(deltaTimer.current);
    },
    [],
  );

  // Server snapshot is "dismissed", so the hint never flashes in for
  // someone who already closed it.
  const hintDismissed = useSyncExternalStore(
    subscribeHint,
    readHintDismissed,
    () => true,
  );

  function dismissHint() {
    hintDismissedInMemory = true;
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
    hintListeners.forEach((l) => l());
  }

  function setAdjustment(key: string, patch: Partial<Adjustment>) {
    setInput((prev) => {
      const current = prev.adjustments[key] ?? {
        startDelay: 0,
        extraDuration: 0,
      };
      return {
        ...prev,
        adjustments: { ...prev.adjustments, [key]: { ...current, ...patch } },
      };
    });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    const forState = state;
    const res = await saveScenario(input, title);
    setSaving(false);
    if ("error" in res) {
      setSaveError(res.error);
      return;
    }
    const url = `${window.location.origin}/s/${res.slug}`;
    setLink({ url, copied: false, forState });
    // Safari can refuse this after the await; the link field below is the fallback.
    try {
      await navigator.clipboard.writeText(url);
      setLink({ url, copied: true, forState });
    } catch {
      linkField.current?.select();
    }
  }

  async function copyLink() {
    if (!shownLink) return;
    try {
      await navigator.clipboard.writeText(shownLink.url);
      setLink({ ...shownLink, copied: true });
    } catch {
      linkField.current?.select();
    }
  }

  const timeField =
    "block h-11 rounded-md border border-control bg-panel px-3 tabular-nums placeholder:text-muted";
  // Phones: a full-width row with the switch on the right. From sm up it is
  // the plain checkbox beside its label.
  const toggleRow =
    "flex min-h-11 items-center gap-3 max-sm:justify-between max-sm:rounded-md max-sm:border max-sm:border-line max-sm:px-3";
  const toggleBox =
    "size-5 accent-accent max-sm:relative max-sm:order-2 max-sm:h-7 max-sm:w-12 max-sm:shrink-0 max-sm:appearance-none max-sm:rounded-full max-sm:bg-control max-sm:transition-colors max-sm:before:absolute max-sm:before:top-0.5 max-sm:before:left-0.5 max-sm:before:size-6 max-sm:before:rounded-full max-sm:before:bg-panel max-sm:before:transition-transform max-sm:before:content-[''] max-sm:checked:bg-accent max-sm:checked:before:translate-x-5 max-sm:checked:before:bg-ink max-sm:disabled:opacity-50";
  const secondaryBtn =
    "h-11 rounded-md border border-control bg-panel px-4 font-medium hover:bg-ground";

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
      {/* Controls column. Below lg it dissolves (display: contents) into the
          single column, so the result line stays sticky over the whole page.
          The 4px padding keeps focus rings clear of the scroll edge. */}
      <div className="contents lg:sticky lg:top-3 lg:-m-1 lg:flex lg:max-h-[calc(100dvh-1.5rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:p-1">
        {header && <div>{header}</div>}

        <section
          ref={resultRef}
          aria-live="polite"
          className={`-mx-4 border-y border-l-[6px] border-line bg-panel/95 px-4 py-3 shadow-sm backdrop-blur sm:sticky sm:top-0 sm:z-10 sm:mx-0 sm:rounded-md sm:border-r ${style.edge}`}
        >
          <p
            className={`text-2xl leading-tight font-bold sm:text-3xl lg:text-2xl xl:text-[1.75rem] ${style.text}`}
          >
            {resultSentence(summary)}
            {showDelta && change && change.delta !== 0 && (
              <span
                className={`ml-3 text-lg font-semibold tabular-nums ${
                  change.delta > 0
                    ? "text-status-late-text"
                    : "text-status-on-time-text"
                }`}
              >
                {formatChange(change.delta)}
              </span>
            )}
          </p>
          <p className="mt-2 text-sm text-ink">
            Critical path: {criticalLabels.join(" → ")}
          </p>
          <p className="text-xs text-muted">
            The tasks that set the time. Delay any of them and pushback moves.
          </p>
        </section>

        {/* Phones: zero-height sticky anchor right after the full result. Once
            that has scrolled away, the one-line version pins to the top. The
            negative margin cancels the flex gap above it. */}
        <div aria-hidden="true" className="sticky top-0 z-10 -mt-4 h-0 sm:hidden">
          <div
            className={`-mx-4 border-y border-l-[6px] border-line bg-panel/95 px-4 py-2 shadow-sm backdrop-blur ${style.edge} ${pinned ? "" : "hidden"}`}
          >
            <p className={`truncate text-base leading-snug font-bold ${style.text}`}>
              {compactSentence(summary)}
              {showDelta && change && change.delta !== 0 && (
                <span className="ml-2 tabular-nums">{formatChange(change.delta)}</span>
              )}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted tabular-nums">
          Arrives {formatClock(summary.onBlock)} · Due out{" "}
          {formatClock(summary.std)} · Turn takes {result.turnMinutes} min
        </p>

        <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3 sm:gap-4 sm:p-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-4">
            <label className="min-w-0 text-sm font-medium text-ink">
              <span className="sm:hidden">Arrival (STA)</span>
              <span className="max-sm:hidden">Scheduled arrival (STA)</span>
              <span className="mt-1 flex items-center gap-3">
                <input
                  type="time"
                  className={`${timeField} max-sm:w-full max-sm:min-w-0`}
                  value={input.sta}
                  disabled={locked}
                  onChange={(e) =>
                    e.target.value && setInput({ ...input, sta: e.target.value })
                  }
                />
                <span className="font-normal tabular-nums text-muted max-sm:hidden">
                  {input.sta}
                </span>
              </span>
            </label>
            <label className="min-w-0 text-sm font-medium text-ink">
              <span className="sm:hidden">Departure (STD)</span>
              <span className="max-sm:hidden">Scheduled departure (STD)</span>
              <span className="mt-1 flex items-center gap-3">
                <input
                  type="time"
                  className={`${timeField} max-sm:w-full max-sm:min-w-0`}
                  value={input.std}
                  disabled={locked}
                  onChange={(e) =>
                    e.target.value && setInput({ ...input, std: e.target.value })
                  }
                />
                <span className="font-normal tabular-nums text-muted max-sm:hidden">
                  {input.std}
                </span>
              </span>
            </label>
            <div className="col-span-2 sm:col-auto">
              <Stepper
                label="Inbound delay"
                stacked
                value={input.arrivalDelay}
                max={MAX_DELAY}
                disabled={locked}
                downLabel="Inbound delay: earlier"
                upLabel="Inbound delay: later"
                onChange={(arrivalDelay) => setInput({ ...input, arrivalDelay })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-3 sm:gap-6 lg:flex-col lg:gap-1">
            {aircraft.twoDoorAvailable ? (
              <label className={toggleRow}>
                <input
                  type="checkbox"
                  role="switch"
                  className={toggleBox}
                  checked={input.toggles.twoDoor}
                  disabled={locked}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      toggles: { ...input.toggles, twoDoor: e.target.checked },
                    })
                  }
                />
                Board through two doors
              </label>
            ) : (
              <p className="flex min-h-11 items-center text-muted max-sm:px-1">
                The ATR 72 boards through one door.
              </p>
            )}
            <label className={toggleRow}>
              <input
                type="checkbox"
                role="switch"
                className={toggleBox}
                checked={input.toggles.fwpob}
                disabled={locked}
                onChange={(e) =>
                  setInput({
                    ...input,
                    toggles: { ...input.toggles, fwpob: e.target.checked },
                  })
                }
              />
              Refuel with passengers on board
            </label>
            {locked ? (
              <button
                type="button"
                className={`${secondaryBtn} sm:ml-auto lg:ml-0 lg:self-start`}
                onClick={() => setLocked(false)}
              >
                Copy and edit
              </button>
            ) : (
              <button
                type="button"
                className={`${secondaryBtn} sm:ml-auto lg:ml-0 lg:self-start`}
                onClick={() => setInput(defaultInput(aircraft))}
              >
                Reset
              </button>
            )}
          </div>

          {!locked && (
            <div className="border-t border-line pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
                <label className="text-sm font-medium text-ink sm:w-72 lg:w-auto">
                  Title (optional)
                  <input
                    type="text"
                    maxLength={60}
                    className={`${timeField} mt-1 w-full font-normal`}
                    value={title}
                    placeholder="e.g. Rainy day, late catering"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="h-11 rounded-md bg-accent px-4 font-semibold text-ink enabled:hover:bg-accent-hover disabled:opacity-60"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? "Saving…" : "Save & share"}
                </button>
              </div>
              <div aria-live="polite" className="mt-2 text-sm">
                {saveError && (
                  <p className="text-status-late-text">{saveError}</p>
                )}
                {shownLink?.copied && (
                  <p className="text-status-on-time-text">Link copied</p>
                )}
              </div>
              {shownLink && (
                <div className="mt-2 flex gap-2">
                  <input
                    ref={linkField}
                    readOnly
                    aria-label="Share link"
                    className={`${timeField} min-w-0 flex-1`}
                    value={shownLink.url}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button type="button" className={secondaryBtn} onClick={copyLink}>
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline column */}
      <div className="flex min-w-0 flex-col gap-4">
        {!readOnly && !hintDismissed && (
          <div className="flex items-start gap-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink">
            <p className="flex-1">
              Yellow bars are the critical path. A faint tail is spare time. A
              dotted segment means the team is late.
            </p>
            <button
              type="button"
              aria-label="Dismiss hint"
              className="-my-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-lg leading-none text-muted hover:bg-ground"
              onClick={dismissHint}
            >
              ×
            </button>
          </div>
        )}
        <Gantt
          result={result}
          summary={summary}
          changed={change?.keys}
          flashId={change?.id}
        />

        <div>
          <div
            aria-hidden="true"
            className={`hidden px-3 text-xs text-muted ${ROW_COLS} sm:grid`}
          >
            <span>Task</span>
            <span className="w-[8.5rem]">Starts late</span>
            <span className="w-[8.5rem]">Runs long</span>
            <span>Time</span>
          </div>
          <ul className="mt-1.5 flex flex-col gap-2 sm:gap-1.5">
            {result.tasks.map((task) => {
              const adj = input.adjustments[task.key] ?? {
                startDelay: 0,
                extraDuration: 0,
              };
              return (
                <li
                  key={task.key}
                  className={`grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-line bg-panel p-2.5 sm:gap-y-0 sm:p-3 sm:py-1.5 ${ROW_COLS}`}
                >
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 sm:order-none">
                    <span className="font-medium">{task.label}</span>
                    {task.critical && (
                      <span className="rounded bg-critical px-1.5 text-[11px] font-semibold sm:px-2 sm:py-0.5 sm:text-xs text-critical-ink">
                        critical
                      </span>
                    )}
                  </div>
                  <span className="justify-self-end tabular-nums text-sm text-ink sm:order-none sm:col-start-4 sm:row-start-1 sm:justify-self-start">
                    {formatClock(summary.onBlock + task.earlyStart)}–
                    {formatClock(summary.onBlock + task.earlyFinish)}
                  </span>
                  <Stepper
                    hideLabelOnWide
                    label="Starts late"
                    value={adj.startDelay}
                    max={MAX_ADJUST}
                    disabled={locked}
                    downLabel={`${task.label}: start earlier`}
                    upLabel={`${task.label}: start later`}
                    onChange={(startDelay) =>
                      setAdjustment(task.key, { startDelay })
                    }
                  />
                  <Stepper
                    hideLabelOnWide
                    label="Runs long"
                    value={adj.extraDuration}
                    max={MAX_ADJUST}
                    disabled={locked}
                    downLabel={`${task.label}: run shorter`}
                    upLabel={`${task.label}: run longer`}
                    onChange={(extraDuration) =>
                      setAdjustment(task.key, { extraDuration })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
