type DashboardCardProps = {
  title: string;
  value: string | number;
  description: string;
};

export function DashboardCard({ title, value, description }: DashboardCardProps) {
  return (
    <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-blue-800">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </article>
  );
}
