import { ImageResponse } from "next/og";
import { formatClock, summarise } from "@/lib/clock";
import { effectiveToggles } from "@/lib/defaults";
import { isSlug } from "@/lib/scenario";
import { schedule } from "@/lib/schedule";
import { getScenario, getTemplate } from "@/lib/templates";
import { theme } from "@/lib/theme";
import SiteImage from "../../opengraph-image";

export const alt = "Aircraft turnaround result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Edge in the status colour; the sentence in its darker text shade so it passes contrast.
const STATUS_COLOUR = {
  "on-time": { edge: theme.statusOnTime, text: theme.statusOnTimeText },
  tight: { edge: theme.statusTight, text: theme.statusTightText },
  late: { edge: theme.statusLate, text: theme.statusLateText },
} as const;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSlug(slug)) return SiteImage();

  const scenario = await getScenario(slug);
  if (!scenario) return SiteImage();
  const template = await getTemplate(scenario.aircraftTypeId);
  if (!template) return SiteImage();

  const { aircraft, tasks } = template;
  const { input } = scenario;
  const result = schedule(tasks, effectiveToggles(input.toggles, aircraft.twoDoorAvailable), input.adjustments);
  const summary = summarise(input, result);

  const pushback = `Pushback ${formatClock(summary.offBlock)}`;
  const line =
    summary.status === "late"
      ? `${pushback} — ${summary.departureDelay} min late`
      : summary.buffer === 0
        ? `${pushback} — on time, no time to spare`
        : `${pushback} — on time, ${summary.buffer} min to spare`;
  const colour = STATUS_COLOUR[summary.status];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: theme.ground,
          color: theme.ink,
          borderLeft: `24px solid ${colour.edge}`,
        }}
      >
        <div style={{ fontSize: 34, color: theme.muted, textTransform: "uppercase", letterSpacing: 2, display: "flex" }}>
          Aircraft Turnaround Planner
        </div>
        <div style={{ marginTop: 24, fontSize: 84, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>
          {scenario.title ?? aircraft.name}
        </div>
        {scenario.title && (
          <div style={{ marginTop: 12, fontSize: 38, color: theme.muted, display: "flex" }}>{aircraft.name}</div>
        )}
        <div style={{ marginTop: 48, fontSize: 60, fontWeight: 700, color: colour.text, display: "flex" }}>{line}</div>
      </div>
    ),
    { ...size },
  );
}
