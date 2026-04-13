"use client";

import { useState } from "react";
import Image from "next/image";
import { Curso } from "@/types/cursos";
import { 
  Clock, MapPin, MonitorPlay, Users, 
  CalendarDays, ChevronDown, CheckCircle2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CursoCardProps {
  curso: Curso;
  imagemUrl: string | null;
}

export default function CursoCard({ curso, imagemUrl }: CursoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const temTurmas = curso.turmas && curso.turmas.length > 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--";
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}`;
  };

  return (
    <div className="glass-card flex flex-col overflow-hidden transition-all duration-300 hover:border-white/10 group">
      
      {/* ── Capa do Curso ── */}
      <div className="relative h-40 bg-slate-800/50 w-full flex-shrink-0 border-b border-white/5">
        {imagemUrl ? (
          <Image src={imagemUrl} alt={curso.titulo} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 bg-gradient-to-br from-[#0f172a] to-[#020617]">
            <MonitorPlay className="w-8 h-8 opacity-50 mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">EGPC</span>
          </div>
        )}
        
        {/* Badge Categoria */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-200 uppercase tracking-wider">
          {curso.categoria_nome || "Geral"}
        </div>
      </div>

      {/* ── Informações Básicas ── */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-[16px] font-bold text-slate-100 leading-snug line-clamp-2" title={curso.titulo}>
          {curso.titulo}
        </h3>
        
        <p className="text-[13px] text-slate-400 mt-2 line-clamp-2 flex-1">
          {curso.descricao || "Nenhuma descrição informada para este curso."}
        </p>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="text-[12px] font-medium">{curso.carga_horaria}h</span>
          </div>
        </div>
      </div>

      {/* ── Botão Expansor ── */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={!temTurmas}
        className={cn(
          "w-full p-4 border-t flex items-center justify-between transition-colors",
          isExpanded ? "bg-white/5 border-white/10" : "bg-transparent border-white/5",
          temTurmas ? "hover:bg-white/5 cursor-pointer" : "cursor-not-allowed opacity-50"
        )}
      >
        <span className="text-[13px] font-semibold text-slate-300">
          {temTurmas ? `${curso.turmas?.length} Turma(s) Aberta(s)` : "Sem turmas no momento"}
        </span>
        {temTurmas && (
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", isExpanded && "rotate-180")} />
        )}
      </button>

      {/* ── Lista de Turmas (Acordeão) ── */}
      <AnimatePresence>
        {isExpanded && temTurmas && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#09090b] border-t border-white/5"
          >
            <div className="p-3 space-y-3">
              {curso.turmas?.map((turma) => (
                <div key={turma.id} className="p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[12px] font-bold text-slate-200">Turma {turma.codigo}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                      turma.modalidade === "EAD" ? "bg-blue-500/20 text-blue-400" : 
                      turma.modalidade === "HIBRIDO" ? "bg-purple-500/20 text-purple-400" : "bg-emerald-500/20 text-emerald-400"
                    )}>
                      {turma.modalidade}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{formatDate(turma.data_inicio)} até {formatDate(turma.data_fim)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{turma.hora_inicio?.slice(0,5) || '--'} às {turma.hora_fim?.slice(0,5) || '--'}</span>
                    </div>
                  </div>

                  {/* Barra de Vagas */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Vagas disponíveis</span>
                      <span className={cn("font-bold", turma.vagas_disponiveis < 5 ? "text-red-400" : "text-emerald-400")}>
                        {turma.vagas_disponiveis} / {turma.vagas_totais}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", turma.vagas_disponiveis < 5 ? "bg-red-500" : "bg-emerald-500")} 
                        style={{ width: `${(turma.vagas_disponiveis / turma.vagas_totais) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Botão de Matrícula (Visual por enquanto) */}
                  <button 
                    disabled={turma.vagas_disponiveis === 0}
                    className="w-full py-2 rounded-lg text-[13px] font-semibold bg-primary hover:bg-primary-light text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                  >
                    {turma.vagas_disponiveis === 0 ? "Turma Lotada" : "Solicitar Matrícula"}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}