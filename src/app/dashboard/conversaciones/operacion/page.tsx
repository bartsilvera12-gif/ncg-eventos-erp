export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ConversacionesOperacionRedirectPage() {
  redirect("/dashboard/monitoreo");
}