import type { Certificado, CategoriaCertificado } from "./types";

async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...(init ?? {}),
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) {
      console.error(`[certificados] ${url}:`, (j as { error?: string })?.error ?? r.status);
      return null;
    }
    return j.data as T;
  } catch (e) {
    console.error(`[certificados] ${url}:`, e);
    return null;
  }
}

export async function getCertificados(): Promise<Certificado[]> {
  const d = await apiJson<{ certificados?: Certificado[] }>("/api/certificados");
  return d?.certificados ?? [];
}

export async function saveCertificado(
  input: Partial<Certificado> & { nombre: string; categoria: CategoriaCertificado }
): Promise<Certificado | null> {
  const d = await apiJson<{ certificado?: Certificado }>("/api/certificados", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return d?.certificado ?? null;
}

export async function updateCertificado(
  id: string,
  patch: Partial<Certificado>
): Promise<Certificado | null> {
  const d = await apiJson<{ certificado?: Certificado }>(`/api/certificados/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return d?.certificado ?? null;
}

export async function deleteCertificado(id: string): Promise<boolean> {
  const d = await apiJson<{ ok?: boolean }>(`/api/certificados/${id}`, { method: "DELETE" });
  return Boolean(d?.ok);
}
