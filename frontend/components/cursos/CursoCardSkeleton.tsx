"use client";

/**
 * components/cursos/CursoCardSkeleton.tsx
 * ─────────────────────────────────────────
 * Placeholder animado exibido durante o carregamento do catálogo.
 */

export default function CursoCardSkeleton() {
  return (
    <div className="clean-card flex flex-col animate-pulse">
      {/* Imagem skeleton */}
      <div className="h-44 w-full bg-slate-100" />

      <div className="flex flex-col gap-4 p-6">
        {/* Título */}
        <div className="space-y-2.5">
          <div className="h-5 w-full bg-slate-200 rounded-full" />
          <div className="h-5 w-3/4  bg-slate-200 rounded-full" />
        </div>

        {/* Ementa */}
        <div className="space-y-2 mt-2">
          <div className="h-3 w-full bg-slate-100 rounded-full" />
          <div className="h-3 w-5/6  bg-slate-100 rounded-full" />
        </div>

        {/* Metadados */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="h-4 w-2/3 bg-slate-100 rounded-full" />
          <div className="h-4 w-1/2 bg-slate-100 rounded-full" />
        </div>
      </div>
    </div>
  );
}
