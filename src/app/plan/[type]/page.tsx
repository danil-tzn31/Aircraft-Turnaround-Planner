import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Planner from "@/components/Planner";
import { AIRCRAFT_TYPE_IDS, getTemplate, isAircraftTypeId } from "@/lib/templates";

type Params = PageProps<"/plan/[type]">["params"];

export function generateStaticParams() {
  return AIRCRAFT_TYPE_IDS.map((type) => ({ type }));
}

export async function generateMetadata({ params }: PageProps<"/plan/[type]">): Promise<Metadata> {
  const { type } = await params;
  if (!isAircraftTypeId(type)) return {};
  return { title: type };
}

// Not async: params are awaited inside the boundary so the shell renders without them.
export default function PlanPage({ params }: PageProps<"/plan/[type]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <Suspense fallback={<PlanSkeleton />}>
        <PlanContent params={params} />
      </Suspense>
    </main>
  );
}

async function PlanContent({ params }: { params: Params }) {
  const { type } = await params;
  // Check the id first so unknown URLs never reach the database.
  if (!isAircraftTypeId(type)) notFound();

  const template = await getTemplate(type);
  if (!template) notFound();

  const { aircraft, tasks } = template;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{aircraft.name}</h1>
      <p className="mt-1 text-asphalt-400">
        {aircraft.seats} seats · {aircraft.defaultGroundMinutes} min scheduled at the gate
      </p>
      <Planner aircraft={aircraft} tasks={tasks} />
    </>
  );
}

// Heights mirror the real page line by line (title, subtitle, result line, facts, timeline).
function PlanSkeleton() {
  const bar = "rounded bg-asphalt-700 motion-safe:animate-pulse";
  return (
    <div aria-busy="true" aria-label="Loading planner">
      <div className="flex h-9 items-center">
        <div className={`h-7 w-56 ${bar}`} />
      </div>
      <div className="mt-1 flex h-6 items-center">
        <div className={`h-4 w-72 max-w-full ${bar}`} />
      </div>

      <div className="mt-6">
        <div className="-mx-4 border-l-4 border-asphalt-600 bg-asphalt-950/95 px-4 py-3 sm:mx-0 sm:rounded-md">
          <div className="flex h-7 items-center sm:h-8">
            <div className={`h-5 w-80 max-w-full sm:h-6 ${bar}`} />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <div className={`h-3 w-96 max-w-full ${bar}`} />
          </div>
          <div className="flex h-4 items-center">
            <div className={`h-2.5 w-64 max-w-full ${bar}`} />
          </div>
        </div>

        <div className="mt-4 flex h-5 items-center">
          <div className={`h-3 w-64 max-w-full ${bar}`} />
        </div>

        <div className="mt-6 min-h-64 rounded-lg border border-dashed border-asphalt-600 bg-asphalt-800" />
      </div>
    </div>
  );
}
