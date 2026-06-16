import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Página movida. El editor del catálogo vive ahora en
 * /configuracion/empleados como pestaña "Tipos de empleado",
 * junto a Departamentos y otros catálogos del módulo.
 */
export default function TiposEmpleadoLegacyRedirect() {
  redirect("/configuracion/empleados");
}
