"use client";

/**
 * app/(dashboard)/dashboard/cursos/page.tsx
 * ──────────────────────────────────────────
 * Catálogo de Cursos do Portal EGPC.
 *
 * - Consome GET /api/cursos/ via fetchApi (endpoint público — requireAuth: false)
 * - Grid responsivo: 1 col (mobile) → 2 col (md) → 3 col (lg)
 * - Filtro por status geral
 * - Skeleton durante carregamento
 * - Estado vazio e erro tratados
 */

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Filter, RefreshCcw, SearchX } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Curso, StatusTurma } from "@/types/cursos";
import CursoCard from "@/components/cursos/CursoCard";
import CursoCardSkeleton from "@/components/cursos/CursoCardSkeleton";

// ─── Opções de filtro de status ───────────────────────────────────────────────

const FILTROS: { value: StatusTurma | "TODOS"; label: string }[] = [
  { value: "TODOS",       label: "Todos" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "PREVISTA",     label: "Prevista" },
  { value: "CONCLUIDA",    label: "Concluída" },
  { value: "ADIADA",       label: "Adiada" },
  { value: "CANCELADA",    label: "Cancelada" },
  { value: "SEM_TURMAS",   label: "Sem Turmas" },
];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CursosPage() {
  const [cursos,    setCursos]    = useState<Curso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro,      setErro]      = useState<string | null>(null);
  const [filtro,    setFiltro]    = useState<StatusTurma | "TODOS">("TODOS");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const carregarCursos = async () => {
    setIsLoading(true);
    setErro(null);
    try {
      // Endpoint público → não exige JWT
      const data = await fetchApi<Curso[]>("/cursos/", { requireAuth: false });
      setCursos(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Erro ao carregar os cursos.";
      setErro(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarCursos();
  }, []);

  // ── Filtro local ───────────────────────────────────────────────────────────
  const cursosFiltrados = useMemo(() => {
    if (filtro === "TODOS") return cursos;
    return cursos.filter((c) => c.status_geral === filtro);
  }, [cursos, filtro]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-7 animate-[fade-in_0.4s_ease-out]">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-secondary/10 border border-secondary/20
                          flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Catálogo de Cursos</h1>
            <p className="text-[12px] text-zinc-600 mt-0.5">
              {isLoading
                ? "Carregando…"
                : `${cursos.length} curso${cursos.length !== 1 ? "s" : ""} disponíve${cursos.length !== 1 ? "is" : "l"}`}
            </p>
          </div>
        </div>

        {/* Botão atualizar */}
        <button
          onClick={carregarCursos}
          disabled={isLoading}
          title="Recarregar cursos"
          className="
            flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium
            text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-300
            transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* ── Filtros de Status ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`
              px-3.5 py-1.5 rounded-full text-[12px] font-medium border
              transition-all duration-150
              ${filtro === f.value
                ? "bg-secondary/15 border-secondary/30 text-secondary"
                : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]"
              }
            `}
          >
            {f.label}
            {filtro !== "TODOS" && f.value === filtro && cursosFiltrados.length > 0 && (
              <span className="ml-1.5 text-[10px] opacity-70">({cursosFiltrados.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Estado de Erro ──────────────────────────────────────────────────── */}
      {erro && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20
                          flex items-center justify-center">
            <SearchX className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-zinc-300">Falha ao carregar</p>
            <p className="text-[12px] text-zinc-600 mt-1">{erro}</p>
          </div>
          <button onClick={carregarCursos} className="btn-primary w-auto px-6 py-2.5 text-sm mt-2">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Grid de Skeletons ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <CursoCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Estado Vazio ────────────────────────────────────────────────────── */}
      {!isLoading && !erro && cursosFiltrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary/10 border border-secondary/20
                          flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-secondary/50" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-zinc-400">
              {filtro === "TODOS"
                ? "Nenhum curso cadastrado ainda."
                : `Nenhum curso com status "${FILTROS.find((f) => f.value === filtro)?.label}".`}
            </p>
            {filtro !== "TODOS" && (
              <button
                onClick={() => setFiltro("TODOS")}
                className="mt-3 text-[12px] text-secondary hover:text-secondary-light
                           underline underline-offset-2 transition-colors"
              >
                Ver todos os cursos
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Grid de Cards ───────────────────────────────────────────────────── */}
      {!isLoading && !erro && cursosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cursosFiltrados.map((curso) => (
            <CursoCard
              key={curso.id}
              curso={curso}
              // imagem_capa não está no serializer ainda; passamos null por ora
              imagemUrl={null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
