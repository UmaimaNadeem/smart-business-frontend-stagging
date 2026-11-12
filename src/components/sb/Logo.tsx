export default function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">SB</span>
      {!compact && <span className={`text-lg font-semibold ${light ? "text-white" : "text-gray-800 dark:text-white"}`}>Smart Business</span>}
    </span>
  );
}
