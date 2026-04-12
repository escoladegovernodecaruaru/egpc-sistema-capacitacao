"use client";

/**
 * components/cursos/CursoCardSkeleton.tsx
 * ─────────────────────────────────────────
 * Placeholder animado exibido durante o carregamento do catálogo.
 */

export default function CursoCardSkeleton() {
  return (
    <div className="
      flex flex-col rounded-2xl overflow-hidden
      bg-[var(--surface)] border border-white/[0.06]
      shadow-[0_8px_32px_rgba(0,0,0,0.4)]
      animate-pulse
    ">
      {/* Imagem skeleton */}
      <div className="h-44 w-full bg-white/[0.04]" />

      <div className="flex flex-col gap-3 p-5">
        {/* Código + badge */}
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-white/[0.06] rounded-full" />
          <div className="h-5 w-24 bg-white/[0.06] rounded-full" />
        </div>

        {/* Título */}
        <div className="space-y-1.5">
          <div className="h-4 w-full bg-white/[0.06] rounded-full" />
          <div className="h-4 w-3/4  bg-white/[0.05] rounded-full" />
        </div>

        {/* Ementa */}
        <div className="space-y-1.5 mt-1">
          <div className="h-3 w-full bg-white/[0.04] rounded-full" />
          <div className="h-3 w-5/6  bg-white/[0.04] rounded-full" />
        </div>

        {/* Metadados */}
        <div className="pt-3 border-t border-white/[0.05] space-y-2">
          <div className="h-3 w-2/3 bg-white/[0.04] rounded-full" />
          <div className="h-3 w-1/2 bg-white/[0.04] rounded-full" />
        </div>
      </div>
    </div>
  );
}
