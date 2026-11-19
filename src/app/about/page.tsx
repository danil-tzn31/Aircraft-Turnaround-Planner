import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

const sections = [
  {
    heading: "What’s a turnaround?",
    body: "Everything that happens between a plane parking at the gate and pushing back again: passengers off, cleaning, catering, fuel, bags, and passengers on. Some tasks run at the same time; others have to wait.",
  },
  {
    heading: "What’s the critical path?",
    body: "The chain of tasks with no spare time. If anything on it runs late, departure does too. The planner shows it in yellow.",
  },
  {
    heading: "How to use it",
    body: "Pick an aircraft and try a delay: late catering, a late inbound flight, or boarding through one door. The line at the top tells you whether the plane still leaves on time. Save a scenario to share it by link.",
  },
  {
    heading: "Where the numbers come from",
    body: "Airbus timings come from Airbus’s airport planning documents (section 5-2), with their boarding rates applied to Cebu Pacific’s seat counts. Cleaning times and all ATR 72-600 timings are estimates.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About</h1>
      <div className="mt-10 max-w-2xl space-y-10">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            <p className="mt-3 text-ink">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-16 max-w-2xl text-sm text-muted">
        Durations are approximate, based on public manufacturer planning documents. Not for
        operational use.
      </p>
    </main>
  );
}
