"use client";

import { useEffect, useState, Fragment } from "react";
import { BookOpen, Plus, Search, ChevronDown, CalendarDays, Users, Clock, Trash2, ArrowLeft, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Hash, Info, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Curso } from "@/types/cursos";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function GestaoCursosPage() {
  const [currentView, setCurrentView] = useState<'list' | 'curso' | 'turma'>('list');

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [cursoSelecionadoParaTurma, setCursoSelecionadoParaTurma] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Formulários Base
  const formCursoVazio = { titulo: "", ementa: "", tipo: "CENTRALIZADO", num_processo: "", memorando: "", eixo: "GESTAO_PUBLICA" };
  const formTurmaVazia = { 
    letra: "", 
    modalidade: "PRESENCIAL", 
    data_inicio: "", 
    data_fim: "", 
    carga_horaria: "", 
    vagas: "30", 
    custo: 0,
    instrutor_id: "", 
    eventos: [] as any[]
  };
  
  const [novoCurso, setNovoCurso] = useState(formCursoVazio);
  const [novaTurma, setNovaTurma] = useState(formTurmaVazia);

  // Calendar States
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [presetInicio, setPresetInicio] = useState("08:00");
  const [presetFim, setPresetFim] = useState("12:00");
  const [presetEspaco, setPresetEspaco] = useState("SALA_1");

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const carregarCursos = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Curso[]>("/cursos/");
      setCursos(data);
    } catch (err) {
      toast.error("Erro ao carregar a lista de cursos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarCursos();
  }, []);

  const toggleRow = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // ── AÇÕES DE SUBMISSÃO ──
  const handleCriarCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCurso.titulo || !novoCurso.ementa) return toast.error("Preencha título e ementa.");

    setIsSaving(true);
    try {
      await fetchApi("/cursos/", { method: "POST", body: JSON.stringify(novoCurso) });
      toast.success("Curso criado com sucesso!");
      setNovoCurso(formCursoVazio);
      setCurrentView('list');
      carregarCursos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar o curso.");
    } finally {
      setIsSaving(false);
    }
  };

  const calcularCargaHoraria = () => {
    if (novaTurma.modalidade !== "REMOTO" && novaTurma.eventos.length > 0) {
      let totalMinutos = 0;
      novaTurma.eventos.forEach(evt => {
        if (evt.hora_inicio && evt.hora_fim) {
          const [hInicio, mInicio] = evt.hora_inicio.split(':');
          const [hFim, mFim] = evt.hora_fim.split(':');
          if (hInicio && hFim) {
             const start = parseInt(hInicio) * 60 + parseInt(mInicio || "0");
             const end = parseInt(hFim) * 60 + parseInt(mFim || "0");
             if (end > start) totalMinutos += (end - start);
          }
        }
      });
      return Math.floor(totalMinutos / 60);
    }
    return novaTurma.carga_horaria ? parseInt(novaTurma.carga_horaria.toString()) : 0;
  };

  const handleCriarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTurma.letra) return toast.error("A letra da turma é obrigatória.");

    setIsSaving(true);
    try {
      const cargaComputada = calcularCargaHoraria();
      
      let payloadDataInicio = novaTurma.data_inicio;
      let payloadDataFim = novaTurma.data_fim;

      if (novaTurma.modalidade !== "REMOTO") {
         if (novaTurma.eventos.length === 0) {
            toast.error("Turmas presenciais/híbridas exigem ao menos um dia selecionado na agenda.");
            setIsSaving(false);
            return;
         }
         const eventosOrdenados = [...novaTurma.eventos].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime());
         payloadDataInicio = eventosOrdenados[0].data;
         payloadDataFim = eventosOrdenados[eventosOrdenados.length - 1].data;
      }

      if (!payloadDataInicio || !payloadDataFim) return toast.error("Data de Início e Fim são obrigatórias.");

      const payload = {
        curso: cursoSelecionadoParaTurma,
        ...novaTurma,
        data_inicio: payloadDataInicio,
        data_fim: payloadDataFim,
        carga_horaria: cargaComputada,
        vagas: parseInt(novaTurma.vagas.toString()) || 0,
        custo: novaTurma.custo || 0,
        instrutor: novaTurma.instrutor_id ? parseInt(novaTurma.instrutor_id) : null,
      };

      await fetchApi("/cursos/turmas/", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Turma criada com sucesso!");
      setNovaTurma(formTurmaVazia);
      setCurrentView('list');
      carregarCursos(); 
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar a turma.");
    } finally {
      setIsSaving(false);
    }
  };

  const abrirNovaTurma = (cursoId: number) => {
    setCursoSelecionadoParaTurma(cursoId);
    setNovaTurma(formTurmaVazia);
    setCurrentView('turma');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--";
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Funções do Calendário
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const handleDayClick = (day: number) => {
     const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
     
     const existingIndex = novaTurma.eventos.findIndex(e => e.data === dateStr && e.hora_inicio === presetInicio && e.hora_fim === presetFim && e.espaco === presetEspaco);
     
     if (existingIndex !== -1) {
        const novos = [...novaTurma.eventos];
        novos.splice(existingIndex, 1);
        setNovaTurma({ ...novaTurma, eventos: novos });
     } else {
        setNovaTurma({
           ...novaTurma,
           eventos: [...novaTurma.eventos, { 
              data: dateStr, 
              hora_inicio: presetInicio, 
              hora_fim: presetFim, 
              espaco: presetEspaco, 
              espaco_externo_nome: "" 
           }]
        });
     }
  };

  const eventosPorDia = (day: number) => {
     const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
     return novaTurma.eventos.filter(e => e.data === dateStr);
  }

  const removerEvento = (index: number) => {
    const novos = [...novaTurma.eventos];
    novos.splice(index, 1);
    setNovaTurma({ ...novaTurma, eventos: novos });
  };

  const atualizarEvento = (index: number, campo: string, valor: string) => {
    const novos = [...novaTurma.eventos];
    novos[index][campo] = valor;
    if (campo === "espaco" && valor !== "EXTERNO") {
       novos[index]["espaco_externo_nome"] = "";
    }
    setNovaTurma({ ...novaTurma, eventos: novos });
  };

  return (
    <div className="space-y-6 relative h-full max-w-[1400px] mx-auto text-slate-800">

      {/* ── VIEW: LISTAGEM ── */}
      {currentView === 'list' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Catálogo de Cursos</h1>
              <p className="text-sm text-slate-500 mt-1">Crie cursos base e adicione turmas atreladas, simulando cenários reais.</p>
            </div>
            <button onClick={() => setCurrentView('curso')} className="btn-primary sm:w-auto shadow-primary/20 hover:shadow-primary/30">
              <Plus className="w-4 h-4" /> Novo Curso Base
            </button>
          </div>

          <div className="clean-card bg-white p-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar pelo código ou título do curso..." className="input-light pl-10 border-transparent shadow-none focus:border-slate-200 bg-slate-50" />
            </div>
          </div>

          <div className="clean-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-6 py-4 w-10"></th>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Título do Curso</th>
                    <th className="px-6 py-4">Turmas Ativas</th>
                    <th className="px-6 py-4">Status Geral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                       <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> Carregando sistema...</span>
                    </td></tr>
                  ) : cursos.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-16 text-center">
                       <div className="flex flex-col items-center gap-3 text-slate-400">
                          <BookOpen className="w-10 h-10 text-slate-300"/>
                          <p>Nenhum curso cadastrado ainda. Comece criando o seu primeiro curso!</p>
                       </div>
                    </td></tr>
                  ) : (
                    cursos.map((curso) => (
                      <Fragment key={curso.id}>
                        <tr onClick={() => toggleRow(curso.id)} className={cn("hover:bg-slate-50 transition-colors cursor-pointer", expandedId === curso.id ? "bg-slate-50/50" : "")}>
                          <td className="px-6 py-4 text-slate-400"><ChevronDown className={cn("w-5 h-5 transition-transform duration-200", expandedId === curso.id && "rotate-180")} /></td>
                          <td className="px-6 py-4 font-mono text-primary font-bold">{curso.codigo_oficial || "--"}</td>
                          <td className="px-6 py-4 font-medium text-slate-700 whitespace-normal min-w-[200px]">{curso.titulo}</td>
                          <td className="px-6 py-4 text-slate-500">
                            <span className="bg-slate-100 px-3 py-1 rounded-md border border-slate-200 text-xs font-bold">{curso.turmas?.length || 0}</span>
                          </td>
                          <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">{curso.status_geral}</span></td>
                        </tr>
                        <AnimatePresence>
                          {expandedId === curso.id && (
                            <tr className="bg-slate-50/80 shadow-inner">
                              <td colSpan={5} className="p-0 border-b border-slate-200">
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="p-6 md:px-10">
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                       <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
                                         <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Turmas em Execução</h3>
                                         <button onClick={() => abrirNovaTurma(curso.id)} className="btn-ghost !text-primary !border-primary/20 hover:!bg-primary/5 !py-2 !px-4 text-[12px] flex items-center shadow-none">
                                           <Plus className="w-4 h-4" /> Adicionar Turma
                                         </button>
                                       </div>
                                       {curso.turmas?.length === 0 ? (
                                         <p className="text-[13px] text-slate-400 italic flex items-center gap-2"><Hash className="w-4 h-4" /> Nenhuma turma iniciada para esse curso.</p>
                                       ) : (
                                         <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                           {curso.turmas?.map(turma => (
                                             <div key={turma.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between group hover:border-indigo-300 transition-colors">
                                               <div className="space-y-3 w-full">
                                                 <div className="flex items-center gap-3">
                                                   <span className="text-sm font-bold text-slate-800 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Turma {turma.codigo}</span>
                                                   <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold tracking-wide uppercase">{turma.modalidade}</span>
                                                   <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold uppercase">{turma.status}</span>
                                                 </div>
                                                 
                                                 <div className="flex items-center gap-6 text-xs text-slate-500 pt-1">
                                                   <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-slate-400" /> {formatDate(turma.data_inicio)} a {formatDate(turma.data_fim)}</span>
                                                   <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> {turma.carga_horaria}h</span>
                                                   <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> {turma.vagas} vagas</span>
                                                 </div>
                                               </div>
                                             </div>
                                           ))}
                                         </div>
                                       )}
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── VIEW: NOVO CURSO ── */}
      {currentView === 'curso' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
             <button onClick={() => setCurrentView('list')} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 p-2 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5" /></button>
             <div>
               <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> Cadastrar Curso Base</h1>
               <p className="text-sm text-slate-500">Defina os parâmetros do curso que servirá de matriz para as turmas subsequentes.</p>
             </div>
          </div>

          <form onSubmit={handleCriarCurso} className="clean-card p-6 md:p-10 space-y-8">
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-slate-100 pb-3 uppercase tracking-wider"><Info className="w-4 h-4"/> Estrutura Principal</h3>
              <div>
                <label className="form-label">Título Oficial do Curso *</label>
                <input type="text" autoFocus placeholder="Ex: Capacitação Avançada em Orçamento Público" value={novoCurso.titulo} onChange={e => setNovoCurso({...novoCurso, titulo: e.target.value})} className="input-light text-base py-3" />
              </div>

              <div>
                <label className="form-label">Ementa / Descrição Completa *</label>
                <textarea rows={4} placeholder="Descreva os objetivos, grade curricular, entre outros detalhes..." value={novoCurso.ementa} onChange={e => setNovoCurso({...novoCurso, ementa: e.target.value})} className="input-light resize-none" />
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-3 uppercase tracking-wider">Classificação Institucional</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Eixo Tecnológico *</label>
                  <select value={novoCurso.eixo} onChange={e => setNovoCurso({...novoCurso, eixo: e.target.value})} className="input-light bg-slate-50">
                    <option value="TECNOLOGIA">Tecnologia</option>
                    <option value="TECNICO_ESPECIALIZADO">Técnico Especializado</option>
                    <option value="RELACOES_HUMANAS">Relações Humanas</option>
                    <option value="GESTAO_PUBLICA">Gestão Pública</option>
                    <option value="CONTABILIDADE_FINANCAS">Contabilidade, Finanças e Previdência</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Tipo Administrativo *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["CENTRALIZADO", "DESCENTRALIZADO"] as const).map(tipo => (
                      <button key={tipo} type="button" onClick={() => setNovoCurso({...novoCurso, tipo})} className={`py-3 rounded-lg border text-sm font-semibold transition-all ${novoCurso.tipo === tipo ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        {tipo === "CENTRALIZADO" ? "Centralizado" : "Descentralizado"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Nº do Processo Administrativo</label>
                  <input type="text" placeholder="Ex: 004/2026-PMC" value={novoCurso.num_processo} onChange={e => setNovoCurso({...novoCurso, num_processo: e.target.value})} className="input-light" />
                </div>
                <div>
                  <label className="form-label">Memorando de Solicitação</label>
                  <input type="text" placeholder="Ex: MEMO 012/2026" value={novoCurso.memorando} onChange={e => setNovoCurso({...novoCurso, memorando: e.target.value})} className="input-light" />
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end gap-4 border-t border-slate-100">
              <button type="button" onClick={() => setCurrentView('list')} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary">
                 {isSaving ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Registrando...</span> : "Concluir Criação do Curso"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ── VIEW: NOVA TURMA ── */}
      {currentView === 'turma' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-6xl mx-auto pb-12">
           <div className="flex items-center gap-4 pb-4 sticky top-0 bg-[#f8fafc]/90 backdrop-blur-md z-20 pt-2 border-b border-slate-200">
             <button onClick={() => setCurrentView('list')} className="text-slate-400 hover:text-slate-800 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 p-2.5 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5" /></button>
             <div className="flex-1">
               <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3"><Users className="w-8 h-8 text-indigo-600" /> Abrir Nova Turma</h1>
               <p className="text-sm font-medium text-slate-500 mt-1">Defina os parâmetros técnicos e construa o cronograma logístico logo abaixo.</p>
             </div>
             <button type="button" onClick={handleCriarTurma} disabled={isSaving} className="btn-success px-8 shadow-md">
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : <span className="flex items-center gap-2 text-base"><CheckCircle2 className="w-5 h-5"/> Finalizar Turma Oficialmente</span>}
             </button>
          </div>

          <form id="formTurma" onSubmit={handleCriarTurma} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             
             {/* Esquerda: Infos Básicas no Estilo da Ficha Técnica */}
             <div className="col-span-1 space-y-6">
                <div className="clean-card">
                   <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Info className="w-4 h-4" /> Ficha Técnica da Turma</h3>
                   </div>
                   <div className="p-6 space-y-6">
                     <div>
                       <label className="form-label text-slate-600">Código / Módulo da Turma *</label>
                       <div className="flex items-center gap-3">
                         <span className="text-xl font-black text-slate-300">TURMA</span>
                         <input type="text" autoFocus placeholder="A, B, C..." value={novaTurma.letra} onChange={e => setNovaTurma({...novaTurma, letra: e.target.value.toUpperCase()})} maxLength={3} className="input-light text-xl font-bold w-full text-center tracking-widest text-indigo-700" />
                       </div>
                     </div>
                     <div>
                       <label className="form-label text-slate-600">Modalidade *</label>
                       <select value={novaTurma.modalidade} onChange={e => setNovaTurma({...novaTurma, modalidade: e.target.value})} className="input-light bg-slate-50 font-bold text-slate-700">
                         <option value="PRESENCIAL">Presencial na Escola</option>
                         <option value="HIBRIDO">Aulas Híbridas</option>
                         <option value="REMOTO">Remoto (Completamente EAD)</option>
                       </select>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="form-label text-slate-600">Vagas Totais *</label>
                           <input type="number" value={novaTurma.vagas} onChange={e => setNovaTurma({...novaTurma, vagas: e.target.value})} className="input-light font-bold text-slate-700" />
                        </div>
                        <div>
                           <label className="form-label text-slate-600 font-bold text-emerald-600">Custo (R$)</label>
                           <input 
                             type="text" 
                             value={novaTurma.custo === 0 ? "" : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(novaTurma.custo)} 
                             onChange={e => {
                                let raw = e.target.value.replace(/\D/g, "");
                                if (!raw) raw = "0";
                                setNovaTurma({...novaTurma, custo: parseInt(raw, 10) / 100});
                             }} 
                             className="input-light text-emerald-600 font-bold bg-emerald-50 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-500/20" 
                             placeholder="Gratuito (R$ 0,00)"
                           />
                        </div>
                     </div>
                   </div>
                </div>

                {novaTurma.modalidade === "REMOTO" && (
                   <div className="clean-card bg-blue-50/30 border-blue-100 flex flex-col p-6 animate-[fade-in_0.3s_ease-out]">
                      <h3 className="text-[13px] font-bold text-blue-700 uppercase tracking-wider mb-2">Período de Acesso (EAD)</h3>
                      <p className="text-[12px] text-slate-500 leading-relaxed mb-4">Para turmas remotas, o sistema não calculará encontros. Por favor, forneça o prazo formal de início e término e a carga fechada ideal.</p>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="form-label">Data Início</label>
                             <input type="date" value={novaTurma.data_inicio} onChange={e => setNovaTurma({...novaTurma, data_inicio: e.target.value})} className="input-light" />
                           </div>
                           <div>
                             <label className="form-label">Data Fim</label>
                             <input type="date" value={novaTurma.data_fim} onChange={e => setNovaTurma({...novaTurma, data_fim: e.target.value})} className="input-light" />
                           </div>
                        </div>
                        <div>
                          <label className="form-label">Carga Horária Informada (h)</label>
                          <input type="number" value={novaTurma.carga_horaria} onChange={e => setNovaTurma({...novaTurma, carga_horaria: e.target.value})} className="input-light font-bold text-blue-600 text-lg" placeholder="Ex: 40" />
                        </div>
                      </div>
                   </div>
                )}
             </div>

             {/* Direita: Event Builder (Smart Calendar - estilo premium) */}
             {novaTurma.modalidade !== "REMOTO" && (
               <div className="col-span-2 space-y-6">
                  
                  {/* Construtor Inteligente no estilo "Avaliação de Qualidade" */}
                  <div className="clean-card flex flex-col">
                     <div className="bg-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                           <h3 className="text-base font-bold text-white flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-indigo-400" /> Montagem do Cronograma (Smart Calendar)</h3>
                           <p className="text-[12px] font-medium text-slate-300 mt-1">O sistema mapeará os conflitos de espaços automaticamente garantindo turnos livres.</p>
                        </div>
                        <div className="bg-white/10 px-4 py-2 rounded-xl flex items-center gap-4 border border-white/20">
                           <span className="text-xs text-indigo-200 font-bold uppercase tracking-wider">Carga Calculada</span>
                           <span className="text-xl font-black text-white">{calcularCargaHoraria()}h</span>
                        </div>
                     </div>

                     <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Passo 1: Selecione o Padrão de Reunião (Preset)</label>
                        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                           <div className="flex items-center gap-2 w-full sm:w-auto p-2">
                              <input type="time" className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-lg" value={presetInicio} onChange={e => setPresetInicio(e.target.value)} />
                              <span className="text-slate-300 font-light text-2xl">-</span>
                              <input type="time" className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-lg" value={presetFim} onChange={e => setPresetFim(e.target.value)} />
                           </div>
                           <div className="w-[1px] h-10 bg-slate-200 hidden sm:block"></div>
                           <div className="w-full">
                              <select className="appearance-none bg-transparent border-none text-slate-600 font-semibold focus:ring-0 w-full text-base" value={presetEspaco} onChange={e => setPresetEspaco(e.target.value)}>
                                 <option value="SALA_1">Sala de Aula 1 (4º andar)</option>
                                 <option value="SALA_2">Sala de Aula 2 (5º andar)</option>
                                 <option value="LAB_INFO">Laboratório de Informática (4º andar)</option>
                                 <option value="AUDITORIO">Auditório (5º andar)</option>
                                 <option value="EXTERNO">📍 Espaço Externo...</option>
                              </select>
                           </div>
                        </div>
                     </div>

                     <div className="p-8">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6 block text-center">Passo 2: Dispare cliques nos dias para registrar as reuniões</label>
                        <div className="max-w-[24rem] mx-auto select-none bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                           <div className="flex items-center justify-between mb-6">
                              <button type="button" onClick={prevMonth} className="p-2 hover:bg-white rounded-xl text-slate-400 shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft className="w-5 h-5"/></button>
                              <span className="font-black text-slate-800 text-lg">{meses[calMonth]} {calYear}</span>
                              <button type="button" onClick={nextMonth} className="p-2 hover:bg-white rounded-xl text-slate-400 shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight className="w-5 h-5"/></button>
                           </div>
                           <div className="grid grid-cols-7 gap-2 text-center mb-4">
                              {diasSemana.map(d => <span key={d} className="text-[11px] font-black text-slate-400 uppercase">{d}</span>)}
                           </div>
                           <div className="grid grid-cols-7 gap-2">
                              {Array.from({length: firstDay}).map((_, i) => <div key={`empty-${i}`} className="p-2"/>)}
                              {Array.from({length: daysInMonth}).map((_, i) => {
                                 const day = i + 1;
                                 const evts = eventosPorDia(day);
                                 const hasExactPreset = evts.some(e => e.hora_inicio === presetInicio && e.hora_fim === presetFim && e.espaco === presetEspaco);
                                 
                                 return (
                                    <div 
                                       key={day} 
                                       onClick={() => handleDayClick(day)}
                                       className={cn(
                                          "relative flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all hover:scale-110 active:scale-95 h-12 border-2",
                                          evts.length > 0 ? (hasExactPreset ? "bg-indigo-600 border-indigo-700 text-white font-bold shadow-md shadow-indigo-600/30" : "bg-indigo-100 border-indigo-300 text-indigo-900 font-bold") : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50 font-medium"
                                       )}
                                    >
                                       <span className="text-sm leading-none">{day}</span>
                                       {evts.length > 0 && (
                                          <div className="absolute bottom-1.5 flex gap-1">
                                             {evts.map((_, idx) => <span key={idx} className={cn("w-1.5 h-1.5 rounded-full", hasExactPreset ? "bg-white/80" : "bg-indigo-500")}></span>)}
                                          </div>
                                       )}
                                    </div>
                                 )
                              })}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Lista Resultante da Agenda Clariana */}
                  <div className="clean-card border-none bg-transparent shadow-none">
                     <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-widest pl-2 mb-4 border-l-4 border-orange-400">Detalhamento dos Encontros ( {novaTurma.eventos.length} )</h3>
                     <div className="space-y-3">
                        {novaTurma.eventos.length === 0 ? (
                           <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                              <CalendarDays className="w-12 h-12 text-slate-300 mb-3" />
                              <p className="text-sm font-medium text-slate-500">A turma não tem nenhum dia de aula listado.</p>
                              <p className="text-xs text-slate-400 mt-1">No calendário acima, selecione os dias da semana para as aulas presidenciais.</p>
                           </div>
                        ) : (
                           [...novaTurma.eventos].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime() || a.hora_inicio.localeCompare(b.hora_inicio)).map((evt, pseudoIdx) => {
                              const idx = novaTurma.eventos.findIndex(e => e.data === evt.data && e.hora_inicio === evt.hora_inicio && e.espaco === evt.espaco);
                              const isExterno = evt.espaco === "EXTERNO";
                              return (
                                 <div key={`evt-${idx}`} className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all relative overflow-hidden group">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>
                                    <button type="button" onClick={() => removerEvento(idx)} className="absolute right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
                                    
                                    <div className="w-full sm:w-36 shrink-0 pl-3">
                                       <label className="form-label !mb-1 !ml-0">Sessão</label>
                                       <input type="date" className="input-light py-2 text-[13px] bg-slate-50 font-bold text-slate-700" value={evt.data} onChange={e => atualizarEvento(idx, 'data', e.target.value)} />
                                    </div>
                                    <div className="w-full sm:w-40 shrink-0">
                                       <label className="form-label !mb-1 !ml-0">Horários</label>
                                       <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                                          <input type="time" className="bg-transparent border-none focus:ring-0 text-slate-700 font-bold p-1 w-full text-center text-xs" value={evt.hora_inicio} onChange={e => atualizarEvento(idx, 'hora_inicio', e.target.value)} />
                                          <span className="text-slate-300 font-black">-</span>
                                          <input type="time" className="bg-transparent border-none focus:ring-0 text-slate-700 font-bold p-1 w-full text-center text-xs" value={evt.hora_fim} onChange={e => atualizarEvento(idx, 'hora_fim', e.target.value)} />
                                       </div>
                                    </div>
                                    <div className="flex-1 w-full pr-10">
                                       <label className="form-label !mb-1 !ml-0">Sede/Local</label>
                                       <div className="flex flex-col lg:flex-row gap-2">
                                          <select className="input-light py-2 text-[12px] bg-white w-full shadow-none font-semibold text-slate-700 h-[38px]" value={evt.espaco} onChange={e => atualizarEvento(idx, 'espaco', e.target.value)}>
                                             <option value="SALA_1">Sala de Aula 1</option>
                                             <option value="SALA_2">Sala de Aula 2</option>
                                             <option value="LAB_INFO">Laboratório (Info)</option>
                                             <option value="AUDITORIO">Auditório EGC</option>
                                             <option value="EXTERNO">⚠️ Ponto Externo...</option>
                                          </select>
                                          {isExterno && (
                                             <input type="text" placeholder="Nomeie o Local..." className="input-light py-2 text-[13px] border-orange-300 focus:border-orange-500 focus:ring-orange-500/20 w-full h-[38px] animate-[fade-in_0.2s_ease-out]" value={evt.espaco_externo_nome} onChange={e => atualizarEvento(idx, 'espaco_externo_nome', e.target.value)} />
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              )
                           })
                        )}
                     </div>
                  </div>

               </div>
             )}

          </form>
        </motion.div>
      )}

    </div>
  );
}