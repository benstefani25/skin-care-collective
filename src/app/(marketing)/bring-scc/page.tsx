import { redirect } from "next/navigation";

// Canonical URL is now /request-house (A-2/A-3). Keep this redirect so any
// existing links or bookmarks don't 404.
export default function BringSccRedirect() {
  redirect("/request-house");
}
