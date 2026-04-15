"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, Building2, Briefcase,
  ShieldCheck, Calendar, ClipboardList,
  BadgeCheck, AlertTriangle, Loader2, Save,
  Camera, CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import { fetchApi, type ApiError } from "@/lib/api";
import { mascaraTelefone } from "@/lib/validations";
import { useProfile, type Profile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "long" });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-[15px] font-bold text-slate-800">{title}</h2>
    </div>
  );
}

function ReadField({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn("text-[14px] text-slate-800 font-medium", mono && "font-mono tracking-wide font-bold text-primary-dark", !value && "text-slate-400 italic")}>
        {value || "Não informado"}
      </p>
    </div>
  );
}

function EditField({
  label, value, onChange, type = "text", placeholder, mask,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; mask?: (v: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)}
        className="input-light w-full"
      />
    </div>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-lg",
      active
        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
        : "bg-red-50 text-red-600 border border-red-200"
    )}>
      {active ? <BadgeCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {label}
    </span>
  );
}

const TIPO_COLOR: Record<string, string> = {
  SERVIDOR_ATIVO: "bg-slate-100 text-slate-700 border-slate-200",
  CIDADAO:        "bg-slate-100 text-slate-600 border-slate-200",
  TERCEIRIZADO:   "bg-warning/10 text-warning border-warning/20",
  ESTAGIARIO:     "bg-purple-50 text-purple-600 border-purple-200",
  INSTRUTOR:      "bg-primary/10 text-primary-dark border-primary/20",
};

// ─── Avatar com Upload ────────────────────────────────────────────────────────

