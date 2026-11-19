import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-muted">We couldn&apos;t find that page or aircraft.</p>
      <Link href="/" className="mt-6 inline-block font-semibold text-accent-text hover:underline">
        ← Back to the home page
      </Link>
    </main>
  );
}
