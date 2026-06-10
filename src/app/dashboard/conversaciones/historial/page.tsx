export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ConversacionesHistorialRedirectPage() {
  redirect("/dashboard/historial-omnicanal");
}