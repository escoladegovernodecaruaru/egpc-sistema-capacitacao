"use client";

import Image from "next/image";
import { Curso } from "@/types/cursos";
import { Clock, MonitorPlay, ArrowRight, GraduationCap } from "lucide-react";

interface CursoCardProps {
  curso: Curso;
  imagemUrl: string | null;
  onSelecionar: (curso: Curso) => void;
}

export default function CursoCard({ curso, imagemUrl, onSelecionar }: CursoCardProps) {
  const temTurmas = curso.turmas && curso.turmas.length > 0;
  
  const cargaHorariaBase = temTurmas ? curso.turmas![0].carga_horaria : 0;

  return (
    <div className="clean-card flex flex-col overflow-hidden transition-all duration-300 hover:border-indigo-300 hover:shadow-md group h-full cursor-pointer" onClick={() => onSelecionar(curso)}>
      
      {/* ── Capa do Curso ── */}
      <div className="relative h-28 bg-slate-100 w-full flex-shrink-0 border-b border-slate-200">
        {imagemUrl ? (
          <Image src={imagemUrl} alt={curso.titulo} fill className="object-cover opacity-90 group-hover:opacity-100 transition-transform duration-500 group-hover:scale-105" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200 group-hover:bg-slate-200 transition-colors">
            <MonitorPlay className="w-8 h-8 opacity-40 mb-2 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="text-[12px] font-black uppercase tracking-widest opacity-50 text-indigo-900">{curso.codigo_oficial || "EGPC"}</span>
          </div>
        )}
        
        {/* Badge Tipo do Curso */}
        <div className="absolute top-4 left-4 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 text-[9px] font-black text-slate-700 uppercase tracking-widest">
          {curso.tipo === "CENTRALIZADO" ? "Centralizado" : "Descentralizado"}
        </div>
      </div>

      {/* ── Informações Básicas ── */}
      <div className="p-5 flex-1 flex flex-col bg-white">
        <h3 className="text-base font-extrabold text-slate-800 leading-snug line-clamp-2" title={curso.titulo}>
          {curso.titulo}
        </h3>
        
        <div className="mt-3 flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Área de Formação</p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[12px] truncate max-w-full">
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">{curso.eixo ? curso.eixo.replace(/_/g, ' ') : "Geral"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-[13px] font-bold text-slate-700">{cargaHorariaBase > 0 ? `${cargaHorariaBase}h` : "--"}</span>
          </div>

          <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-wider ${temTurmas ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
             {temTurmas ? `${curso.turmas?.length} Turma(s)` : "Esgotado"}
          </span>
        </div>
      </div>

      {/* ── Botão Rodapé Inteiro ── */}
      <div className="py-3 w-full flex items-center justify-center border-t border-slate-100 text-[13px] font-bold text-indigo-600 bg-transparent group-hover:bg-indigo-50/50 transition-colors">
        <span className="flex items-center gap-2">
          Ver Detalhes <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>

    </div>
  );
}
