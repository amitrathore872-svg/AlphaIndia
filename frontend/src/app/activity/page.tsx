import { redirect } from "next/navigation";

// Alpha India Activity Timeline — redirects to the unified Mission Control Timeline
export default function ActivityRedirectPage() {
  redirect("/monitoring");
}
