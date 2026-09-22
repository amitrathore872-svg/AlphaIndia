import { redirect } from "next/navigation";

// =========================================================================
// Alpha India Root Redirect
// Landing Page has been designated as /home (Action-First Institutional Hub)
// =========================================================================

export default function RootPage() {
  redirect("/home");
}