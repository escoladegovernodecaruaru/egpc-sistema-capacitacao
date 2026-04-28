"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Filter, RefreshCcw, SearchX, ArrowLeft, Clock, CalendarDays, CheckCircle2, ChevronRight, GraduationCap, User, X, AlertTriangle } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Curso, StatusTurma, Turma } from "@/types/cursos";
import CursoCard from "@/components/cursos/CursoCard";
import CursoCardSkeleton from "@/components/cursos/CursoCardSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EIXO_LABEL, TIPO_CURSO_LABEL, STATUS_TURMA_LABEL, label } from "@/lib/labels";

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
  const [inscricoesAtivas, setInscricoesAtivas] = useState<{ turmas: number[], cursos: number[] }>({ turmas: [], cursos: [] });

  // Novo Controle de View
  const [currentView, setCurrentView] = useState<'list' | 'detalhes'>('list');
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null);
  const [turmaParaCronograma, setTurmaParaCronograma] = useState<Turma | null>(null);
  
  // Novo Controle de Inscrição
  const [turmaParaInscricao, setTurmaParaInscricao] = useState<Turma | null>(null);
  const [termoAceito, setTermoAceito] = useState(false);
  const [isSubmittingInscricao, setIsSubmittingInscricao] = useState(false);

  const carregarCursos = async () => {
    setIsLoading(true);
    setErro(null);
    try {
      const [data, inscricoes] = await Promise.all([
        fetchApi<Curso[]>("/cursos/", { requireAuth: false }),
        fetchApi<{ turmas: number[], cursos: number[] }>("/cursos/minhas-inscricoes/", { requireAuth: true }).catch(() => ({ turmas: [], cursos: [] }))
      ]);
      setCursos(data);
      setInscricoesAtivas(inscricoes);
      
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
     setTurmaParaCronograma(null);
     setTimeout(() => setCursoSelecionado(null), 300); // Limpa após a animação de saída se quiser
  };

  const formatDate = (dateStr: string | null) => {
     if (!dateStr) return "--/--";
     const [ano, mes, dia] = dateStr.split('-');
     return `${dia}/${mes}/${ano}`;
  };

  const handleInscrever = async () => {
    if (!turmaParaInscricao) return;
    setIsSubmittingInscricao(true);
    
    try {
      await fetchApi(`/cursos/turmas/${turmaParaInscricao.id}/inscrever/`, {
        method: "POST",
      });
      
      toast.success("Inscrição realizada com sucesso!", {
        description: "Acompanhe o status na aba Perfil.",
      });
      
      setTurmaParaInscricao(null);
      carregarCursos(); // Recarrega os cursos e turmas para atualizar vagas e o status
    } catch (err: any) {
      const msg = err?.message || "Ocorreu um erro inesperado ao realizar a inscrição.";
      
      if (err?.status === 400 && msg.toLowerCase().includes("inscrito")) {
        toast.error("Não foi possível confirmar a inscrição.", {
          description: "Atenção: Já possuis uma inscrição (ativa ou pendente) noutra turma deste mesmo curso. Não é permitido inscrever-se em mais de uma turma por curso.",
        });
      } else {
        toast.error("Não foi possível confirmar a inscrição.", {
          description: msg,
        });
      }
    } finally {
      setIsSubmittingInscricao(false);
    }
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
                  <div className="clean-card p-8 bg-white border-none shadow-md">
                     <h1 className="text-3xl font-black text-slate-800 leading-tight">{cursoSelecionado.titulo}</h1>
                     
                     <div className="flex flex-row gap-3 mt-3 flex-wrap">
                        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                           {cursoSelecionado.codigo_oficial || "EGPC"}
                        </span>
                        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                           {label(TIPO_CURSO_LABEL, cursoSelecionado.tipo)}
                        </span>
                        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                           {label(EIXO_LABEL, cursoSelecionado.eixo)}
                        </span>
                        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                           {label(STATUS_TURMA_LABEL, cursoSelecionado.status_geral)}
                        </span>
                     </div>

                     <div className="mt-6 pt-6 border-t border-slate-100">
                       <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ementa do Curso</h3>
                       <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                         {cursoSelecionado.ementa || "Nenhuma ementa cadastrada."}
                       </p>
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
                        <div className="flex flex-col gap-4">
                           {cursoSelecionado.turmas.map(turma => (
                              <div key={turma.id} className="clean-card p-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-200 flex flex-col md:flex-row bg-white">
                                 {/* Esquerda: Identificação */}
                                 <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                          <BookOpen className="w-6 h-6 text-indigo-500" />
                                       </div>
                                       <div>
                                          <h3 className="text-lg font-bold text-slate-800">Turma {turma.codigo}</h3>
                                          <div className="flex gap-2 mt-1">
                                             <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                {turma.turno}
                                             </span>
                                             <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                {turma.modalidade}
                                             </span>
                                          </div>
                                       </div>
                                    </div>
                                 </div>

                                 {/* Centro: Resumo */}
                                 <div className="p-6 flex-1 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
                                    <div className="flex gap-6">
                                       <div>
                                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><CalendarDays className="w-4 h-4" /> Início / Fim</p>
                                          <p className="text-sm font-bold text-slate-700">{formatDate(turma.data_inicio)} a {formatDate(turma.data_fim)}</p>
                                       </div>
                                       <div>
                                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><Clock className="w-4 h-4" /> Carga Horária</p>
                                          <p className="text-sm font-bold text-slate-700">{turma.carga_horaria}h totais</p>
                                       </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                       <User className="w-4 h-4 text-slate-400" />
                                       <span className="text-sm text-slate-600 font-medium">Instrutor(a): {turma.instrutor_nome || "A definir"}</span>
                                    </div>
                                     {turma.eventos && turma.eventos.length > 0 && (
                                        <div className="mt-3">
                                           <button 
                                             onClick={() => setTurmaParaCronograma(turma)} 
                                             className="mt-2 text-[13px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors flex items-center gap-1"
                                           >
                                             Ver Cronograma ({turma.eventos?.length || 0} encontros)
                                           </button>
                                        </div>
                                     )}
                                  </div>

                                 {/* Direita: Ação */}
                                 <div className={`p-6 w-full md:w-64 flex flex-col justify-center items-center text-center ${turma.vagas_restantes !== undefined && turma.vagas_restantes > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                    <p className="text-xs uppercase font-black text-slate-500 tracking-wider mb-1">Vagas Restantes</p>
                                    <p className={`text-3xl font-black mb-4 ${turma.vagas_restantes !== undefined && turma.vagas_restantes > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                       {turma.vagas_restantes ?? turma.vagas}
                                    </p>
                                    
                                    {(() => {
                                       const jaInscritoTurma = inscricoesAtivas.turmas.includes(turma.id);
                                       const jaInscritoOutraTurma = !jaInscritoTurma && inscricoesAtivas.cursos.includes(cursoSelecionado.id);
                                       const isEsgotado = (turma.vagas_restantes ?? turma.vagas) <= 0;

                                       if (jaInscritoTurma) {
                                          return (
                                             <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex justify-center items-center gap-2 bg-indigo-100 text-indigo-700 cursor-not-allowed">
                                                Sua Inscrição
                                             </button>
                                          );
                                       }

                                       if (jaInscritoOutraTurma) {
                                          return (
                                             <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex justify-center items-center gap-2 bg-slate-200 text-slate-500 cursor-not-allowed">
                                                Inscrito em outra turma
                                             </button>
                                          );
                                       }

                                       if (isEsgotado) {
                                          return (
                                             <button disabled className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex justify-center items-center gap-2 bg-red-100 text-red-600 cursor-not-allowed">
                                                Turma Esgotada
                                             </button>
                                          );
                                       }

                                       return (
                                          <button 
                                             className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
                                             onClick={() => { setTurmaParaInscricao(turma); setTermoAceito(false); }}
                                          >
                                             <CheckCircle2 className="w-4 h-4"/> Garantir Vaga
                                          </button>
                                       );
                                    })()}
                                 </div>
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

      {/* MODAL DE INSCRIÇÃO E TERMO */}
      <AnimatePresence>
        {turmaParaInscricao && cursoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => !isSubmittingInscricao && setTurmaParaInscricao(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="clean-card w-full max-w-2xl relative z-10 flex flex-col bg-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">Confirmação de Inscrição</h2>
                  <p className="text-[13px] font-medium text-slate-500 mt-1">{cursoSelecionado.titulo} - Turma {turmaParaInscricao.codigo || turmaParaInscricao.letra}</p>
                </div>
                <button onClick={() => setTurmaParaInscricao(null)} disabled={isSubmittingInscricao} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
                
                {/* Highlights */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 items-start">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-amber-900 space-y-2">
                    <p className="font-bold">Pontos Importantes:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Frequência mínima de 80%</strong> e <strong>nota igual ou superior a 7</strong> para aprovação e certificação.</li>
                      <li>Para cursos ≥ 28h, a chefia imediata realizará uma avaliação de competência pós-curso.</li>
                      <li>A desistência ou faltas injustificadas implicam a <strong>suspensão de novas capacitações por 12 meses</strong>.</li>
                      <li>Risco de <strong>restituição financeira</strong> dos custos do curso através de desconto em folha (conforme Anexo II).</li>
                    </ul>
                  </div>
                </div>

                {/* Termo Completo */}
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-700">Termo de Compromisso do Aluno</p>
                  <div className="h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-[13px] text-slate-600 leading-relaxed text-justify">
                    <p className="font-bold text-center mb-4">TERMO DE COMPROMISSO DO ALUNO</p>
                    <ol className="list-decimal pl-4 space-y-2 mb-4">
                      <li>Conhecer e cumprir todas as normas estabelecidas nos normativos do Programa de Formação e Qualificação Continuada - PFQC.</li>
                      <li>Participar das aulas com frequência mínima de 80%, obter nota maior ou igual a 7 para gerar direito à certificação.</li>
                      <li>Para os cursos com carga horária igual ou superior a 28 (vinte e oito) horas, ao participante considerado APTO, caberá à chefia imediata a realização da avaliação, tomando por base o índice de competência, a fim de mensurar o grau de eficiência na aplicação dos conhecimentos adquiridos durante o curso em suas atividades funcionais diárias.</li>
                      <li>Ser pontual.</li>
                      <li>Realizar atividades propostas pelos instrutores, em sala e/ou com atividades complementares externas, de modo a contribuir com meu desenvolvimento.</li>
                      <li>Participar dos debates individuais e/ou coletivos, problematizando situações para discussões sobre cada temática apresentada, de modo a contribuir para minha avaliação por parte do instrutor.</li>
                      <li>Realizar pesquisas e estudos dirigidos para resolução das atividades propostas nas aulas perdidas para acompanhamento da turma, uma vez que estas não serão repostas.</li>
                      <li>Aplicar o aprendizado do curso em meu cotidiano, de modo a gerar mudanças tangíveis por minhas chefias.</li>
                      <li>Responder questionário de avaliação dos instrutores com responsabilidade e imparcialidade, contribuindo para o desenvolvimento do programa.</li>
                      <li>Assumir todas as despesas inerentes a transporte e alimentação, e quaisquer outras decorrentes da participação nos cursos ofertados pelo PFQC, independentemente da região em que seja instituída a instrutoria.</li>
                      <li>Gerenciar afastamentos do local de trabalho para participar das aulas do programa de modo que não acarretem prejuízos no desempenho das minhas funções, em minha unidade.</li>
                      <li>Solicitar anuência do chefe imediato e do titular do órgão e a garantia, por meio de declaração assinada, de que sua ausência não trará prejuízo às atividades realizadas em sua unidade de lotação durante a vigência dos cursos.</li>
                      <li>Manter dados cadastrais sempre atualizados junto ao banco de dados da Escola de Governo.</li>
                      <li>Comprometer-se, através da assinatura deste termo, a comparecer às aulas para as quais se inscreveu, sob possível pena de restituição dos valores proporcionais inerentes às custas para realização do curso (conforme SEÇÃO II do regulamento), além de não poder participar de outras capacitações por um período de doze meses, conforme a portaria de regulamento da Escola de Governo de Caruaru.</li>
                      <li>O cronograma disposto poderá ser modificado a qualquer momento de acordo com as necessidades da Escola de Governo, em comum acordo com o instrutor, cabendo ao aluno seguir o cronograma mais recente. A Escola de Governo responsabiliza-se por manter o discente atualizado de tais alterações.</li>
                      <li>Ter ciência de que, especialmente quando a oferta dos cursos e das aulas se derem fora do horário de expediente, minha participação continuará sendo VOLUNTÁRIA inexistindo, portanto, qualquer relação de trabalho, remuneração ou folgas proporcionais relacionadas à carga horária do curso.</li>
                      <li>Autorização de Uso de Imagem (LGPD compliant): O aluno(a) autoriza o uso de sua imagem, nome e voz capturados durante as atividades para fins institucionais, promocionais e de marketing da Escola de Governo da Prefeitura de Caruaru (incluindo materiais impressos, digitais, redes sociais, vídeos e relatórios). Esta autorização é concedida sem qualquer ônus financeiro.</li>
                      <li>Revogação de Consentimento: A autorização de imagem é válida por tempo indeterminado e pode ser revogada a qualquer momento, mediante solicitação por escrito à Escola de Governo da Prefeitura de Caruaru, com um prazo de até 30 dias para a cessação do uso.</li>
                      <li>Colaboradores Terceirizados: Caso o(a) aluno(a) seja terceirizado(a), declara que a empresa contratante está ciente e em concordância com sua participação e com todos os regulamentos do programa.</li>
                    </ol>
                    <p className="font-bold">
                      Estou ciente, também, que a inobservância dos requisitos citados acima implicará nas penalidades previstas pelo programa, de acordo com as regras previstas na legislação.
                    </p>
                  </div>
                </div>

                {/* Checkbox de Aceite */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="mt-0.5 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={termoAceito}
                      onChange={(e) => setTermoAceito(e.target.checked)}
                      disabled={isSubmittingInscricao}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                    Li, compreendo e aceito voluntariamente todos os compromissos, normas e penalidades descritos neste Termo de Compromisso.
                  </span>
                </label>

              </div>
              
              {/* Footer / Ação */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setTurmaParaInscricao(null)}
                  disabled={isSubmittingInscricao}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleInscrever}
                  disabled={!termoAceito || isSubmittingInscricao}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmittingInscricao ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {isSubmittingInscricao ? "Processando..." : "Confirmar minha Inscrição"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DO CRONOGRAMA */}
      <AnimatePresence>
        {turmaParaCronograma && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setTurmaParaCronograma(null)} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="clean-card w-full max-w-md relative z-10 flex flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">Cronograma da Turma {turmaParaCronograma.codigo || turmaParaCronograma.letra}</h2>
                  <p className="text-[12px] font-medium text-slate-500 mt-0.5">{turmaParaCronograma.eventos?.length || 0} encontros programados</p>
                </div>
                <button onClick={() => setTurmaParaCronograma(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
                {(!turmaParaCronograma.eventos || turmaParaCronograma.eventos.length === 0) ? (
                  <p className="text-center text-sm text-slate-500 py-4">Nenhum evento registrado para esta turma.</p>
                ) : (
                  [...turmaParaCronograma.eventos]
                    .sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime() || a.hora_inicio.localeCompare(b.hora_inicio))
                    .map((evt, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm transition-all relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
                      <div className="flex flex-col border-r border-slate-100 pr-4 min-w-[100px]">
                        <span className="text-sm font-black text-slate-700">{formatDate(evt.data)}</span>
                        <span className="text-[11px] font-bold text-slate-400">{evt.hora_inicio} às {evt.hora_fim}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {evt.espaco === "EXTERNO" ? evt.espaco_externo_nome : evt.espaco.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
