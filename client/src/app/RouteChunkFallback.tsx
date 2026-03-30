export function RouteChunkFallback() {
  return (
    <main className="px-4 py-6 lg:px-8">
      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Loading</p>
        <p className="mt-3 text-sm leading-6 text-slate-400">Preparing the route workspace.</p>
      </section>
    </main>
  );
}
