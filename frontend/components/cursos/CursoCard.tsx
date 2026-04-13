"use client";

import Image from "next/image";
import { Curso } from "@/types/cursos";
import { Clock, MonitorPlay, ArrowRight } from "lucide-react";

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
      <div className="relative h-44 bg-slate-100 w-full flex-shrink-0 border-b border-slate-200">
        {imagemUrl ? (
          <Image src={imagemUrl} alt={curso.titulo} fill className="object-cover opacity-90 group-hover:opacity-100 transition-transform duration-500 group-hover:scale-105" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200 group-hover:bg-slate-200 transition-colors">
            <MonitorPlay className="w-10 h-10 opacity-40 mb-2 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="text-[12px] font-black uppercase tracking-widest opacity-50 text-indigo-900">{curso.codigo_oficial || "EGPC"}</span>
          </div>
        )}
        
        {/* Badge Tipo do Curso */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 text-[10px] font-black text-slate-700 uppercase tracking-wider">
          {curso.tipo === "CENTRALIZADO" ? "Centralizado" : "Descentralizado"}
        </div>
      </div>

      {/* ── Informações Básicas ── */}
      <div className="p-6 flex-1 flex flex-col bg-white">
        <h3 className="text-[17px] font-extrabold text-slate-800 leading-snug line-clamp-2" title={curso.titulo}>
          {curso.titulo}
        </h3>
        
        <p className="text-[14px] font-medium text-slate-500 mt-2 line-clamp-2 flex-1 leading-relaxed">
          {curso.ementa || "Nenhuma ementa informada para a grade deste curso."}
        </p>

        <div className="flex items-center justify-between mt-5 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-[13px] font-bold text-slate-700">{cargaHorariaBase > 0 ? `${cargaHorariaBase}h` : "--"}</span>
          </div>

          <span className={`text-[12px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${temTurmas ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
             {temTurmas ? `${curso.turmas?.length} Turma(s)` : "Esgotado"}
          </span>
        </div>
      </div>

      {/* ── Botão Rodapé Inteiro ── */}
      <div className="w-full p-4 flex items-center justify-center transition-colors bg-slate-50 border-t border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-200 text-indigo-600">
        <span className="text-[14px] font-bold flex items-center gap-2">
          Ver Detalhes <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>

    </div>
  );
}