function AvatarUpload({
  nome, fotoUrl, onUploadSuccess,
}: {
  nome: string; fotoUrl: string | null; onUploadSuccess: () => Promise<void>;
}) {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(fotoUrl);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPreview(fotoUrl);
  }, [fotoUrl]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);

    const formData = new FormData();
    formData.append("foto", file);

    try {
      await fetchApi<{ foto_url: string }>("/users/auth/foto/", {
        method:      "POST",
        requireAuth: true,
        isFormData:  true,
        body:        formData,
      });
      await onUploadSuccess();
      toast.success("Foto atualizada com sucesso em todo o portal!");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(`Falha no upload: ${apiErr.message}`);
      setPreview(fotoUrl);
    } finally {
      setLoading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title="Trocar foto de perfil"
        className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-sm
                   hover:border-primary-light transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/20"
      >
        {preview ? (
          <Image src={preview} alt="Foto de perfil" fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center
                          text-2xl font-black text-primary">
            {nome.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity">
          {loading
            ? <Loader2 className="w-6 h-6 text-white animate-spin" />
            : <Camera className="w-6 h-6 text-white" />}
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center pointer-events-none">
        <Camera className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { profile, isLoading, refreshProfile } = useProfile();

  const [isSaving, setIsSaving] = useState(false);
  const [saved,    setSaved]    = useState(false);

  const [nomeSocial,  setNomeSocial]  = useState("");
  const [telefone,    setTelefone]    = useState("");
  const [cpfChefe,    setCpfChefe]    = useState("");

  useEffect(() => {
    if (profile) {
      setNomeSocial(profile.nome_social  || "");
      setTelefone(  profile.telefone     || "");
      
      let initialCpfChefe = profile.cpf_chefe || "";
      // Tratamento de dados legados: se contiver letras ou @ (ex: email), ignora
      if (/[a-zA-Z@]/.test(initialCpfChefe)) {
        initialCpfChefe = "";
      } else if (initialCpfChefe) {
        initialCpfChefe = require("@/lib/validations").mascaraCPF(initialCpfChefe);
      }
      setCpfChefe(initialCpfChefe);
    }
  }, [profile]);

  const handleSalvar = async () => {
    const cpfChefeLimpo = cpfChefe.replace(/\D/g, "");
    if (cpfChefeLimpo && (cpfChefeLimpo.length !== 11 || !require("@/lib/validations").validarCPF(cpfChefeLimpo))) {
      return toast.error("CPF da chefia inválido.");
    }

    setIsSaving(true);
    setSaved(false);
    try {
      await fetchApi<Profile>("/users/auth/me/", {
        method:      "PATCH",
        requireAuth: true,
        body: JSON.stringify({
          nome_social:  nomeSocial  || null,
          telefone:     telefone.replace(/\D/g, "") || null,
          cpf_chefe:    cpfChefeLimpo || null,
        }),
      });
      await refreshProfile();
      setSaved(true);
      toast.success("Alterações salvas com sucesso!");
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const temAlteracoes =
    nomeSocial !== (profile?.nome_social  || "") ||
    telefone   !== (profile?.telefone     || "") ||
    cpfChefe   !== (profile?.cpf_chefe    || "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-slate-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }
  if (!profile) return null;

  const nomeExibido = profile.nome_social || profile.nome_completo;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">

      {/* ── Cabeçalho ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="clean-card p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left"
      >
        <AvatarUpload
          nome={nomeExibido}
          fotoUrl={profile.foto_perfil_url}
          onUploadSuccess={refreshProfile}
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-slate-800 truncate">{nomeExibido}</h1>
          {profile.nome_social && (
            <p className="text-[13px] font-medium text-slate-500 mt-1">Nome completo: {profile.nome_completo}</p>
          )}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mt-4">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border",
              TIPO_COLOR[profile.tipo_usuario] || "bg-slate-50 text-slate-600 border-slate-200"
            )}>
              <Briefcase className="w-4 h-4" />
              {profile.tipo_usuario_display}
            </span>
            <StatusBadge active={profile.is_active} label={profile.is_active ? "Conta ativa" : "Conta inativa"} />
            {profile.esta_bloqueado && (
              <StatusBadge active={false} label={`Suspenso até ${formatDate(profile.bloqueado_ate)}`} />
            )}
            {profile.esta_de_licenca && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg
                               bg-amber-50 text-amber-600 border border-amber-200">
                <AlertTriangle className="w-4 h-4" />Em licença
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Identificação (somente leitura) ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="clean-card p-6 md:p-8"
      >
        <SectionTitle icon={User} title="Identificação Oficial" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ReadField label="Nome completo" value={profile.nome_completo} />
          <ReadField label="CPF"           value={formatCpf(profile.cpf)} mono />
          <ReadField label="E-mail"        value={profile.email} />
          <ReadField label="Membro desde"  value={formatDate(profile.criado_em)} />
        </div>
      </motion.div>

      {/* ── Campos editáveis ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.10 }}
        className="clean-card p-6 md:p-8"
      >
        <SectionTitle icon={Phone} title="Contato e Preferências" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EditField
            label="Nome social (como prefere ser chamado)"
            value={nomeSocial}
            onChange={setNomeSocial}
            placeholder="Deixe em branco para usar o nome completo"
          />
          <EditField
            label="Telefone celular"
            value={telefone}
            onChange={setTelefone}
            placeholder="(00) 90000-0000"
            mask={mascaraTelefone}
          />
        </div>
      </motion.div>

      {/* ── Dados funcionais ────────────────────────────────────────── */}
      {profile.tipo_usuario !== "CIDADAO" && (
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.15 }}
           className="clean-card p-6 md:p-8"
        >
          <SectionTitle icon={Building2} title="Dados Institucionais" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {profile.tipo_usuario === "SERVIDOR_ATIVO" && (
              <ReadField label="Matrícula funcional" value={profile.matricula} mono />
            )}
            {(profile.tipo_usuario === "TERCEIRIZADO" || profile.tipo_usuario === "ESTAGIARIO") && (
              <ReadField label="Empresa / Órgão" value={profile.empresa} />
            )}
            <ReadField label="Secretaria / Setor" value={profile.secretaria} />
            <EditField
              label="CPF da chefia imediata"
              value={cpfChefe}
              onChange={setCpfChefe}
              type="text"
              placeholder="000.000.000-00"
              mask={require("@/lib/validations").mascaraCPF}
            />
          </div>
        </motion.div>
      )}

      {/* ── Situação ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20 }}
        className="clean-card p-6 md:p-8"
      >
        <SectionTitle icon={ShieldCheck} title="Situação de Compliance" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1.5 border border-slate-100 rounded-xl p-4 bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirmação de dados</p>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <p className="text-[14px] font-bold text-slate-700">{formatDate(profile.data_ultima_confirmacao)}</p>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">É necessário reconfirmar os dados a cada semestre para validade de certificados.</p>
          </div>
          <div className="space-y-1.5 border border-slate-100 rounded-xl p-4 bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Restrições na Escola</p>
            {!profile.esta_bloqueado && !profile.esta_de_licenca
               ? <div className="flex items-center gap-2 mt-2"><CheckCircle2 className="w-5 h-5 text-emerald-500"/><p className="text-[14px] font-bold text-slate-700">Tudo limpo, sem bloqueios</p></div>
              : (
                <div className="space-y-1 mt-2">
                  {profile.esta_bloqueado  && <p className="text-[13px] font-bold text-red-500">• Suspenso até {formatDate(profile.bloqueado_ate)}</p>}
                  {profile.esta_de_licenca && <p className="text-[13px] font-bold text-amber-500">• Em período de licença</p>}
                </div>
              )}
          </div>
        </div>
      </motion.div>

      {/* ── Botão Salvar sticky ──────────────────────────────────────── */}
      <AnimatePresence>
        {temAlteracoes && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 right-6 lg:right-12 z-40"
          >
            <div className="bg-white shadow-xl shadow-indigo-900/10 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-6">
              <p className="text-sm font-bold text-slate-600 pl-2">Você tem alterações não salvas.</p>
              <button
                onClick={handleSalvar}
                disabled={isSaving}
                className={cn(
                  "btn-primary !px-6 flex items-center gap-2 shadow-lg",
                  saved && "!bg-success"
                )}
              >
                {isSaving
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : saved
                    ? <><CheckCircle2 className="w-5 h-5" /> Salvo!</>
                    : <><Save className="w-5 h-5" /> Salvar Tudo</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ID técnico */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex items-center gap-2 px-5 py-4 rounded-xl bg-slate-100 border border-slate-200 justify-center"
      >
        <ClipboardList className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-[12px] text-slate-500 font-mono font-bold truncate">Registro Único Institucional: {profile.id}</p>
      </motion.div>

    </div>
  );
}
