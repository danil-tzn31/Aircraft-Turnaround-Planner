import Link from "next/link";
import { defaultToggles } from "@/lib/defaults";
import TurnPreview from "@/components/TurnPreview";
import { schedule } from "@/lib/schedule";
import { getAircraftTypes, getTemplate } from "@/lib/templates";

export default async function Home() {
  const types = await getAircraftTypes();
  const templates = await Promise.all(types.map((t) => getTemplate(t.id)));

  const cards = types.map((aircraft, i) => {
    const tasks = templates[i]?.tasks ?? [];
    const toggles = defaultToggles(aircraft);
    const result = tasks.length ? schedule(tasks, toggles, {}) : null;
    return { ...aircraft, result, twoDoor: toggles.twoDoor };
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Aircraft Turnaround Planner</h1>
      <p className="mt-1.5 max-w-2xl text-lg text-ink sm:mt-2 sm:text-xl">
        See how delays move an aircraft&apos;s departure, using critical path scheduling.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted sm:mt-3 sm:text-base">
        A turnaround is everything that happens between an aircraft parking at the gate and pushing
        back again: passengers off, cleaning, catering, fuel, bags, and passengers on.
      </p>

      <h2 className="mt-6 text-sm font-semibold sm:mt-8 tracking-wide text-muted uppercase">
        Pick an aircraft
      </h2>
      <ul className="mt-3 grid max-w-5xl gap-3 sm:mt-4 sm:gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/plan/${card.id}`}
              className="group flex h-full flex-col rounded-lg border border-line bg-panel p-4 shadow-sm transition sm:p-5 hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xl font-semibold">{card.name}</h3>
                <span className="text-sm text-muted">{card.id}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 text-sm">
                <div>
                  <dt className="text-muted">Seats</dt>
                  <dd className="text-lg font-medium tabular-nums">{card.seats}</dd>
                </div>
                <div>
                  <dt className="text-muted">Turn time</dt>
                  <dd className="text-lg font-medium tabular-nums">
                    {card.result ? `${card.result.turnMinutes} min` : "—"}
                  </dd>
                  <dd className="text-xs text-muted">
                    {card.twoDoor ? "two doors" : "one door"}, no refuelling with passengers
                  </dd>
                </div>
              </dl>
              {card.result && (
                <div className="mt-3 sm:mt-4">
                  <TurnPreview result={card.result} />
                </div>
              )}
              <span className="mt-3 text-sm font-semibold text-accent-text sm:mt-4 group-hover:underline">
                Start planning →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
