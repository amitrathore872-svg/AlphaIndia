import { redirect } from "next/navigation";

// Alpha India System Settings — redirects to Mission Control Settings & Operations
export default function SettingsRedirectPage() {
  redirect("/monitoring/control");
}
