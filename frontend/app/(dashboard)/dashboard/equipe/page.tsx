"use client";

import { useEffect, useState } from "react";
import { Users, CalendarDays, CheckCircle2, Hash, Info, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function MinhaEquipePage() {
  const [aprovacoes, setAprovacoes] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  const [isLoadingAprovacoes, setIsLoadingAprovacoes] = useState(true);
  const [isLoadingMembros, setIsLoadingMembros] = useState(false);
  const [abaAtual, setAbaAtual] = useState<"aprovacoes" | "membros">("aprovacoes");
  const [showNegarModal, setShowNegarModal] = useState<number | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const carregarAprovacoes = async () => {
    setIsLoadingAprovacoes(true);
    try {
      const data = await fetchApi<any[]>("/cursos/inscricoes/minha-equipe/", { requireAuth: true });
      setAprovacoes(data);
    } catch (err) {
      toast.error("Erro ao carregar aprovações.");
    } finally {
      setIsLoadingAprovacoes(false);
    }
  };

  const carregarMembros = async () => {
    setIsLoadingMembros(true);
    try {
      const data = await fetchApi<any[]>("/users/equipe/", { requireAuth: true });
      setMembros(data);
    } catch (err) {
      toast.error("Erro ao carregar equipe.");
    } finally {
      setIsLoadingMembros(false);
    }
  };

  useEffect(() => {
    if (abaAtual === "aprovacoes") {
      carregarAprovacoes();
    } else {
      carregarMembros();
    }
  }, [abaAtual]);

  const handleAprovar = async (id: number) => {
     try {
       await fetchApi(`/cursos/inscricoes/${id}/status/`, {
         method: "POST",
         body: JSON.stringify({ acao: 'aprovar' })
       });
       toast.success("Assinatura Digital realizada com sucesso");
       setAprovacoes(prev => prev.filter(i => i.id !== id));
     } catch (err: any) {
       toast.error(err.message || "Erro ao aprovar.");
     }
  }

  const handleNegar = async () => {
     if (!showNegarModal || !justificativa.trim()) return toast.error("A justificativa é obrigatória.");
     try {
       await fetchApi(`/cursos/inscricoes/${showNegarModal}/status/`, {
         method: "POST",
         body: JSON.stringify({ acao: 'negar', justificativa })
       });
       toast.success("Inscrição negada com sucesso.");
       setAprovacoes(prev => prev.filter(i => i.id !== showNegarModal));
       setShowNegarModal(null);
       setJustificativa("");
     } catch (err: any) {
       toast.error(err.message || "Erro ao negar.");
     }
  }

  const handleResponderChefia = async (id_relacao: number, acao: "ACEITAR" | "RECUSAR") => {
    try {
      await fetchApi("/users/equipe/responder/", {
        method: "POST",
        body: JSON.stringify({ id_relacao, acao })
      });
      toast.success(acao === "ACEITAR" ? "Membro aceito na equipe!" : "Membro removido da equipe.");
      carregarMembros();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar membro.");
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "--";
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="space-y-6 relative h-full max-w-[1400px] mx-auto text-slate-800">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" /> Minha Equipe</h1>
              <p className="text-sm text-slate-500 mt-1">Gerencie os membros da sua equipe e avalie as solicitações de inscrição.</p>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setAbaAtual("aprovacoes")}
            className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors", abaAtual === "aprovacoes" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
          >
            Aprovações Pendentes
          </button>
          <button
            onClick={() => setAbaAtual("membros")}
            className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors", abaAtual === "membros" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
          >
            Membros da Equipe
          </button>
        </div>

        {abaAtual === "aprovacoes" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 items-start">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 leading-relaxed">
                <strong>Atenção:</strong> Ao autorizar, você atesta a ciência dos horários e garante que a ausência do servidor não prejudicará as atividades do setor, conforme previsto no Termo de Compromisso.
              </p>
            </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoadingAprovacoes ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : aprovacoes.length === 0 ? (
            <div className="clean-card p-12 text-center text-slate-500 flex flex-col items-center gap-3">
               <CheckCircle2 className="w-12 h-12 text-emerald-400" />
               <p className="font-bold">Nenhuma solicitação pendente.</p>
               <p className="text-sm">Sua equipe não possui solicitações aguardando a sua avaliação no momento.</p>
            </div>
          ) : (
            aprovacoes.map(aprovacao => (
              <div key={aprovacao.id} className={cn("clean-card p-6 flex flex-col md:flex-row items-center gap-6 justify-between bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow", aprovacao.is_urgente && "border-amber-300 ring-2 ring-amber-100")}>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-slate-800">{aprovacao.perfil.nome_completo}</p>
                    {aprovacao.is_urgente && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 animate-pulse">Urgente</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                     <span className="font-semibold px-2 py-1 bg-slate-100 rounded text-slate-700">{aprovacao.curso.titulo}</span>
                     <span className="flex items-center gap-1.5"><Hash className="w-4 h-4 text-slate-400" /> Turma {aprovacao.turma.codigo}</span>
                     <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-slate-400" /> {formatDate(aprovacao.turma.data_inicio)} a {formatDate(aprovacao.turma.data_fim)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button onClick={() => setShowNegarModal(aprovacao.id)} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors flex-1 md:flex-none text-center">Negar</button>
                  <button onClick={() => handleAprovar(aprovacao.id)} className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 shadow-md flex-1 md:flex-none text-center">Autorizar</button>
                </div>
              </div>
            ))
          )}
        </div>
          </>
        )}

        {abaAtual === "membros" && (
          <div className="grid grid-cols-1 gap-4">
            {isLoadingMembros ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : membros.length === 0 ? (
              <div className="clean-card p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                 <Users className="w-12 h-12 text-slate-300" />
                 <p className="font-bold">Nenhum membro na equipe.</p>
                 <p className="text-sm">Nenhum servidor indicou você como chefia imediata no perfil.</p>
              </div>
            ) : (
              membros.map(membro => (
                <div key={membro.id_relacao} className="clean-card p-6 flex flex-col md:flex-row items-center gap-6 justify-between bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-slate-800">{membro.servidor.nome_completo}</p>
                      {membro.status === "PENDENTE" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">Pendente Aprovação</span>
                      )}
                      {membro.status === "ACEITO" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Membro Ativo</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                       <span className="font-semibold">{membro.servidor.email}</span>
                       <span>•</span>
                       <span>CPF: {membro.servidor.cpf}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {membro.status === "PENDENTE" ? (
                      <>
                        <button onClick={() => handleResponderChefia(membro.id_relacao, "RECUSAR")} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors flex-1 md:flex-none text-center">Recusar</button>
                        <button onClick={() => handleResponderChefia(membro.id_relacao, "ACEITAR")} className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 shadow-md flex-1 md:flex-none text-center">Aceitar Vínculo</button>
                      </>
                    ) : (
                      <button onClick={() => handleResponderChefia(membro.id_relacao, "RECUSAR")} className="px-4 py-2 border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors flex-1 md:flex-none text-center">Desligar da Equipe</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>

      {/* Modal de Negar */}
      <AnimatePresence>
        {showNegarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                   <h2 className="text-lg font-bold text-slate-800">Justificar Recusa</h2>
                   <p className="text-sm text-slate-500 mt-1">Por favor, informe o motivo pelo qual esta solicitação está sendo negada.</p>
                </div>
                <div className="p-6">
                   <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={4} placeholder="Digite a justificativa..." className="input-light w-full resize-none" autoFocus />
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                   <button onClick={() => { setShowNegarModal(null); setJustificativa(""); }} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                   <button onClick={handleNegar} disabled={!justificativa.trim()} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Confirmar Recusa</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
