export function TestsLibrarySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="h-36 animate-pulse rounded-3xl border border-line bg-surface-2 motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-line bg-surface-2 motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}
