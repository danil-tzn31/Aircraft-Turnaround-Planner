import Link from "next/link";
import { defaultToggles } from "@/lib/defaults";
import TurnPreview from "@/components/TurnPreview";
import { PAGE_CONTAINER } from "@/lib/layout";
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

  // The hero shows the A320's default turn as a larger preview.
  const hero = cards.find((c) => c.id === "A320");

  return (
    <main className={`${PAGE_CONTAINER} py-6 sm:py-12`}>
      <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 xl:gap-16">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Aircraft Turnaround Planner</h1>
          <p className="mt-1.5 max-w-2xl text-lg text-ink sm:mt-2 sm:text-xl">
            See how delays move an aircraft&apos;s departure, using critical path scheduling.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:mt-3 sm:text-base">
            A turnaround is everything that happens between an aircraft parking at the gate and pushing
            back again: passengers off, cleaning, catering, fuel, bags, and passengers on.
          </p>
        </div>
        {hero?.result && (
          <figure className="hidden rounded-lg border border-line bg-panel p-5 shadow-sm lg:block">
            <TurnPreview result={hero.result} className="h-40 xl:h-44" />
            <figcaption className="mt-3 text-sm text-muted">
              {hero.id} · {hero.result.turnMinutes} min turn · critical path in yellow
            </figcaption>
          </figure>
        )}
      </div>

      <h2 className="mt-6 text-sm font-semibold sm:mt-8 lg:mt-10 tracking-wide text-muted uppercase">
        Pick an aircraft
      </h2>
      <ul className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/plan/${card.id}`}
              className="group flex h-full flex-col rounded-lg border border-line bg-panel p-4 shadow-sm outline-none transition sm:p-5 hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                <div className="mt-auto pt-3 sm:pt-4">
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
