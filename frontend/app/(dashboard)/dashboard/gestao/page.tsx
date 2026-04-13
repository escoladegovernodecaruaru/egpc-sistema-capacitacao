"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Search, MoreVertical, Edit, Trash2 } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Curso } from "@/types/cursos";
import { toast } from "sonner";
import Link from "next/link";

export default function GestaoCursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Note que aqui estamos buscando da mesma rota, mas no futuro 
  // criaremos uma rota /admin/cursos/ no Django para trazer até os inativos.
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

  return (
    <div className="space-y-6 animate-[fade-in_0.4s_ease-out]">
      
      {/* ── Cabeçalho e Ações ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gestão de Cursos</h1>
          <p className="text-sm text-slate-400 mt-1">Crie e administre o catálogo da Escola de Governo.</p>
        </div>
        
        {/* Futuro botão que vai abrir o modal/página de criação */}
        <button className="btn-primary sm:w-auto px-6 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Curso
        </button>
      </div>

      {/* ── Barra de Pesquisa ── */}
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar pelo código ou título do curso..." 
            className="input-dark pl-10 bg-white/[0.02]"
          />
        </div>
      </div>

      {/* ── Tabela de Cursos ── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/[0.02] border-b border-white/5 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Código</th>
                <th className="px-6 py-4 font-medium">Título do Curso</th>
                <th className="px-6 py-4 font-medium">Turmas</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando dados...</td>
                </tr>
              ) : cursos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum curso cadastrado no sistema.</td>
                </tr>
              ) : (
                cursos.map((curso) => (
                  <tr key={curso.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-300">{curso.codigo || "S/ COD"}</td>
                    <td className="px-6 py-4 font-medium text-slate-100">{curso.titulo}</td>
                    <td className="px-6 py-4 text-slate-400">{curso.turmas?.length || 0}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300">
                        {curso.status_geral}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}