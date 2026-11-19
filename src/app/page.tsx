import Link from "next/link";
import { defaultToggles } from "@/lib/defaults";
import { schedule } from "@/lib/schedule";
import { getAircraftTypes, getTemplate } from "@/lib/templates";

export default async function Home() {
  const types = await getAircraftTypes();
  const templates = await Promise.all(types.map((t) => getTemplate(t.id)));

  const cards = types.map((aircraft, i) => {
    const tasks = templates[i]?.tasks ?? [];
    const turnMinutes = tasks.length ? schedule(tasks, defaultToggles(aircraft), {}).turnMinutes : null;
    return { ...aircraft, turnMinutes };
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Aircraft Turnaround Planner</h1>
      <p className="mt-4 max-w-2xl text-xl text-asphalt-200">
        See how delays move an aircraft&apos;s departure, using critical path scheduling.
      </p>
      <p className="mt-6 max-w-2xl text-asphalt-400">
        A turnaround is everything that happens between an aircraft parking at the gate and pushing
        back again: passengers off, cleaning, catering, fuel, bags, and passengers on.
      </p>

      <h2 className="mt-14 text-sm font-semibold tracking-wide text-asphalt-400 uppercase">
        Pick an aircraft
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/plan/${card.id}`}
              className="group flex h-full flex-col rounded-lg border border-asphalt-700 bg-asphalt-800 p-5 transition-colors hover:border-safety focus-visible:border-safety focus-visible:outline-none"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xl font-semibold">{card.name}</h3>
                <span className="text-sm text-asphalt-400">{card.id}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-asphalt-400">Seats</dt>
                  <dd className="text-lg font-medium tabular-nums">{card.seats}</dd>
                </div>
                <div>
                  <dt className="text-asphalt-400">Typical turn</dt>
                  <dd className="text-lg font-medium tabular-nums">
                    {card.turnMinutes === null ? "—" : `${card.turnMinutes} min`}
                  </dd>
                </div>
              </dl>
              <span className="mt-5 text-sm font-semibold text-safety group-hover:underline">
                Start planning →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
