import { redirect } from "next/navigation";

// Legacy /dashboard route — now redirects to the unified Mission Control hub at /monitoring
export default function DashboardPage() {
  redirect("/monitoring");
}