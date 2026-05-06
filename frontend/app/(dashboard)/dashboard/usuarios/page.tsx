"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Search, Filter, Edit, Shield, ShieldAlert, CheckCircle2, XCircle, Loader2, X, UserCog, Mail, Phone, Briefcase, ClipboardList, ToggleLeft, ToggleRight, Building2, Plus, Trash2, Save } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { mascaraTelefone } from "@/lib/validations";
import Image from "next/image";

export default function UsuariosPage() {
  const { profile } = useProfile();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros e Busca
  const [busca, setBusca] = useState("");
  const [filtroVinculo, setFiltroVinculo] = useState<string>("TODOS");

  // Modal de Edição
  const [userEdit, setUserEdit] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Gestão de Secretarias
  const [secretarias, setSecretarias] = useState<any[]>([]);
  const [aba, setAba] = useState<'usuarios' | 'secretarias'>('usuarios');
  const [novaSecretaria, setNovaSecretaria] = useState({ sigla: '', nome: '' });
  const [editandoSecretaria, setEditandoSecretaria] = useState<any | null>(null);
  const [salvandoSec, setSalvandoSec] = useState(false);

  const carregarSecretarias = async () => {
    try {
      const data = await fetchApi<any[]>('/users/secretarias/');
      setSecretarias(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleCriarSecretaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSecretaria.sigla || !novaSecretaria.nome) return toast.error('Preencha sigla e nome.');
    setSalvandoSec(true);
    try {
      await fetchApi('/users/secretarias/', { method: 'POST', body: JSON.stringify(novaSecretaria) });
      toast.success('Secretaria criada!');
      setNovaSecretaria({ sigla: '', nome: '' });
      carregarSecretarias();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar secretaria.');
    } finally { setSalvandoSec(false); }
  };

  const handleSalvarSecretaria = async (sec: any) => {
    setSalvandoSec(true);
    try {
      await fetchApi(`/users/secretarias/${sec.id}/`, { method: 'PATCH', body: JSON.stringify({ sigla: sec.sigla, nome: sec.nome }) });
      toast.success('Secretaria atualizada!');
      setEditandoSecretaria(null);
      carregarSecretarias();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally { setSalvandoSec(false); }
  };

  const handleRemoverSecretaria = async (id: number) => {
    if (!confirm('Desativar esta secretaria?')) return;
    try {
      await fetchApi(`/users/secretarias/${id}/`, { method: 'DELETE' });
      toast.success('Secretaria desativada.');
      carregarSecretarias();
    } catch (err: any) {
      toast.error(err.message || 'Erro.');
    }
  };

  const carregarUsuarios = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<any>("/users/admin/usuarios/");
      setUsuarios(Array.isArray(data) ? data : (data as any)?.results || []);
    } catch (err) {
      toast.error("Erro ao carregar lista de usuários.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.is_staff) {
      carregarUsuarios();
      carregarSecretarias();
    }
  }, [profile]);

  // Aplica os filtros localmente para ser instantâneo
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusca = u.nome_completo.toLowerCase().includes(busca.toLowerCase()) || u.cpf.includes(busca.replace(/\D/g, ''));
      const matchVinculo = filtroVinculo === "TODOS" || u.tipo_usuario === filtroVinculo;
      return matchBusca && matchVinculo;
    });
  }, [usuarios, busca, filtroVinculo]);

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEdit) return;

    setIsSaving(true);
    try {
      const payload: any = {
        nome_completo: userEdit.nome_completo,
        email: userEdit.email,
        tipo_usuario: userEdit.tipo_usuario,
        is_staff: userEdit.is_staff,
        is_active: userEdit.is_active,
        is_solicitante: userEdit.is_solicitante ?? false,
      };

      await fetchApi(`/users/admin/usuarios/${userEdit.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      toast.success("Usuário atualizado com sucesso!");
      setUserEdit(null);
      carregarUsuarios();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSolicitante = async (usuario: any) => {
    // Optimistic UI
    setUsuarios(prev =>
      prev.map(u => u.id === usuario.id ? { ...u, is_solicitante: !u.is_solicitante } : u)
    );
    try {
      const res = await fetchApi<{ is_solicitante: boolean; detail: string }>(
        `/users/admin/usuarios/${usuario.id}/toggle-solicitante/`,
        { method: "PATCH" }
      );
      toast.success(res.detail);
    } catch (err: any) {
      // Reverte se falhar
      setUsuarios(prev =>
        prev.map(u => u.id === usuario.id ? { ...u, is_solicitante: !u.is_solicitante } : u)
      );
      toast.error(err.message || "Erro ao alterar permissão.");
    }
  };

  const formatCpf = (cpf: string) => cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  if (!profile?.is_staff) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 mt-2">Apenas administradores podem acessar a gestão de usuários.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] w-full mx-auto text-slate-800 animate-[fade-in_0.4s_ease-out] pb-12">
      
      {/* ── HEADER ── */}
      <div className="clean-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Usuários</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Controle de acessos, permissões e cadastro da comunidade.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAba('usuarios')} className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${ aba === 'usuarios' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200' }`}>
            <Users className="w-4 h-4 inline mr-1" /> Usuários
          </button>
          <button onClick={() => setAba('secretarias')} className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${ aba === 'secretarias' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200' }`}>
            <Building2 className="w-4 h-4 inline mr-1" /> Secretarias
          </button>
        </div>
      </div>

      {/* ── ABA: SECRETARIAS ── */}
      {aba === 'secretarias' && (
        <div className="clean-card p-6 bg-white space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">Gerenciar Secretarias</h2>
          </div>
          {/* Formulário de criação */}
          <form onSubmit={handleCriarSecretaria} className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <input
              maxLength={15}
              placeholder="Sigla (ex: SAD)"
              value={novaSecretaria.sigla}
              onChange={e => setNovaSecretaria(p => ({ ...p, sigla: e.target.value.toUpperCase() }))}
              className="input-light w-32 font-mono font-bold uppercase"
            />
            <input
              placeholder="Nome completo da secretaria"
              value={novaSecretaria.nome}
              onChange={e => setNovaSecretaria(p => ({ ...p, nome: e.target.value }))}
              className="input-light flex-1"
            />
            <button type="submit" disabled={salvandoSec} className="btn-primary px-6 flex items-center gap-2 shrink-0">
              {salvandoSec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nova
            </button>
          </form>
          {/* Lista */}
          <div className="space-y-2">
            {secretarias.length === 0 && <p className="text-slate-400 text-sm text-center py-6">Nenhuma secretaria cadastrada.</p>}
            {secretarias.map(sec => (
              <div key={sec.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                {editandoSecretaria?.id === sec.id ? (
                  <>
                    <input maxLength={15} value={editandoSecretaria.sigla} onChange={e => setEditandoSecretaria((p: any) => ({ ...p, sigla: e.target.value.toUpperCase() }))} className="input-light w-28 font-mono font-bold uppercase text-sm" />
                    <input value={editandoSecretaria.nome} onChange={e => setEditandoSecretaria((p: any) => ({ ...p, nome: e.target.value }))} className="input-light flex-1 text-sm" />
                    <button onClick={() => handleSalvarSecretaria(editandoSecretaria)} disabled={salvandoSec} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      {salvandoSec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditandoSecretaria(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="font-mono font-black text-indigo-700 text-sm w-16">{sec.sigla}</span>
                    <span className="flex-1 text-sm text-slate-700">{sec.nome}</span>
                    <button onClick={() => setEditandoSecretaria({ ...sec })} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleRemoverSecretaria(sec.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABA: USUARIOS (filtros e tabela) ── */}
      {aba === 'usuarios' && (
        <>
      <div className="clean-card p-5 bg-white flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-light pl-10 border-transparent shadow-none focus:border-slate-200 bg-slate-50 w-full" 
          />
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select 
            value={filtroVinculo} 
            onChange={(e) => setFiltroVinculo(e.target.value)}
            className="input-light py-2 text-[13px] bg-slate-50 font-bold text-slate-600 min-w-[160px]"
          >
            <option value="TODOS">Todos os Vínculos</option>
            <option value="SERVIDOR_ATIVO">Servidor Ativo</option>
            <option value="CIDADAO">Cidadão</option>
            <option value="TERCEIRIZADO">Terceirizado</option>
            <option value="ESTAGIARIO">Estagiário</option>
            <option value="INSTRUTOR">Instrutor Oficial</option>
          </select>
        </div>
      </div>

      {/* ── TABELA DE USUÁRIOS ── */}
      <div className="clean-card overflow-hidden bg-white shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Usuário</th>
                <th className="px-6 py-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Contato</th>
                <th className="px-6 py-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Vínculo</th>
                <th className="px-6 py-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500 text-center">Permissões</th>
                <th className="px-6 py-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500 text-center">Solicitante</th>
                <th className="px-6 py-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">Nenhum usuário encontrado.</td></tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr key={u.id} className={cn("hover:bg-slate-50/50 transition-colors", !u.is_active && "opacity-60 bg-red-50/10")}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.foto_perfil_url ? (
                          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50">
                            <Image src={u.foto_perfil_url} alt={u.nome_completo} fill unoptimized className="object-cover" />
                          </div>
                        ) : (
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0", u.is_staff ? "bg-indigo-600" : "bg-slate-300")}>
                            {u.nome_completo.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800 text-[14px]">{u.nome_social || u.nome_completo}</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{formatCpf(u.cpf)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] text-slate-600 flex items-center gap-1.5 mb-1"><Mail className="w-3.5 h-3.5"/> {u.email}</p>
                      {u.telefone && <p className="text-[12px] text-slate-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> {mascaraTelefone(u.telefone)}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border", 
                        u.tipo_usuario === 'INSTRUTOR' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        u.tipo_usuario === 'SERVIDOR_ATIVO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      )}>
                        {u.tipo_usuario_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {u.is_staff ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded"><Shield className="w-3 h-3"/> ADMIN</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Padrão</span>
                        )}
                        {u.is_solicitante && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded"><ClipboardList className="w-3 h-3"/> SOLICITANTE</span>
                        )}
                        {!u.is_active && <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded"><XCircle className="w-3 h-3"/> BLOQUEADO</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleSolicitante(u)}
                        title={u.is_solicitante ? "Remover permissão de Solicitante" : "Conceder permissão de Solicitante"}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all mx-auto",
                          u.is_solicitante
                            ? "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
                            : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        {u.is_solicitante
                          ? <><ToggleRight className="w-4 h-4" /> Ativo</>
                          : <><ToggleLeft className="w-4 h-4" /> Inativo</>}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setUserEdit({...u})} title="Editar Usuário" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit className="w-5 h-5"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      </>
      )}

      {/* ── MODAL DE EDIÇÃO ── */}
      <AnimatePresence>
        {userEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><UserCog className="w-5 h-5 text-indigo-600"/> Editar Usuário</h2>
                  <p className="text-[12px] text-slate-500 font-mono mt-1">ID: {userEdit.id}</p>
                </div>
                <button onClick={() => setUserEdit(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
              </div>

              <form onSubmit={handleSalvarEdicao} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Info Imutável */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {userEdit.foto_perfil_url ? (
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-white">
                      <Image src={userEdit.foto_perfil_url} alt={userEdit.nome_completo} fill unoptimized className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xl shrink-0">
                      {userEdit.nome_completo.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-700">{userEdit.email}</p>
                    <p className="text-[12px] text-slate-500 font-mono">CPF: {formatCpf(userEdit.cpf)}</p>
                  </div>
                </div>

                {/* Campos Editáveis Básicos */}
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Nome Completo</label>
                    <input type="text" value={userEdit.nome_completo} onChange={e => setUserEdit({...userEdit, nome_completo: e.target.value})} className="input-light" required />
                  </div>
                  <div>
                    <label className="form-label">E-mail</label>
                    <input type="email" value={userEdit.email} onChange={e => setUserEdit({...userEdit, email: e.target.value})} className="input-light" required />
                  </div>
                  <div>
                    <label className="form-label">Vínculo (Tipo)</label>
                    <select value={userEdit.tipo_usuario} onChange={e => setUserEdit({...userEdit, tipo_usuario: e.target.value})} className="input-light font-bold text-slate-700">
                      <option value="CIDADAO">Cidadão</option>
                      <option value="SERVIDOR_ATIVO">Servidor Ativo</option>
                      <option value="TERCEIRIZADO">Terceirizado</option>
                      <option value="ESTAGIARIO">Estagiário</option>
                      <option value="INSTRUTOR">Instrutor Oficial</option>
                    </select>
                  </div>
                </div>

                {/* Permissões Avançadas */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="form-label text-indigo-600 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Zona de Perigo (Permissões)</label>
                  
                  <label className={cn("flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors", userEdit.is_staff ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200")}>
                    <input type="checkbox" checked={userEdit.is_staff} onChange={e => setUserEdit({...userEdit, is_staff: e.target.checked})} className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Acesso de Administrador (Staff)</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">Permite criar cursos, turmas, avaliar reservas de espaços e editar outros usuários do sistema.</p>
                    </div>
                  </label>

                  <label className={cn("flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors", userEdit.is_solicitante ? "bg-teal-50 border-teal-200" : "bg-white border-slate-200")}>
                    <input type="checkbox" checked={!!userEdit.is_solicitante} onChange={e => setUserEdit({...userEdit, is_solicitante: e.target.checked})} className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Permissão de Solicitante</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">Permite que este usuário solicite reservas de espaços institucionais (salas, laboratório, auditório).</p>
                    </div>
                  </label>

                  <label className={cn("flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors", !userEdit.is_active ? "bg-red-50 border-red-200" : "bg-white border-slate-200")}>
                    <input type="checkbox" checked={!userEdit.is_active} onChange={e => setUserEdit({...userEdit, is_active: !e.target.checked})} className="mt-1 w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Bloquear Acesso da Conta</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">Impede que este usuário consiga fazer login ou acessar qualquer recurso do portal imediatamente.</p>
                    </div>
                  </label>
                </div>

              </form>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setUserEdit(null)} className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="button" onClick={handleSalvarEdicao} disabled={isSaving} className="btn-primary !px-8 shadow-md">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : "Salvar Alterações"}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}