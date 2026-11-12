export function Badge({ children, color = "warning" }: { children: React.ReactNode; color?: "warning" | "error" | "success" }) {
  const c = { warning: "bg-warning-50 text-warning-700", error: "bg-error-50 text-error-700", success: "bg-success-50 text-success-700" }[color];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}
