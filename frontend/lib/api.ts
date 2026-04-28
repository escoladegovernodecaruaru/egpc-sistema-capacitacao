import { supabase } from "./supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ApiError {
  status:   number;
  message:  string;
  errors?:  Record<string, string[]>;
  raw?:     unknown;
}

type FetchOptions = Omit<RequestInit, "body"> & {
  requireAuth?: boolean;
  /**
   * Se true, o `body` deve ser um `FormData`.
   * O header Content-Type NÃO será definido automaticamente para que
   * o browser possa injetar o multipart boundary correto.
   */
  isFormData?: boolean;
  /** Header Authorization manual (sobrescreve o token da sessão Supabase). */
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

/**
 * Utilitário centralizado para chamadas ao Backend Django.
 *
 * - Se `requireAuth = true` (padrão), busca o JWT da sessão Supabase
 *   e o injeta em `Authorization: Bearer <token>`.
 * - Se `isFormData = true`, omite o header `Content-Type` para que o browser
 *   defina o boundary correto do multipart automaticamente.
 * - Normaliza erros do DRF para o tipo `ApiError`.
 */
export async function fetchApi<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { requireAuth = true, isFormData = false, headers, body, ...restOptions } = options;

  // Monta headers base — sem Content-Type para FormData
  const requestHeaders: Record<string, string> = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {} as Record<string, string>),
    ...(headers as Record<string, string> | undefined),
  };

  // Injeta JWT da sessão Supabase (ou usa o que veio nos headers manuais)
  if (requireAuth && !requestHeaders["Authorization"]) {
    const { data } = await supabase.auth.getSession();
    const token    = data?.session?.access_token;
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    headers: requestHeaders,
    body,
  });

  // Tenta deserializar o body (respostas 204 não têm body)
  let result: unknown = null;
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    // Token expirado → força logout e redireciona para login
    if (response.status === 401) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    const body = result as Record<string, unknown> | null;
    const err: ApiError = {
      status:  response.status,
      message:
        (body?.detail  as string) ||
        (body?.message as string) ||
        `Erro ${response.status}: Falha na requisição.`,
      errors: (body?.errors as Record<string, string[]>) || undefined,
      raw:    result,
    };
    throw err;
  }

  return result as T;
}
