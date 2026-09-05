import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ children, search, onSearch }: { children: React.ReactNode; search?: string; onSearch?: (value: string) => void }) {
  return (
    <div className="flex bg-slate-950 text-white min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <Header search={search} onSearch={onSearch} />
        {children}
      </main>
    </div>
  );
}
