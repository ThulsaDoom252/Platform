export function RouteLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-5" role="status" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-xl bg-surface-2" />
      <div className="h-4 w-80 max-w-full rounded-lg bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
