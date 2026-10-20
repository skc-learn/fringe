import { useQuery } from '@tanstack/react-query';

async function fetchStats() {
  const res = await fetch('/api/stats');
  return res.json();
}

export default function Landing() {
  const { data, isError } = useQuery({ queryKey: ['stats'], queryFn: fetchStats });

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4">
        <img src="/logo.svg" alt="Fringe logo" className="h-8 w-8" />
        <a href="/pricing" className="text-sm font-medium">Pricing</a>
      </nav>

      <section className="bg-gradient-to-r from-violet-600 to-[#a78bfa] px-6 py-20 text-center">
        <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm font-medium uppercase tracking-widest text-white">
          Introducing Fringe 2.0
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold italic font-serif text-white">
          Frictionless UI reviews, at the speed of thought
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] text-white/80">
          Fringe reads every component you ship and flags the patterns that quietly erode
          trust — automatically, on every pull request.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button className="rounded-full bg-[#111827] px-6 py-3 text-sm font-semibold text-white">Start free</button>
          <a href="#how" className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white">See how it works</a>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-2 px-6 py-8">
        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium">SOC 2 Type II</span>
        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium">99.9% uptime</span>
        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium">GDPR ready</span>
        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium">SSO included</span>
        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium">AES-256 at rest</span>
      </div>

      <section id="how" className="mx-auto max-w-5xl px-6 py-16">
        <span className="text-xs font-semibold uppercase tracking-widest">01 Discover</span>
        <h2 className="mt-2 text-2xl font-semibold">How Fringe works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold">Scan</h3>
            <p className="text-sm">Point Fringe at your repository and it maps every component in seconds.</p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold">Prioritize</h3>
            <p className="text-sm">Findings arrive sorted by impact, so the worst offenders surface first.</p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold">Fix</h3>
            <p className="text-sm">Every flag ships with a hint, so fixes land in the same pull request.</p>
          </div>
        </div>
      </section>

      <section className="bg-[#f8fafc] px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold">🚀 Trusted by fast-moving teams</h2>
        {isError ? (
          <p className="mt-4 text-sm">Something went wrong.</p>
        ) : (
          <p className="mt-4 text-sm">{data?.headline ?? 'Join 4,000+ teams shipping kinder UIs today.'}</p>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold">Everything in one dashboard</h2>
          <p className="mt-2 text-sm">Track adoption, drift, and review latency without leaving your terminal workflow.</p>
          <div className="mt-6 rounded-lg bg-[#eef2ff] p-4">
            <h3 className="text-sm font-semibold">Live activity</h3>
            <div className="mt-3 flex items-center gap-[9px] p-[13px]">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              <p className="text-xs">Fringe checked 128 components across 12 repos today.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 py-12 text-center">
        <a href="/docs" className="text-xs underline">Read the full documentation</a>
        <p className="muted mt-4 text-xs">© 2026 Fringe Labs, Inc.</p>
      </footer>
    </main>
  );
}
