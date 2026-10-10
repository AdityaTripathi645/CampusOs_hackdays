export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-32 rounded bg-ink-100" />
      <div className="mt-3 h-7 w-72 rounded-lg bg-ink-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-2xl border border-line bg-white" />
    </div>
  );
}
