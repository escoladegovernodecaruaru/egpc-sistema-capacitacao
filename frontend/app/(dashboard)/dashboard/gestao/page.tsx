"use client";

import { useEffect, useState, Fragment } from "react";
import { 
  BookOpen, Plus, Search, ChevronDown, CalendarDays, Users, 
  Clock, Trash2, ArrowLeft, Calendar as CalendarIcon, 
  CheckCircle2, ChevronLeft, ChevronRight, Hash, Info, 
  Loader2, UserPlus, X, ShieldAlert, EyeOff, Eye, 
  MonitorPlay, Video, PlusCircle, AlignLeft, Edit // <-- Edit adicionado
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Curso } from "@/types/cursos";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { mascaraCPF } from "@/lib/validations";

export default function GestaoCursosPage() {
  const [currentView, setCurrentView] = useState<'list' | 'curso' | 'turma' | 'lms'>('list');

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ─── ESTADOS DE EDIÇÃO ───
  const [editandoCursoId, setEditandoCursoId] = useState<number | null>(null);
  const [editandoTurmaId, setEditandoTurmaId] = useState<number | null>(null);

  const [cursoSelecionadoParaTurma, setCursoSelecionadoParaTurma] = useState<number | null>(null);
  const [turmaSelecionadaParaLMS,   setTurmaSelecionadaParaLMS]   = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modais Secundários
  const [modalMatricula, setModalMatricula] = useState<{ aberto: boolean, turmaId: number | null, cpf: string }>({ aberto: false, turmaId: null, cpf: "" });
  const [isMatriculando, setIsMatriculando] = useState(false);

  // Estados LMS (EAD)
  const [modulos, setModulos] = useState<any[]>([]);
  const [novoModuloTitulo, setNovoModuloTitulo] = useState("");
  const [modalAtividade, setModalAtividade] = useState<{aberto: boolean, moduloId: number | null}>({aberto: false, moduloId: null});
  const [novaAtividade, setNovaAtividade] = useState({ titulo: "", descricao: "", tipo: "VIDEO_YOUTUBE", url_video: "", carga_horaria: 0 });

  // Formulários Base
  const formCursoVazio = { titulo: "", ementa: "", tipo: "CENTRALIZADO", num_processo: "", memorando: "", eixo: "GESTAO_PUBLICA" };
  const formTurmaVazia = { 
    letra: "", 
    modalidade: "PRESENCIAL", 
    visibilidade: "PUBLICA",
    gestores_str: "",
    data_inicio: "", 
    data_fim: "", 
    carga_horaria: "", 
    vagas: "30", 
    custo: 0,
    instrutor_cpf: "",
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

  const carregarDadosIniciais = async () => {
    setIsLoading(true);
    try {
      const dataCursos = await fetchApi<Curso[]>("/cursos/");
      setCursos(dataCursos);
    } catch (err) {
      toast.error("Erro ao carregar os cursos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { carregarDadosIniciais(); }, []);

  const toggleRow = (id: number) => setExpandedId(expandedId === id ? null : id);

  // ─── AÇÕES: CURSO E TURMA ───
  const abrirNovoCurso = () => {
    setEditandoCursoId(null);
    setNovoCurso(formCursoVazio);
    setCurrentView('curso');
  };

  const abrirEdicaoCurso = (curso: Curso, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita expandir a linha ao clicar no botão
    setEditandoCursoId(curso.id);
    setNovoCurso({
      titulo: curso.titulo,
      ementa: curso.ementa,
      tipo: curso.tipo,
      eixo: curso.eixo || "GESTAO_PUBLICA",
      num_processo: curso.num_processo || "",
      memorando: curso.memorando || ""
    });
    setCurrentView('curso');
  };

  const handleCriarCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCurso.titulo || !novoCurso.ementa) return toast.error("Preencha título e ementa.");
    setIsSaving(true);
    try {
      if (editandoCursoId) {
        await fetchApi(`/cursos/${editandoCursoId}/`, { method: "PATCH", body: JSON.stringify(novoCurso) });
        toast.success("Curso atualizado com sucesso!");
      } else {
        await fetchApi("/cursos/", { method: "POST", body: JSON.stringify(novoCurso) });
        toast.success("Curso criado com sucesso!");
      }
      setNovoCurso(formCursoVazio);
      setEditandoCursoId(null);
      setCurrentView('list');
      carregarDadosIniciais();
    } catch (err: any) { toast.error(err.message || "Erro ao salvar o curso."); } finally { setIsSaving(false); }
  };

  const abrirNovaTurma = (cursoId: number) => {
    setEditandoTurmaId(null);
    setCursoSelecionadoParaTurma(cursoId);
    setNovaTurma(formTurmaVazia);
    setCurrentView('turma');
  };

  const abrirEdicaoTurma = (turma: any, cursoId: number) => {
    setEditandoTurmaId(turma.id);
    setCursoSelecionadoParaTurma(cursoId);
    
    // Converte a lista de gestores para string separada por vírgula
    const gestoresString = turma.gestores_permitidos ? turma.gestores_permitidos.join(", ") : "";

    setNovaTurma({
      letra: turma.letra,
      modalidade: turma.modalidade,
      visibilidade: turma.visibilidade || "PUBLICA",
      gestores_str: gestoresString,
      data_inicio: turma.data_inicio || "",
      data_fim: turma.data_fim || "",
      carga_horaria: turma.carga_horaria.toString(),
      vagas: turma.vagas.toString(),
      custo: turma.custo || 0,
      instrutor_cpf: "", // Deixamos vazio, só atualiza se ele digitar um novo
      eventos: turma.eventos || []
    });
    setCurrentView('turma');
  };

  const calcularCargaHoraria = () => {
    if (novaTurma.modalidade !== "REMOTO" && novaTurma.eventos.length > 0) {
      let totalMinutos = 0;
      novaTurma.eventos.forEach(evt => {
        if (evt.hora_inicio && evt.hora_fim) {
          const [hInicio, mInicio] = evt.hora_inicio.split(':');
          const [hFim, mFim] = evt.hora_fim.split(':');
          const start = parseInt(hInicio) * 60 + parseInt(mInicio || "0");
          const end = parseInt(hFim) * 60 + parseInt(mFim || "0");
          if (end > start) totalMinutos += (end - start);
        }
      });
      return Math.floor(totalMinutos / 60);
    }
    return parseInt(novaTurma.carga_horaria) || 0;
  };

  const handleCriarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTurma.letra) return toast.error("A letra da turma é obrigatória.");

    const cpfInstrutor = novaTurma.instrutor_cpf.replace(/\D/g, '');
    if (cpfInstrutor && cpfInstrutor.length !== 11) {
      return toast.error("CPF do instrutor inválido. Preencha os 11 dígitos ou deixe em branco para manter o atual.");
    }
    if (novaTurma.modalidade !== "REMOTO" && novaTurma.eventos.length === 0) {
      return toast.error("Adicione ao menos uma aula no cronograma para turmas presenciais ou híbridas.");
    }
    const vagas = parseInt(novaTurma.vagas);
    if (!vagas || vagas <= 0) return toast.error("O número de vagas deve ser maior que zero.");
    
    setIsSaving(true);
    try {
      const gestoresArray = novaTurma.gestores_str.split(',').map(c => c.replace(/\D/g, '')).filter(c => c.length === 11);
      
      const payload: any = {
        curso: cursoSelecionadoParaTurma,
        letra: novaTurma.letra,
        modalidade: novaTurma.modalidade,
        visibilidade: novaTurma.visibilidade,
        gestores_permitidos: gestoresArray,
        data_inicio: novaTurma.data_inicio || (novaTurma.eventos[0]?.data),
        data_fim: novaTurma.data_fim || (novaTurma.eventos[novaTurma.eventos.length - 1]?.data),
        carga_horaria: calcularCargaHoraria(),
        vagas: parseInt(novaTurma.vagas) || 0,
        custo: novaTurma.custo || 0,
        eventos: novaTurma.eventos
      };

      // Só envia o CPF do instrutor se ele digitou um novo válido
      if (cpfInstrutor.length === 11) {
        payload.instrutor_cpf = cpfInstrutor;
      }

      if (editandoTurmaId) {
        await fetchApi(`/cursos/turmas/${editandoTurmaId}/`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Turma atualizada com sucesso!");
      } else {
        await fetchApi("/cursos/turmas/", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Turma criada com sucesso!");
      }

      setNovaTurma(formTurmaVazia);
      setEditandoTurmaId(null);
      setCurrentView('list');
      carregarDadosIniciais();
    } catch (err: any) { toast.error(err.message || "Erro ao salvar a turma."); } finally { setIsSaving(false); }
  };

  const handleMatricularManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = modalMatricula.cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return toast.error("CPF inválido.");
    setIsMatriculando(true);
    try {
      await fetchApi(`/cursos/turmas/${modalMatricula.turmaId}/matricular-admin/`, {
        method: "POST", body: JSON.stringify({ cpf: cpfLimpo })
      });
      toast.success("Aluno matriculado!");
      setModalMatricula({ aberto: false, turmaId: null, cpf: "" });
      carregarDadosIniciais();
    } catch (err: any) { toast.error(err.message || "Erro ao matricular."); } finally { setIsMatriculando(false); }
  };

  // ─── AÇÕES: LMS / EAD ───
  const abrirLMS = async (turmaId: number) => {
    setTurmaSelecionadaParaLMS(turmaId);
    setCurrentView('lms');
    setIsLoading(true);
    try {
      const data = await fetchApi<any>(`/cursos/turmas/${turmaId}/sala-de-aula/`);
      setModulos(data.modulos || []);
    } catch (e) { toast.error("Erro ao carregar estrutura EAD."); } finally { setIsLoading(false); }
  };

  const adicionarModulo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoModuloTitulo) return;
    setIsSaving(true);
    try {
      await fetchApi(`/cursos/turmas/${turmaSelecionadaParaLMS}/modulos/`, {
        method: "POST", body: JSON.stringify({ titulo: novoModuloTitulo, ordem: modulos.length })
      });
      setNovoModuloTitulo("");
      toast.success("Módulo criado!");
      abrirLMS(turmaSelecionadaParaLMS!);
    } catch (e) { toast.error("Erro ao criar módulo."); } finally { setIsSaving(false); }
  };

  const excluirModulo = async (id: number) => {
    if(!confirm("Excluir módulo e todas as suas atividades?")) return;
    try {
       await fetchApi(`/cursos/modulos/${id}/`, { method: "DELETE" });
       toast.success("Módulo excluído.");
       abrirLMS(turmaSelecionadaParaLMS!);
    } catch(e) { toast.error("Erro ao excluir."); }
  };

  const handleAdicionarAtividade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaAtividade.titulo || !novaAtividade.url_video) return toast.error("Título e link do vídeo são obrigatórios.");
    setIsSaving(true);
    try {
       await fetchApi(`/cursos/modulos/${modalAtividade.moduloId}/atividades/`, {
          method: "POST",
          body: JSON.stringify({...novaAtividade, ordem: 99})
       });
       toast.success("Atividade adicionada!");
       setModalAtividade({aberto: false, moduloId: null});
       setNovaAtividade({ titulo: "", descricao: "", tipo: "VIDEO_YOUTUBE", url_video: "", carga_horaria: 0 });
       abrirLMS(turmaSelecionadaParaLMS!);
    } catch(e) { toast.error("Erro ao adicionar atividade."); } finally { setIsSaving(false); }
  };

  const excluirAtividade = async (id: number) => {
    if(!confirm("Excluir esta atividade?")) return;
    try {
       await fetchApi(`/cursos/atividades/${id}/detalhe/`, { method: "DELETE" });
       toast.success("Atividade excluída.");
       abrirLMS(turmaSelecionadaParaLMS!);
    } catch(e) { toast.error("Erro ao excluir."); }
  };

  // Funções Auxiliares de Calendário
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const handleDayClick = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existingIndex = novaTurma.eventos.findIndex(e => e.data === dateStr && e.hora_inicio === presetInicio);
    if (existingIndex !== -1) {
      const novos = [...novaTurma.eventos];
      novos.splice(existingIndex, 1);
      setNovaTurma({ ...novaTurma, eventos: novos });
    } else {
      setNovaTurma({ ...novaTurma, eventos: [...novaTurma.eventos, { data: dateStr, hora_inicio: presetInicio, hora_fim: presetFim, espaco: presetEspaco, espaco_externo_nome: "" }] });
    }
  };

  const eventosPorDia = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return novaTurma.eventos.filter(e => e.data === dateStr);
  };

  const atualizarEvento = (index: number, campo: string, valor: string) => {
    const novos = [...novaTurma.eventos];
    novos[index][campo] = valor;
    if (campo === "espaco" && valor !== "EXTERNO") novos[index]["espaco_externo_nome"] = "";
    setNovaTurma({ ...novaTurma, eventos: novos });
  };

  const removerEvento = (index: number) => {
    const novos = [...novaTurma.eventos];
    novos.splice(index, 1);
    setNovaTurma({ ...novaTurma, eventos: novos });
  };

  return (
    <div className="space-y-6 relative h-full max-w-[1200px] mx-auto text-slate-800 pb-20">
      
      {/* ── VIEW: LISTAGEM ── */}
      {currentView === 'list' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <div className="clean-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão Institucional</h1>
              <p className="text-sm text-slate-500 mt-1">Controle de cursos, turmas e matrículas.</p>
            </div>
            <button onClick={abrirNovoCurso} className="btn-primary">
              <Plus className="w-4 h-4" /> Novo Curso Base
            </button>
          </div>

          <div className="clean-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4 w-10"></th>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Título do Curso</th>
                    <th className="px-6 py-4 text-center">Turmas Ativas</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
                  ) : (
                    cursos.map(curso => (
                      <Fragment key={curso.id}>
                        <tr onClick={() => toggleRow(curso.id)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                          <td className="px-6 py-4"><ChevronDown className={cn("w-5 h-5 transition-transform", expandedId === curso.id && "rotate-180")} /></td>
                          <td className="px-6 py-4 font-mono font-bold text-primary">{curso.codigo_oficial}</td>
                          <td className="px-6 py-4 font-medium truncate max-w-md">{curso.titulo}</td>
                          <td className="px-6 py-4 text-center"><span className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200">{curso.turmas?.length || 0}</span></td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={(e) => abrirEdicaoCurso(curso, e)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4"/>
                            </button>
                          </td>
                        </tr>
                        <AnimatePresence>
                          {expandedId === curso.id && (
                            <tr>
                              <td colSpan={5} className="p-0 bg-slate-50/50">
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-6">
                                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                                    <div className="flex justify-between items-center border-b pb-3">
                                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> Turmas Ativas</h3>
                                      <button onClick={() => abrirNovaTurma(curso.id)} className="text-xs font-bold text-primary flex items-center gap-1 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-primary/20"><Plus className="w-3 h-3"/> Abrir Nova Turma</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {curso.turmas?.map(t => (
                                        <div key={t.id} className="p-5 border border-slate-200 rounded-xl bg-slate-50 flex flex-col gap-4 relative group hover:border-indigo-300 transition-colors">
                                          
                                          <button onClick={() => abrirEdicaoTurma(t, curso.id)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 rounded-md transition-colors opacity-0 group-hover:opacity-100 border border-transparent hover:border-slate-200 shadow-sm" title="Editar Turma">
                                            <Edit className="w-3.5 h-3.5"/>
                                          </button>

                                          <div className="flex justify-between items-start">
                                            <div>
                                              <span className="font-bold text-slate-800 text-sm">Turma {t.codigo}</span>
                                              <p className="text-[10px] text-slate-500 mt-0.5">Instrutor(a): {t.instrutor_nome || "Pendente"}</p>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[9px] px-2 py-1 rounded bg-slate-200 text-slate-600 font-bold uppercase tracking-widest">{t.modalidade}</span>
                                            {t.visibilidade === "RESTRITA" && <span className="text-[9px] px-2 py-1 rounded bg-amber-100 text-amber-700 font-bold uppercase tracking-widest">Privada</span>}
                                          </div>

                                          <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-200/60">
                                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                                              <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 text-slate-400"/> {t.data_inicio?.split('-').reverse().join('/')}</span>
                                              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400"/> {t.vagas} vagas</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {(t.modalidade === "REMOTO" || t.modalidade === "HIBRIDO") && (
                                                <button onClick={() => abrirLMS(t.id)} className="text-[10px] bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg font-bold text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm">
                                                  <MonitorPlay className="w-3 h-3"/> EAD
                                                </button>
                                              )}
                                              <button onClick={() => setModalMatricula({aberto: true, turmaId: t.id, cpf: ""})} className="text-[10px] bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-slate-600 hover:text-primary transition-colors flex items-center gap-1.5 shadow-sm">
                                                <UserPlus className="w-3 h-3"/> Adicionar
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
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

      {/* ── VIEW: NOVO/EDITAR CURSO ── */}
      {currentView === 'curso' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
             <button onClick={() => setCurrentView('list')} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 p-2 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5" /></button>
             <div>
               <h1 className="text-2xl font-bold text-slate-800">{editandoCursoId ? "Editar Curso Base" : "Cadastrar Curso Base"}</h1>
               <p className="text-sm text-slate-500">Este será o guarda-chuva para todas as futuras turmas.</p>
             </div>
          </div>

          <form onSubmit={handleCriarCurso} className="clean-card p-8 space-y-6">
            <div>
              <label className="form-label">Título Oficial do Curso *</label>
              <input type="text" autoFocus value={novoCurso.titulo} onChange={e => setNovoCurso({...novoCurso, titulo: e.target.value})} className="input-light py-3" />
            </div>
            <div>
              <label className="form-label">Ementa / Descrição Completa *</label>
              <textarea rows={4} value={novoCurso.ementa} onChange={e => setNovoCurso({...novoCurso, ementa: e.target.value})} className="input-light resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Eixo Tecnológico *</label>
                <select value={novoCurso.eixo} onChange={e => setNovoCurso({...novoCurso, eixo: e.target.value})} className="input-light bg-slate-50">
                  <option value="TECNOLOGIA">Tecnologia</option>
                  <option value="TECNICO_ESPECIALIZADO">Técnico Especializado</option>
                  <option value="RELACOES_HUMANAS">Relações Humanas</option>
                  <option value="GESTAO_PUBLICA">Gestão Pública</option>
                </select>
              </div>
              <div>
                <label className="form-label">Tipo Administrativo *</label>
                <select value={novoCurso.tipo} onChange={e => setNovoCurso({...novoCurso, tipo: e.target.value})} className="input-light bg-slate-50">
                  <option value="CENTRALIZADO">Centralizado</option>
                  <option value="DESCENTRALIZADO">Descentralizado</option>
                </select>
              </div>
            </div>
            <div className="pt-6 flex justify-end gap-4 border-t border-slate-100">
              <button type="button" onClick={() => setCurrentView('list')} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary px-8">
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : editandoCursoId ? "Salvar Alterações" : "Criar Curso"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ── VIEW: NOVA/EDITAR TURMA ── */}
      {currentView === 'turma' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-4xl mx-auto space-y-6 pb-12">
           <div className="flex items-center justify-between sticky top-0 bg-[#f8fafc]/90 backdrop-blur-md z-20 py-4 border-b border-slate-200">
             <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('list')} className="p-2 bg-white border rounded-lg"><ArrowLeft className="w-5 h-5"/></button>
                <h1 className="text-2xl font-bold text-slate-800">{editandoTurmaId ? "Editar Turma" : "Abrir Nova Turma"}</h1>
             </div>
             <button onClick={handleCriarTurma} disabled={isSaving} className="btn-success px-8 shadow-lg">
                {isSaving ? <Loader2 className="animate-spin w-5 h-5"/> : editandoTurmaId ? "Salvar Atualizações" : "Finalizar Turma"}
             </button>
          </div>

          <form id="formTurma" className="grid grid-cols-1 gap-8">
             <div className="clean-card p-6 md:p-8 space-y-8 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Identificador (Letra) *</label>
                    <input type="text" placeholder="Ex: A, B..." value={novaTurma.letra} onChange={e => setNovaTurma({...novaTurma, letra: e.target.value.toUpperCase()})} maxLength={3} className="input-light font-bold" />
                  </div>
                  <div>
                    <label className="form-label">Instrutor (CPF) {editandoTurmaId && <span className="text-slate-400 font-normal lowercase">(Deixe em branco para não alterar)</span>}</label>
                    <input type="text" placeholder={editandoTurmaId ? "Novo CPF (Opcional)" : "000.000.000-00"} value={novaTurma.instrutor_cpf} onChange={e => setNovaTurma({...novaTurma, instrutor_cpf: mascaraCPF(e.target.value)})} className="input-light font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div>
                      <label className="form-label">Modalidade *</label>
                      <select value={novaTurma.modalidade} onChange={e => setNovaTurma({...novaTurma, modalidade: e.target.value})} className="input-light bg-slate-50 font-bold">
                        <option value="PRESENCIAL">Presencial</option>
                        <option value="REMOTO">EAD (Assíncrono)</option>
                        <option value="HIBRIDO">Híbrido</option>
                      </select>
                   </div>
                   <div>
                      <label className="form-label">Vagas</label>
                      <input type="number" value={novaTurma.vagas} onChange={e => setNovaTurma({...novaTurma, vagas: e.target.value})} className="input-light" />
                   </div>
                   <div>
                      <label className="form-label text-emerald-600">Custo (R$)</label>
                      <input type="text" value={novaTurma.custo === 0 ? "" : novaTurma.custo} onChange={e => setNovaTurma({...novaTurma, custo: parseFloat(e.target.value) || 0})} className="input-light" placeholder="Grátis" />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
                   <div>
                      <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Visibilidade</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setNovaTurma({...novaTurma, visibilidade: 'PUBLICA'})} className={cn("flex-1 py-2 rounded-lg border text-xs font-bold transition-all", novaTurma.visibilidade === 'PUBLICA' ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" : "bg-white text-slate-400 hover:bg-slate-100")}>Pública</button>
                        <button type="button" onClick={() => setNovaTurma({...novaTurma, visibilidade: 'RESTRITA'})} className={cn("flex-1 py-2 rounded-lg border text-xs font-bold transition-all", novaTurma.visibilidade === 'RESTRITA' ? "bg-amber-50 border-amber-500 text-amber-700 shadow-sm" : "bg-white text-slate-400 hover:bg-slate-100")}>Privada</button>
                      </div>
                   </div>
                   <div>
                      <label className="form-label">Gestores (CPFs separados por vírgula)</label>
                      <input type="text" value={novaTurma.gestores_str} onChange={e => setNovaTurma({...novaTurma, gestores_str: e.target.value})} className="input-light text-xs font-mono" placeholder="Ex: 00011122233, 444555..." />
                   </div>
                </div>
             </div>

             <div className="clean-card p-6 md:p-8 bg-white space-y-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-3"><CalendarIcon className="w-5 h-5 text-primary" /> Cronograma de Aulas</h3>
                <div className="flex flex-col lg:flex-row gap-8">
                   <div className="w-full lg:w-72 space-y-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                         <div className="flex gap-2 mb-4">
                            <input type="time" value={presetInicio} onChange={e => setPresetInicio(e.target.value)} className="input-light py-2 text-center text-xs font-bold" />
                            <input type="time" value={presetFim} onChange={e => setPresetFim(e.target.value)} className="input-light py-2 text-center text-xs font-bold" />
                         </div>
                         <div className="flex items-center justify-between mb-4 px-2">
                            <button type="button" onClick={prevMonth} className="p-1 text-slate-400 hover:text-indigo-600"><ChevronLeft className="w-4 h-4"/></button>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{meses[calMonth]}</span>
                            <button type="button" onClick={nextMonth} className="p-1 text-slate-400 hover:text-indigo-600"><ChevronRight className="w-4 h-4"/></button>
                         </div>
                         <div className="grid grid-cols-7 gap-1 text-[10px] font-black text-slate-400 text-center mb-2 uppercase">
                            {diasSemana.map(d => <span key={d}>{d}</span>)}
                         </div>
                         <div className="grid grid-cols-7 gap-1">
                            {Array.from({length: firstDay}).map((_, i) => <div key={i} />)}
                            {Array.from({length: daysInMonth}).map((_, i) => {
                               const day = i + 1;
                               const hasAula = eventosPorDia(day).length > 0;
                               return (
                                 <div key={day} onClick={() => handleDayClick(day)} className={cn("p-1.5 rounded-lg text-center cursor-pointer text-xs font-bold transition-all", hasAula ? "bg-primary text-white shadow-sm" : "bg-white border border-slate-200 hover:bg-indigo-50 text-slate-600 hover:border-indigo-300")}>{day}</div>
                               )
                            })}
                         </div>
                      </div>
                   </div>
                   <div className="flex-1 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {novaTurma.eventos.length === 0 ? (
                        <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400">Clique nos dias no calendário para adicionar aulas.</div>
                      ) : (
                        [...novaTurma.eventos].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map((evt, idx) => (
                           <div key={idx} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-indigo-200 transition-colors">
                              <button type="button" onClick={() => removerEvento(idx)} className="p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                              <span className="text-xs font-bold text-slate-700 w-24">{evt.data.split('-').reverse().join('/')}</span>
                              <span className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded">{evt.hora_inicio} - {evt.hora_fim}</span>
                              <select value={evt.espaco} onChange={e => atualizarEvento(idx, 'espaco', e.target.value)} className="input-light py-1 text-[11px] flex-1 bg-slate-50 border-transparent focus:border-indigo-300">
                                 <option value="SALA_1">Sala 1</option>
                                 <option value="SALA_2">Sala 2</option>
                                 <option value="AUDITORIO">Auditório</option>
                                 <option value="EXTERNO">Externo</option>
                              </select>
                           </div>
                        ))
                      )}
                   </div>
                </div>
             </div>
          </form>
        </motion.div>
      )}

      {/* ── VIEW: GESTÃO DO LMS (EAD) ── */}
      {currentView === 'lms' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-4xl mx-auto pb-12">
          <div className="flex items-center justify-between sticky top-0 bg-[#f8fafc]/90 backdrop-blur-md z-20 py-4 border-b border-slate-200">
             <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('list')} className="p-2 bg-white border rounded-lg hover:bg-slate-50 transition-colors"><ArrowLeft className="w-5 h-5"/></button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Estrutura do Curso (EAD)</h1>
                  <p className="text-sm text-slate-500">Adicione módulos e vídeos do YouTube para a turma.</p>
                </div>
             </div>
          </div>

          {isLoading ? (
             <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : (
             <div className="space-y-8">
               {/* Formulário Novo Módulo */}
               <form onSubmit={adicionarModulo} className="flex gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                 <input type="text" value={novoModuloTitulo} onChange={e => setNovoModuloTitulo(e.target.value)} placeholder="Título do Novo Módulo (Ex: Introdução)" className="input-light flex-1" />
                 <button type="submit" disabled={isSaving || !novoModuloTitulo} className="btn-primary shrink-0">
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <PlusCircle className="w-4 h-4"/>} Adicionar Módulo
                 </button>
               </form>

               {/* Lista de Módulos e Atividades */}
               {modulos.length === 0 ? (
                 <div className="p-12 text-center bg-slate-50 border-dashed border-2 rounded-2xl text-slate-400">
                   <MonitorPlay className="w-12 h-12 mx-auto mb-3 opacity-50"/>
                   <p className="font-bold text-slate-600">Ainda não existem módulos.</p>
                   <p className="text-sm">Crie um módulo acima para começar a adicionar os vídeos.</p>
                 </div>
               ) : (
                 <div className="space-y-6">
                   {modulos.map((modulo) => (
                     <div key={modulo.id} className="clean-card bg-white overflow-hidden shadow-sm border border-slate-200">
                       <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                         <h3 className="font-bold text-slate-700 uppercase tracking-widest text-[13px] flex items-center gap-2"><AlignLeft className="w-4 h-4 text-indigo-400"/> {modulo.titulo}</h3>
                         <button onClick={() => excluirModulo(modulo.id)} className="text-[10px] font-bold text-red-500 hover:underline">Excluir Módulo</button>
                       </div>
                       <div className="p-4 space-y-3">
                         {modulo.atividades?.map((ativ: any) => (
                           <div key={ativ.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors group">
                             <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                               <Video className="w-5 h-5"/>
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="font-bold text-sm text-slate-800 truncate">{ativ.titulo}</p>
                               <p className="text-[11px] text-slate-500 truncate">{ativ.carga_horaria_recompensa}h de carga horária • YouTube</p>
                             </div>
                             <button onClick={() => excluirAtividade(ativ.id)} className="p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4"/></button>
                           </div>
                         ))}
                         <button onClick={() => setModalAtividade({aberto: true, moduloId: modulo.id})} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-[13px] font-bold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors flex items-center justify-center gap-2 mt-2">
                           <Plus className="w-4 h-4"/> Adicionar Vídeo nesta secção
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}
        </motion.div>
      )}

      {/* MODAL NOVA ATIVIDADE (VÍDEO) */}
      <AnimatePresence>
        {modalAtividade.aberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                   <h2 className="font-bold text-slate-800">Inserir Aula em Vídeo</h2>
                   <button onClick={() => setModalAtividade({aberto: false, moduloId: null})} className="p-1 hover:bg-slate-200 rounded-md transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <form onSubmit={handleAdicionarAtividade} className="p-6 space-y-4">
                   <div>
                     <label className="form-label">Título da Aula *</label>
                     <input type="text" value={novaAtividade.titulo} onChange={e => setNovaAtividade({...novaAtividade, titulo: e.target.value})} className="input-light" autoFocus />
                   </div>
                   <div>
                     <label className="form-label">Link do YouTube *</label>
                     <input type="url" placeholder="https://www.youtube.com/watch?v=..." value={novaAtividade.url_video} onChange={e => setNovaAtividade({...novaAtividade, url_video: e.target.value})} className="input-light" />
                   </div>
                   <div>
                     <label className="form-label">Carga Horária (Quantas horas o aluno ganha ao ver o vídeo?)</label>
                     <input type="number" value={novaAtividade.carga_horaria} onChange={e => setNovaAtividade({...novaAtividade, carga_horaria: parseInt(e.target.value)||0})} className="input-light font-bold text-indigo-700" />
                   </div>
                   <div>
                     <label className="form-label">Descrição Breve</label>
                     <textarea rows={2} value={novaAtividade.descricao} onChange={e => setNovaAtividade({...novaAtividade, descricao: e.target.value})} className="input-light resize-none" />
                   </div>
                   
                   <button type="submit" disabled={isSaving || !novaAtividade.titulo || !novaAtividade.url_video} className="btn-primary w-full h-12 mt-4 shadow-md">
                      {isSaving ? <Loader2 className="animate-spin mx-auto"/> : "Salvar Aula"}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL MATRÍCULA ADMIN */}
      <AnimatePresence>
        {modalMatricula.aberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                   <h2 className="font-bold text-slate-800">Matricular Aluno</h2>
                   <button onClick={() => setModalMatricula({aberto: false, turmaId: null, cpf: ""})} className="p-1 hover:bg-slate-200 rounded-md transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <form onSubmit={handleMatricularManual} className="p-6 space-y-4">
                   <input type="text" placeholder="CPF do Aluno" value={modalMatricula.cpf} onChange={e => setModalMatricula({...modalMatricula, cpf: mascaraCPF(e.target.value)})} className="input-light text-center font-mono text-lg" autoFocus />
                   <button type="submit" disabled={isMatriculando || modalMatricula.cpf.length !== 14} className="btn-primary w-full h-12 shadow-md">
                      {isMatriculando ? <Loader2 className="animate-spin mx-auto"/> : "Confirmar Matrícula"}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}