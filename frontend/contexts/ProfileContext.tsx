"use client";

/**
 * ProfileContext — estado global do perfil do usuário autenticado.
 *
 * Motivo de existir:
 *   Múltiplos componentes (Sidebar, página de Perfil, Header) precisam dos dados
 *   do perfil. Sem contexto, cada um fazia sua própria chamada /auth/me/ e ficavam
 *   dessincronizados após mudanças (ex: nova foto de perfil).
 *
 * Uso:
 *   - Envolva o DashboardLayout com <ProfileProvider>.
 *   - Em qualquer componente filho, chame `useProfile()` para acessar:
 *       { profile, isLoading, refreshProfile }
 *   - Após uma mutação (upload de foto, PATCH de dados), chame `refreshProfile()`
 *     para forçar um novo fetch e propagar a mudança para toda a árvore.
 */

import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from "react";
import { fetchApi, type ApiError } from "@/lib/api";

// ─── Tipagem ─────────────────────────────────────────────────────────────────

export interface Profile {
  id:                       string;
  cpf:                      string;
  nome_completo:            string;
  nome_social:              string | null;
  email:                    string;
  telefone:                 string | null;
  tipo_usuario:             string;
  tipo_usuario_display:     string;
  secretaria:               string | null;
  matricula:                string | null;
  empresa:                  string | null;
  cpf_chefe:                string | null;
  foto_perfil_url:          string | null;
  esta_de_licenca:          boolean;
  bloqueado_ate:            string | null;
  data_ultima_confirmacao:  string;
  esta_bloqueado:           boolean;
  is_active:                boolean;
  is_staff:                 boolean;
  is_solicitante:           boolean;
  is_instrutor:             boolean;
  criado_em:                string;
}

interface ProfileContextValue {
  profile:         Profile | null;
  isLoading:       boolean;
  error:           string | null;
  /** Busca novamente /auth/me/ e atualiza o estado em todos os consumidores. */
  refreshProfile:  () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue>({
  profile:        null,
  isLoading:      true,
  error:          null,
  refreshProfile: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Profile>("/users/auth/me/");
      setProfile(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Erro ao carregar perfil.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Busca inicial ao montar o provider (uma vez por sessão de navegação no dashboard)
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, refreshProfile: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
