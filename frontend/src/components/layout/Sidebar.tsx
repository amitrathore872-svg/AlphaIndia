import { BarChart3, Building2, Bell, Star, Settings } from 'lucide-react';

const menu = [
  { name: 'Growth Screener', icon: BarChart3 },
  { name: 'Quarterly Results', icon: Building2 },
  { name: 'Watchlist', icon: Star },
  { name: 'Alerts', icon: Bell },
  { name: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-950 border-r border-slate-800 p-6">
      <h1 className="text-2xl font-bold text-emerald-400 mb-8">Alpha India</h1>

      <nav className="space-y-2">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white transition"
            >
              <Icon size={20} />
              {item.name}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}