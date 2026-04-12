"use client";

/**
 * components/cursos/CursoCard.tsx
 * ────────────────────────────────
 * Card premium para exibição de um Curso no catálogo.
 *
 * Exibe:
 *  - Imagem de capa (R2) ou gradiente de fallback
 *  - Código oficial + badge de tipo (Centralizado/Descentralizado)
 *  - Título
 *  - Badge de status geral com cor semântica
 *  - Turmas: carga horária somada, período (1ª data_inicio → última data_fim)
 *  - Número de vagas totais
 */

import Image from "next/image";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { Curso, StatusTurma } from "@/types/cursos";

// ─── Mapeamento de status → aparência ────────────────────────────────────────

const STATUS_META: Record<
  StatusTurma,
  { label: string; dot: string; bg: string; text: string }
> = {
  EM_ANDAMENTO: {
    label: "Em Andamento",
    dot:  "bg-emerald-400",
    bg:   "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
  },
  PREVISTA: {
    label: "Prevista",
    dot:  "bg-sky-400",
    bg:   "bg-sky-500/10 border-sky-500/20",
    text: "text-sky-400",
  },
  CONCLUIDA: {
    label: "Concluída",
    dot:  "bg-zinc-400",
    bg:   "bg-zinc-500/10 border-zinc-500/20",
    text: "text-zinc-400",
  },
  FINALIZADA: {
    label: "Finalizada",
    dot:  "bg-slate-400",
    bg:   "bg-slate-500/10 border-slate-500/20",
    text: "text-slate-400",
  },
  ADIADA: {
    label: "Adiada",
    dot:  "bg-amber-400",
    bg:   "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-400",
  },
  CANCELADA: {
    label: "Cancelada",
    dot:  "bg-red-400",
    bg:   "bg-red-500/10 border-red-500/20",
    text: "text-red-400",
  },
  SEM_TURMAS: {
    label: "Sem Turmas",
    dot:  "bg-zinc-600",
    bg:   "bg-zinc-700/20 border-zinc-700/30",
    text: "text-zinc-500",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Componente ────────────────────────────────────────────────────────────────

interface CursoCardProps {
  curso: Curso;
  imagemUrl?: string | null;
}

export default function CursoCard({ curso, imagemUrl }: CursoCardProps) {
  const meta = STATUS_META[curso.status_geral] ?? STATUS_META.SEM_TURMAS;

  // Período: menor data_inicio → maior data_fim entre todas as turmas
  const datas = curso.turmas.map((t) => ({
    inicio: t.data_inicio,
    fim:    t.data_fim,
  }));
  const periodoInicio = datas.length
    ? datas.reduce((a, b) => (a.inicio < b.inicio ? a : b)).inicio
    : null;
  const periodoFim = datas.length
    ? datas.reduce((a, b) => (a.fim > b.fim ? a : b)).fim
    : null;

  // Carga horária: soma das turmas (turmas distintas podem ter CH diferente)
  const cargaTotal = curso.turmas.reduce((acc, t) => acc + t.carga_horaria, 0);

  // Total de vagas
  const vagasTotal = curso.turmas.reduce((acc, t) => acc + t.vagas, 0);

  return (
    <article
      className="
        group relative flex flex-col rounded-2xl overflow-hidden
        bg-[var(--surface)] border border-white/[0.06]
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        hover:border-secondary/30 hover:shadow-[0_12px_40px_rgba(0,145,159,0.12)]
        transition-all duration-300 ease-out
        hover:-translate-y-1
      "
    >
      {/* ── Imagem de capa ───────────────────────────────────────────────────── */}
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-primary/40 to-secondary/20 flex-shrink-0">
        {imagemUrl ? (
          <Image
            src={imagemUrl}
            alt={`Capa do curso ${curso.titulo}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          // Fallback artístico com código e gradiente
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2
                          bg-gradient-to-br from-primary/60 via-primary/30 to-secondary/20">
            <span className="text-4xl font-black text-white/10 select-none tracking-tighter">
              EGPC
            </span>
            <span className="text-xs font-mono text-white/20 tracking-widest">
              {curso.codigo_oficial}
            </span>
          </div>
        )}

        {/* Overlay gradiente inferior */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--surface)] to-transparent" />

        {/* Badge de tipo */}
        <div className="absolute top-3 left-3">
          <span className="
            inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold
            uppercase tracking-wider bg-black/50 backdrop-blur-sm text-zinc-300 border border-white/10
          ">
            {curso.tipo === "CENTRALIZADO" ? "Centralizado" : "Descentralizado"}
          </span>
        </div>
      </div>

      {/* ── Corpo ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5 gap-3">

        {/* Código + Status */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-semibold text-secondary/80 tracking-wider">
            {curso.codigo_oficial}
          </span>
          <span
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[11px] font-semibold border
              ${meta.bg} ${meta.text}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} animate-pulse`} />
            {meta.label}
          </span>
        </div>

        {/* Título */}
        <h3 className="text-[15px] font-bold text-zinc-100 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {curso.titulo}
        </h3>

        {/* Ementa (preview) */}
        <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2 flex-1">
          {curso.ementa}
        </p>

        {/* ── Metadados ────────────────────────────────────────────────────── */}
        <div className="pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-y-2 gap-x-3">

          {/* Período */}
          {periodoInicio && periodoFim && (
            <div className="col-span-2 flex items-center gap-2 text-[11px] text-zinc-500">
              <Calendar className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />
              <span>
                {formatDate(periodoInicio)}{" "}
                <span className="text-zinc-600 mx-0.5">→</span>{" "}
                {formatDate(periodoFim)}
              </span>
            </div>
          )}

          {/* Carga horária */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Clock className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />
            <span>
              {cargaTotal > 0 ? (
                <><strong className="text-zinc-300">{cargaTotal}h</strong> carga horária</>
              ) : (
                "—"
              )}
            </span>
          </div>

          {/* Vagas */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Users className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />
            <span>
              {vagasTotal > 0 ? (
                <><strong className="text-zinc-300">{vagasTotal}</strong> vaga{vagasTotal !== 1 ? "s" : ""}</>
              ) : (
                "—"
              )}
            </span>
          </div>

          {/* Turmas */}
          {curso.turmas.length > 0 && (
            <div className="col-span-2 flex items-center gap-2 text-[11px] text-zinc-500">
              <MapPin className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />
              <span>
                {curso.turmas.length} turma{curso.turmas.length !== 1 ? "s" : ""}
                {" "}
                <span className="text-zinc-600">
                  ({curso.turmas.map((t) => t.letra).join(", ")})
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
