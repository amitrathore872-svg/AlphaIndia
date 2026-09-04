import DashboardLayout from "@/components/layout/DashboardLayout";
import GrowthTable from "@/components/screener/GrowthTable";

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <GrowthTable />
      </div>
    </DashboardLayout>
  );
}
