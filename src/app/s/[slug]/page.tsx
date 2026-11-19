import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Planner from "@/components/Planner";
import { formatClock, summarise } from "@/lib/clock";
import { effectiveToggles } from "@/lib/defaults";
import { isSlug } from "@/lib/scenario";
import { schedule } from "@/lib/schedule";
import { getScenario, getTemplate } from "@/lib/templates";
import type { ScenarioInput } from "@/lib/types";

type Params = PageProps<"/s/[slug]">["params"];

// Both the page and the link preview need the same data, so it's loaded in one place.
async function loadShared(slug: string) {
  // Check the shape first so junk URLs never reach the database.
  if (!isSlug(slug)) return null;

  const scenario = await getScenario(slug);
  if (!scenario) return null;

  const template = await getTemplate(scenario.aircraftTypeId);
  if (!template) return null;

  const { aircraft, tasks } = template;

  // Drop adjustments for tasks the template no longer has.
  const known = new Set(tasks.map((t) => t.key));
  const input: ScenarioInput = {
    ...scenario.input,
    adjustments: Object.fromEntries(
      Object.entries(scenario.input.adjustments).filter(([key]) => known.has(key)),
    ),
  };

  return {
    scenario,
    aircraft,
    tasks,
    input,
    outdated: scenario.templateVersion !== aircraft.templateVersion,
  };
}

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const shared = await loadShared(slug);
  if (!shared) return {};

  const { scenario, aircraft, tasks, input } = shared;
  const result = schedule(tasks, effectiveToggles(input.toggles, aircraft.twoDoorAvailable), input.adjustments);
  const summary = summarise(input, result);

  const pushback = `pushback ${formatClock(summary.offBlock)}`;
  const outcome = summary.status === "late" ? `${summary.departureDelay} min late` : "on time";
  const description = `${aircraft.id} turn — ${pushback}, ${outcome}.`;
  const title = scenario.title ?? `${aircraft.id} turn`;

  // openGraph replaces the layout's object, so siteName and type are repeated here.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/s/${slug}`,
      siteName: "Aircraft Turnaround Planner",
      type: "website",
    },
  };
}

// Not async: params are awaited inside the boundary so the shell renders without them.
export default function SharedPage({ params }: PageProps<"/s/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-10 sm:px-6 lg:pt-6">
      <Suspense fallback={<SharedSkeleton />}>
        <SharedContent params={params} />
      </Suspense>
    </main>
  );
}

async function SharedContent({ params }: { params: Params }) {
  const { slug } = await params;
  const shared = await loadShared(slug);
  if (!shared) notFound();

  const { scenario, aircraft, tasks, input, outdated } = shared;

  return (
    <Planner
      aircraft={aircraft}
      tasks={tasks}
      initialInput={input}
      initialTitle={scenario.title ?? ""}
      readOnly
      header={
        <>
          <h1 className="text-3xl font-bold tracking-tight">{scenario.title ?? aircraft.name}</h1>
          <p className="mt-1 text-muted">
            {scenario.title ? `${aircraft.name} · ` : ""}
            {aircraft.seats} seats · A saved scenario
          </p>
          {outdated && (
            <p className="mt-3 rounded-md border border-status-tight bg-panel px-3 py-2 text-sm text-status-tight-text">
              Durations have been updated since this was saved.
            </p>
          )}
        </>
      }
    />
  );
}

function SharedSkeleton() {
  const bar = "rounded bg-line motion-safe:animate-pulse";
  return (
    <div
      aria-busy="true"
      aria-label="Loading saved scenario"
      className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[400px_minmax(0,1fr)]"
    >
      <div className="flex h-9 items-center">
        <div className={`h-7 w-56 ${bar}`} />
      </div>
      <div className="min-h-64 rounded-lg border border-dashed border-line bg-panel lg:min-h-96" />
    </div>
  );
}
