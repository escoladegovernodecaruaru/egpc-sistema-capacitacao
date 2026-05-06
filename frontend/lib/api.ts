const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface ApiError {
  status:   number;
  message:  string;
  errors?:  Record<string, string[]>;
  raw?:     unknown;
}

type FetchOptions = Omit<RequestInit, "body"> & {
  requireAuth?: boolean;
  isFormData?: boolean;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { requireAuth = true, isFormData = false, headers, body, ...restOptions } = options;

  const requestHeaders: Record<string, string> = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  // ── INJEÇÃO DO TOKEN JWT DO DJANGO ──
  if (requireAuth && !requestHeaders["Authorization"]) {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("egpc_access_token");
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    headers: requestHeaders,
    body,
  });

  let result: unknown = null;
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // Token expirado: limpa o storage e manda pro login
      localStorage.removeItem("egpc_access_token");
      localStorage.removeItem("egpc_refresh_token");
      window.location.href = "/login";
    }

    const body = result as Record<string, unknown> | null;
    const err: ApiError = {
      status:  response.status,
      message: (body?.detail as string) || (body?.message as string) || `Erro ${response.status}: Falha na requisição.`,
      errors: (body?.errors as Record<string, string[]>) || undefined,
      raw:    result,
    };
    throw err;
  }

  return result as T;
}