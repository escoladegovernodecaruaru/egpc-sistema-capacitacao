"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Filter, RefreshCcw, SearchX, ArrowLeft, Clock, CalendarDays, CheckCircle2, ChevronRight, GraduationCap, User } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Curso, StatusTurma } from "@/types/cursos";
import CursoCard from "@/components/cursos/CursoCard";
import CursoCardSkeleton from "@/components/cursos/CursoCardSkeleton";
import { motion, AnimatePresence } from "framer-motion";

// ─── FILTROS ───────────────────────────────────────────────────────────────
const FILTROS: { value: StatusTurma | "TODOS"; label: string }[] = [
  { value: "TODOS",       label: "Todos" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "PREVISTA",     label: "Prevista" },
  { value: "CONCLUIDA",    label: "Concluída" },
  { value: "ADIADA",       label: "Adiada" },
  { value: "CANCELADA",    label: "Cancelada" },
  { value: "SEM_TURMAS",   label: "Sem Turmas" },
];

export default function CursosPage() {
  const [cursos,    setCursos]    = useState<Curso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erro,      setErro]      = useState<string | null>(null);
  const [filtro,    setFiltro]    = useState<StatusTurma | "TODOS">("TODOS");

  // Novo Controle de View
  const [currentView, setCurrentView] = useState<'list' | 'detalhes'>('list');
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null);

  const carregarCursos = async () => {
    setIsLoading(true);
    setErro(null);
    try {
      const data = await fetchApi<Curso[]>("/cursos/", { requireAuth: false });
      setCursos(data);
      
      // Atualiza o curso selecionado em background se ele ainda estiver aberto
      if (cursoSelecionado) {
         const atualizado = data.find(c => c.id === cursoSelecionado.id);
         if (atualizado) setCursoSelecionado(atualizado);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? (err as { message: string }).message : "Erro ao carregar os cursos.";
      setErro(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarCursos();
  }, []);

  const cursosFiltrados = useMemo(() => {
    if (filtro === "TODOS") return cursos;
    return cursos.filter((c) => c.status_geral === filtro);
  }, [cursos, filtro]);

  const abrirDetalhes = (curso: Curso) => {
     setCursoSelecionado(curso);
     setCurrentView('detalhes');
     window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const voltarCatalogo = () => {
     setCurrentView('list');
     setTimeout(() => setCursoSelecionado(null), 300); // Limpa após a animação de saída se quiser
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--/--";
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="space-y-7 text-slate-800 pb-12">
      
      <AnimatePresence mode="wait">
        
        {/* =========================================================================
            TELA 1: LISTAGEM DO CATÁLOGO
            ========================================================================= */}
        {currentView === 'list' && (
          <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-7">
            
            {/* ── Cabeçalho ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Catálogo de Cursos</h1>
                  <p className="text-[13px] font-medium text-slate-500 mt-0.5">
                    {isLoading ? "Carregando…" : `${cursos.length} curso${cursos.length !== 1 ? "s" : ""} carregado${cursos.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>

              <button onClick={carregarCursos} disabled={isLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 disabled:opacity-40 shadow-sm">
                <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar Lista
              </button>
            </div>

            {/* ── Filtros ── */}
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
              {FILTROS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFiltro(f.value)}
                  className={`px-4 py-2 rounded-full text-[13px] font-bold border shadow-sm transition-all duration-150 ${filtro === f.value ? "bg-indigo-600 border-indigo-700 text-white" : "bg-white border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"}`}
                >
                  {f.label}
                  {filtro !== "TODOS" && f.value === filtro && cursosFiltrados.length > 0 && (
                    <span className="ml-1.5 text-[11px] opacity-80">({cursosFiltrados.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Erro / Skeletons / Vazio ── */}
            {erro && !isLoading && (
              <div className="flex flex-col items-center gap-3 py-16 text-center clean-card">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                  <SearchX className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-slate-800">Falha ao carregar</p>
                  <p className="text-[13px] text-slate-500 mt-1 font-medium">{erro}</p>
                </div>
                <button onClick={carregarCursos} className="btn-primary w-auto px-6 py-2.5 mt-4">Tentar novamente</button>
              </div>
            )}

            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <CursoCardSkeleton key={i} />)}
              </div>
            )}

            {!isLoading && !erro && cursosFiltrados.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center clean-card border-slate-200 bg-white shadow-sm border-dashed">
                <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-slate-600">Nenhum curso listado nesta categoria.</p>
                  {filtro !== "TODOS" && (
                     <div className="mt-4"><button onClick={() => setFiltro("TODOS")} className="btn-ghost">Limpar Filtros</button></div>
                  )}
                </div>
              </div>
            )}

            {/* ── Grid de Cards ── */}
            {!isLoading && !erro && cursosFiltrados.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cursosFiltrados.map((curso) => (
                  <CursoCard key={curso.id} curso={curso} imagemUrl={null} onSelecionar={abrirDetalhes} />
                ))}
              </div>
            )}

          </motion.div>
        )}

        {/* =========================================================================
            TELA 2: PÁGINA DO CURSO (E-Commerce style)
            ========================================================================= */}
        {currentView === 'detalhes' && cursoSelecionado && (
          <motion.div key="detalhes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
             
            {/* Barra de Navegação */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={voltarCatalogo} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-colors font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50">
                 <ArrowLeft className="w-4 h-4"/> Voltar ao Catálogo
              </button>
            </div>

            <div className="flex flex-col gap-8">
               {/* Banner de Cima: Descrição do Curso */}
               <div className="w-full space-y-6">
                  <div className="clean-card overflow-hidden border-none shadow-md flex flex-col md:flex-row">
                     <div className="relative h-64 md:h-auto md:w-1/3 bg-slate-100 flex flex-col items-center justify-center border-r border-slate-200">
                        <BookOpen className="w-20 h-20 text-indigo-200 opacity-50 mb-4"/>
                        <span className="text-xl font-black uppercase text-indigo-300 tracking-widest">{cursoSelecionado.codigo_oficial || "EGPC"}</span>
                        
                        <div className="absolute top-4 left-4 px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-black text-white uppercase tracking-widest shadow-lg">
                          {cursoSelecionado.tipo === "CENTRALIZADO" ? "Centralizado" : "Descentralizado"}
                        </div>
                     </div>
                     <div className="p-8 md:p-10 bg-white md:w-2/3">
                        <h1 className="text-3xl lg:text-4xl font-black text-slate-800 leading-tight">{cursoSelecionado.titulo}</h1>
                        
                        <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-100 flex-wrap">
                           <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-xl border border-slate-200">
                             <GraduationCap className="w-6 h-6 text-indigo-500" />
                             <div>
                                <p className="text-[11px] uppercase font-black text-slate-400 tracking-wider">Eixo Técnico</p>
                                <p className="text-sm font-bold text-slate-700">{cursoSelecionado.eixo === 'GESTAO_PUBLICA' ? 'Gestão Pública' : cursoSelecionado.eixo}</p>
                             </div>
                           </div>
                           <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-xl border border-slate-200">
                             <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                             <div>
                                <p className="text-[11px] uppercase font-black text-slate-400 tracking-wider">Status Base</p>
                                <p className="text-sm font-bold text-slate-700">{cursoSelecionado.status_geral}</p>
                             </div>
                           </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100">
                           <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Ementa do Curso</h2>
                           <p className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                             {cursoSelecionado.ementa || "Não há dados detalhados cadastrados na ementa deste curso institucional."}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Secao de Baixo: Vitrine de Turmas  */}
               <div className="w-full space-y-6 pt-4 border-t-4 border-slate-100 border-dotted">
                  <div className="">
                     <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-6">
                        Turmas Recebendo Matrículas
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm">{cursoSelecionado.turmas?.length || 0}</span>
                     </h2>

                     {!cursoSelecionado.turmas || cursoSelecionado.turmas.length === 0 ? (
                        <div className="clean-card p-12 text-center bg-slate-50 border-dashed border-2 border-slate-200 max-w-2xl mx-auto">
                           <CalendarDays className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                           <p className="text-xl font-bold text-slate-600">Nenhuma vaga aberta</p>
                           <p className="text-base text-slate-500 mt-2">No momento, este curso não possui turmas em período de captação de alunos.</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                           {cursoSelecionado.turmas.map(turma => (
                              <div key={turma.id} className="clean-card p-0 overflow-hidden border-indigo-100 shadow-md hover:border-indigo-300 transition-colors group">
                                 <div className="p-6 bg-white space-y-4">
                                    <div className="flex items-center justify-between">
                                       <h3 className="text-xl font-extrabold text-slate-800">Turma {turma.codigo}</h3>
                                       <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                          {turma.turno}
                                       </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                                       <div className="space-y-1">
                                          <p className="text-[10px] uppercase font-black text-slate-400">Início e Fim</p>
                                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-indigo-400"/> {formatDate(turma.data_inicio)}</p>
                                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-indigo-400"/> {formatDate(turma.data_fim)}</p>
                                       </div>
                                       <div className="space-y-1">
                                          <p className="text-[10px] uppercase font-black text-slate-400">Modalidade</p>
                                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-indigo-400"/> {turma.modalidade}</p>
                                          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-400"/> {turma.carga_horaria}h Totais</p>
                                       </div>
                                    </div>

                                    <div className="pt-2">
                                       <div className="flex items-center justify-between bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100/50 mb-4">
                                          <span className="text-indigo-900/60 font-black uppercase tracking-widest text-[10px]">Instrutor(a) Oficial</span>
                                          <span className="font-extrabold text-indigo-700 text-xs flex items-center gap-1.5">
                                             <User className="w-3.5 h-3.5" />
                                             {turma.instrutor_nome || "A definir"}
                                          </span>
                                       </div>
                                       
                                       {turma.eventos && turma.eventos.length > 0 && (
                                          <div className="space-y-2.5 mb-4">
                                             <p className="text-[10px] uppercase font-black text-slate-400">Cronograma Detalhado</p>
                                             <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                {turma.eventos.map((evt, idx) => (
                                                   <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                                                      <div className="flex items-center gap-2.5">
                                                         <div className="w-1.5 h-full rounded-full bg-orange-400 self-stretch"></div>
                                                         <div className="flex flex-col">
                                                            <span className="text-xs font-extrabold text-slate-700">{formatDate(evt.data)}</span>
                                                            <span className="text-[10px] text-slate-500 font-bold">{evt.hora_inicio} às {evt.hora_fim}</span>
                                                         </div>
                                                      </div>
                                                      <div className="flex flex-col items-end text-right justify-center">
                                                         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                                                            {evt.espaco === "EXTERNO" ? evt.espaco_externo_nome : evt.espaco.replace("_", " ")}
                                                         </span>
                                                      </div>
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       )}

                                       <div className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                                          <span className="font-bold text-slate-500 uppercase tracking-widest text-[11px]">Vagas Restantes</span>
                                          <span className="font-black text-emerald-600 text-xl">{turma.vagas}</span>
                                       </div>
                                    </div>
                                 </div>

                                 <button 
                                    className="w-full py-4 text-center text-sm font-extrabold uppercase tracking-wide bg-emerald-500 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-2 shadow-inner disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    disabled={turma.vagas === 0}
                                    onClick={() => alert('Fluxo de matrícula em desenvolvimento')}
                                 >
                                    {turma.vagas === 0 ? "Turma Lotada" : <><CheckCircle2 className="w-5 h-5"/> Garantir Minha Vaga</>}
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
