import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Planner from "@/components/Planner";
import { AIRCRAFT_TYPE_IDS, getTemplate, isAircraftTypeId } from "@/lib/templates";
import { PAGE_CONTAINER } from "@/lib/layout";

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
    <main className={`${PAGE_CONTAINER} pt-5 pb-10 lg:pt-6`}>
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
    <Planner
      aircraft={aircraft}
      tasks={tasks}
      header={
        <>
          <h1 className="text-3xl font-bold tracking-tight">{aircraft.name}</h1>
          <p className="mt-1 text-muted">
            {aircraft.seats} seats · {aircraft.defaultGroundMinutes} min scheduled at the gate
          </p>
        </>
      }
    />
  );
}

// Mirrors the real layout: title, subtitle, result line, facts and controls on
// the left from lg up; timeline on the right.
function PlanSkeleton() {
  const bar = "rounded bg-line motion-safe:animate-pulse";
  return (
    <div
      aria-busy="true"
      aria-label="Loading planner"
      className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[400px_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex h-9 items-center">
            <div className={`h-7 w-56 ${bar}`} />
          </div>
          <div className="mt-1 flex h-6 items-center">
            <div className={`h-4 w-72 max-w-full ${bar}`} />
          </div>
        </div>

        <div className="-mx-4 border-y border-l-[6px] border-line bg-panel px-4 py-3 sm:mx-0 sm:rounded-md sm:border-r">
          <div className="flex h-8 items-center sm:h-9 lg:h-8">
            <div className={`h-6 w-80 max-w-full ${bar}`} />
          </div>
          <div className="mt-2 flex h-5 items-center">
            <div className={`h-3 w-96 max-w-full ${bar}`} />
          </div>
          <div className="flex h-4 items-center">
            <div className={`h-2.5 w-64 max-w-full ${bar}`} />
          </div>
        </div>

        <div className="flex h-5 items-center">
          <div className={`h-3 w-64 max-w-full ${bar}`} />
        </div>

        <div className="min-h-48 rounded-lg border border-line bg-panel" />
      </div>

      <div className="min-h-64 rounded-lg border border-dashed border-line bg-panel lg:min-h-96" />
    </div>
  );
}
