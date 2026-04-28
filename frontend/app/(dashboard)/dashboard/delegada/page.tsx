"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users, UserPlus, Trash2, ArrowLeft, Loader2, ShieldCheck, Search, Info } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { mascaraCPF } from "@/lib/validations";

interface Aluno {
  id: number;
  cpf: string;
  nome: string;
  status: string;
  data_inscricao: string;
}

export default function GestaoDelegadaPage() {
  const [currentView, setCurrentView] = useState<'lista' | 'painel'>('lista');
  const [turmas, setTurmas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados do Painel da Turma
  const [turmaSelecionada, setTurmaSelecionada] = useState<any | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [buscaAluno, setBuscaAluno] = useState("");
  const [cpfNovoAluno, setCpfNovoAluno] = useState("");
  const [isProcessando, setIsProcessando] = useState(false);

  const carregarTurmas = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi<any>("/cursos/turmas/gestao-delegada/");
      setTurmas(Array.isArray(res) ? res : (res as any)?.results || []);
    } catch (err) {
      toast.error("Erro ao carregar turmas autorizadas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarTurmas();
  }, []);

  const abrirPainel = async (turma: any) => {
    setTurmaSelecionada(turma);
    setCurrentView('painel');
    carregarAlunos(turma.id);
  };

  const carregarAlunos = async (turmaId: number) => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Aluno[]>(`/cursos/turmas/${turmaId}/gestao-alunos/`);
      setAlunos(data);
    } catch (err) {
      toast.error("Erro ao carregar alunos.");
      setCurrentView('lista');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatricular = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = cpfNovoAluno.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return toast.error("CPF inválido.");
    
    setIsProcessando(true);
    try {
      await fetchApi(`/cursos/turmas/${turmaSelecionada.id}/gestao-alunos/`, {
        method: "POST",
        body: JSON.stringify({ cpf: cpfLimpo, acao: 'adicionar' })
      });
      toast.success("Aluno adicionado com sucesso!");
      setCpfNovoAluno("");
      carregarAlunos(turmaSelecionada.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar aluno.");
    } finally {
      setIsProcessando(false);
    }
  };

  const handleRemover = async (cpf: string) => {
    if (!confirm("Tem certeza que deseja inativar este aluno? Ele perderá acesso ao conteúdo da turma.")) return;
    
    setIsProcessando(true);
    try {
      await fetchApi(`/cursos/turmas/${turmaSelecionada.id}/gestao-alunos/`, {
        method: "POST",
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), acao: 'remover' })
      });
      toast.success("Aluno removido da turma.");
      carregarAlunos(turmaSelecionada.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover aluno.");
    } finally {
      setIsProcessando(false);
    }
  };

  const alunosFiltrados = alunos.filter(a => 
    a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) || 
    a.cpf.includes(buscaAluno.replace(/\D/g, ""))
  );

  const formatCpf = (c: string) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  return (
    <div className="space-y-6 max-w-[1200px] w-full mx-auto text-slate-800 animate-[fade-in_0.4s_ease-out] pb-12">
      
      {/* ── HEADER ── */}
      <div className="clean-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Turmas Autorizadas</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Gerencie os alunos nas turmas onde você foi delegado como gestor.</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* ── VIEW 1: LISTA DE TURMAS ── */}
        {currentView === 'lista' && (
          <motion.div key="lista" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : turmas.length === 0 ? (
              <div className="clean-card p-16 text-center flex flex-col items-center bg-white border-dashed border-2 border-slate-200">
                <ShieldCheck className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-[15px] font-bold text-slate-600">Nenhuma permissão concedida</p>
                <p className="text-[13px] text-slate-400 mt-1 max-w-sm">Você não foi adicionado como gestor delegado em nenhuma turma ativa no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {turmas.map(turma => (
                  <div key={turma.id} onClick={() => abrirPainel(turma)} className="clean-card p-6 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">Turma {turma.codigo}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-200">{turma.status}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 leading-snug">{turma.curso?.titulo || "Curso Sem Título"}</h3>
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <span className="text-sm font-bold text-indigo-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                        <Users className="w-4 h-4"/> Gerenciar Alunos &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── VIEW 2: PAINEL DE ALUNOS ── */}
        {currentView === 'painel' && turmaSelecionada && (
          <motion.div key="painel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-6">
            
            {/* Header da Turma */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView('lista')} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 shadow-sm transition-colors"><ArrowLeft className="w-5 h-5"/></button>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Turma {turmaSelecionada.codigo}</h2>
                  <p className="text-[12px] text-slate-500 font-medium">Controle de Inscrições</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
               
               {/* Lado Esquerdo: Adicionar Aluno */}
               <div className="col-span-1">
                  <form onSubmit={handleMatricular} className="clean-card p-6 bg-white border border-slate-200 sticky top-24">
                     <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                        <UserPlus className="w-4 h-4 text-indigo-600"/> Adicionar Novo Aluno
                     </h3>
                     <div className="space-y-4">
                        <div>
                           <label className="form-label">CPF do Servidor</label>
                           <input type="text" placeholder="000.000.000-00" autoFocus value={cpfNovoAluno} onChange={e => setCpfNovoAluno(mascaraCPF(e.target.value))} className="input-light text-center font-mono tracking-wider" />
                           <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">O CPF já deve possuir conta criada no portal para ser matriculado.</p>
                        </div>
                        <button type="submit" disabled={cpfNovoAluno.length !== 14 || isProcessando} className="btn-primary w-full shadow-md">
                           {isProcessando ? <Loader2 className="w-4 h-4 animate-spin"/> : "Confirmar Inscrição"}
                        </button>
                     </div>
                  </form>
               </div>

               {/* Lado Direito: Tabela de Alunos */}
               <div className="col-span-2 clean-card bg-white border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar por nome ou CPF..." value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                     </div>
                     <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest shrink-0">
                        {alunosFiltrados.length} Alunos
                     </div>
                  </div>

                  {isLoading ? (
                     <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                  ) : alunosFiltrados.length === 0 ? (
                     <div className="p-12 text-center text-slate-500 text-sm font-medium">Nenhum aluno encontrado.</div>
                  ) : (
                     <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                           <thead className="bg-white sticky top-0 border-b border-slate-200 z-10">
                              <tr>
                                 <th className="px-5 py-3 font-extrabold text-[10px] uppercase tracking-widest text-slate-400">Aluno</th>
                                 <th className="px-5 py-3 font-extrabold text-[10px] uppercase tracking-widest text-slate-400">Data Ingresso</th>
                                 <th className="px-5 py-3 font-extrabold text-[10px] uppercase tracking-widest text-slate-400 text-right">Ação</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {alunosFiltrados.map((aluno) => (
                                 <tr key={aluno.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                       <p className="font-bold text-slate-700 text-[13px]">{aluno.nome}</p>
                                       <p className="text-[10px] font-mono text-slate-400 mt-0.5">{formatCpf(aluno.cpf)}</p>
                                    </td>
                                    <td className="px-5 py-3 text-[12px] text-slate-500 font-medium">
                                       {new Date(aluno.data_inscricao).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                       <button onClick={() => handleRemover(aluno.cpf)} disabled={isProcessando} className="px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 ml-auto">
                                          <Trash2 className="w-3 h-3"/> Inativar
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}