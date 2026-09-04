type Props = {
  title: string;
  value: string;
};

export default function StatCard({ title, value }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <h3 className="text-3xl font-bold mt-3 text-emerald-400">
        {value}
      </h3>
    </div>
  );
}