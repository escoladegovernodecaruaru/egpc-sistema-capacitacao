import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Loader2, Plus, Trash2, Save, X, Settings, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function FormQuestionario({ atividadeId, onClose }: { atividadeId: number, onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [questionario, setQuestionario] = useState({
    titulo: "Avaliação",
    descricao: "",
    tentativas_permitidas: 1,
    tempo_limite_minutos: 0,
    nota_minima_aprovacao: 7.0,
    questoes: [] as any[]
  });

  const [aba, setAba] = useState<'questoes' | 'config'>('questoes');

  useEffect(() => {
    fetchApi<any>(`/cursos/atividades/${atividadeId}/questionario/`)
      .then(res => {
        if (res.id) setQuestionario(res);
      })
      .catch(() => {
        // Ignora erro 404 (novo questionário)
      })
      .finally(() => setIsLoading(false));
  }, [atividadeId]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (questionario.questoes.length === 0) {
        return toast.error("Adicione ao menos uma questão.");
    }

    for (let i = 0; i < questionario.questoes.length; i++) {
      const q = questionario.questoes[i];
      if (!q.enunciado) return toast.error(`A questão ${i+1} não possui enunciado.`);
      if (q.opcoes.length < 2) return toast.error(`A questão ${i+1} precisa de pelo menos 2 opções.`);
      if (!q.opcoes.some((op: any) => op.is_correta)) {
         return toast.error(`A questão ${i+1} não tem uma opção marcada como correta.`);
      }
    }
    
    setIsSaving(true);
    try {
      await fetchApi(`/cursos/atividades/${atividadeId}/questionario/`, {
        method: "POST",
        body: JSON.stringify(questionario)
      });
      toast.success("Questionário salvo com sucesso!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar o questionário.");
    } finally {
      setIsSaving(false);
    }
  };

  const addQuestao = () => {
    setQuestionario(prev => ({
      ...prev,
      questoes: [...prev.questoes, {
        enunciado: "",
        valor: "1.00",
        ordem: prev.questoes.length + 1,
        opcoes: [
           { texto: "Opção A", is_correta: true, ordem: 1 },
           { texto: "Opção B", is_correta: false, ordem: 2 }
        ]
      }]
    }));
  };

  const atualizarQuestao = (index: number, campo: string, valor: any) => {
      const novas = [...questionario.questoes];
      novas[index][campo] = valor;
      setQuestionario({...questionario, questoes: novas});
  };

  const removerQuestao = (index: number) => {
      const novas = [...questionario.questoes];
      novas.splice(index, 1);
      setQuestionario({...questionario, questoes: novas});
  };

  const addOpcao = (qIndex: number) => {
      const novas = [...questionario.questoes];
      novas[qIndex].opcoes.push({
          texto: "",
          is_correta: false,
          ordem: novas[qIndex].opcoes.length + 1
      });
      setQuestionario({...questionario, questoes: novas});
  };

  const atualizarOpcao = (qIndex: number, opIndex: number, campo: string, valor: any) => {
      const novas = [...questionario.questoes];
      if (campo === 'is_correta' && valor === true) {
          // Desmarca as outras
          novas[qIndex].opcoes.forEach((o: any) => o.is_correta = false);
      }
      novas[qIndex].opcoes[opIndex][campo] = valor;
      setQuestionario({...questionario, questoes: novas});
  };

  const removerOpcao = (qIndex: number, opIndex: number) => {
      const novas = [...questionario.questoes];
      novas[qIndex].opcoes.splice(opIndex, 1);
      setQuestionario({...questionario, questoes: novas});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Construtor de Questionário</h2>
            <p className="text-sm text-slate-500">Avaliação para a atividade atual</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
          </div>
        </div>

        {/* ABAS */}
        <div className="flex bg-white border-b border-slate-200 shrink-0 px-6 pt-2">
            <button onClick={() => setAba('questoes')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${aba === 'questoes' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Questões</button>
            <button onClick={() => setAba('config')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${aba === 'config' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Configurações</button>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
                <>
                  {aba === 'config' && (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto">
                          <div>
                            <label className="form-label">Título do Questionário</label>
                            <input type="text" value={questionario.titulo} onChange={e => setQuestionario({...questionario, titulo: e.target.value})} className="input-light" />
                          </div>
                          <div>
                            <label className="form-label">Instruções / Descrição</label>
                            <textarea rows={3} value={questionario.descricao} onChange={e => setQuestionario({...questionario, descricao: e.target.value})} className="input-light resize-none" placeholder="Opcional..." />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="form-label">Tentativas Permitidas</label>
                                <input type="number" min="1" value={questionario.tentativas_permitidas} onChange={e => setQuestionario({...questionario, tentativas_permitidas: parseInt(e.target.value)})} className="input-light" />
                              </div>
                              <div>
                                <label className="form-label">Tempo Limite (Minutos)</label>
                                <input type="number" min="0" value={questionario.tempo_limite_minutos} onChange={e => setQuestionario({...questionario, tempo_limite_minutos: parseInt(e.target.value)})} className="input-light" placeholder="0 para ilimitado" />
                                <span className="text-[10px] text-slate-400">0 = Sem tempo limite</span>
                              </div>
                              <div>
                                <label className="form-label">Média para Aprovação</label>
                                <input type="number" min="0" max="10" step="0.5" value={questionario.nota_minima_aprovacao} onChange={e => setQuestionario({...questionario, nota_minima_aprovacao: parseFloat(e.target.value)})} className="input-light" />
                                <span className="text-[10px] text-slate-400">Escala de 0 a 10</span>
                              </div>
                          </div>
                      </div>
                  )}

                  {aba === 'questoes' && (
                      <div className="space-y-6 max-w-3xl mx-auto">
                          {questionario.questoes.map((q, qIndex) => (
                              <div key={qIndex} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                  <div className="flex justify-between items-start gap-4">
                                      <div className="flex-1 space-y-2">
                                          <div className="flex gap-2">
                                              <span className="font-bold text-slate-400 pt-3">#{qIndex + 1}</span>
                                              <textarea rows={2} placeholder="Enunciado da questão..." value={q.enunciado} onChange={e => atualizarQuestao(qIndex, 'enunciado', e.target.value)} className="input-light resize-none flex-1 font-medium text-slate-700" />
                                          </div>
                                          <div className="pl-6 flex items-center gap-2">
                                              <span className="text-xs font-bold text-slate-500">Peso / Valor:</span>
                                              <input type="number" min="0.1" step="0.1" value={q.valor} onChange={e => atualizarQuestao(qIndex, 'valor', e.target.value)} className="w-20 text-xs px-2 py-1 rounded border border-slate-200" />
                                          </div>
                                      </div>
                                      <button onClick={() => removerQuestao(qIndex)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
                                  </div>

                                  <div className="pl-6 space-y-2 pt-2 border-t border-slate-100">
                                      {q.opcoes.map((op: any, opIndex: number) => (
                                          <div key={opIndex} className={`flex items-center gap-3 p-2 rounded-xl border transition-colors ${op.is_correta ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                                              <button onClick={() => atualizarOpcao(qIndex, opIndex, 'is_correta', true)} className={`p-1 rounded-full transition-colors ${op.is_correta ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-400'}`}>
                                                  <CheckCircle2 className="w-5 h-5" />
                                              </button>
                                              <input type="text" placeholder={`Opção ${opIndex + 1}`} value={op.texto} onChange={e => atualizarOpcao(qIndex, opIndex, 'texto', e.target.value)} className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 font-medium" />
                                              <button onClick={() => removerOpcao(qIndex, opIndex)} className="p-1.5 text-slate-300 hover:text-red-500 rounded"><X className="w-4 h-4"/></button>
                                          </div>
                                      ))}
                                      <button onClick={() => addOpcao(qIndex)} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 py-2 px-2 hover:bg-indigo-50 rounded-lg transition-colors">
                                          <Plus className="w-3 h-3" /> Adicionar Opção
                                      </button>
                                  </div>
                              </div>
                          ))}

                          <button onClick={addQuestao} className="w-full py-4 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                              <Plus className="w-5 h-5"/> Adicionar Nova Questão
                          </button>
                      </div>
                  )}
                </>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end shrink-0">
            <button onClick={() => handleSave()} disabled={isSaving || isLoading} className="btn-primary px-8 h-12 shadow-md">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <span className="flex items-center gap-2"><Save className="w-4 h-4"/> Salvar Questionário</span>}
            </button>
        </div>
      </motion.div>
    </div>
  );
}
