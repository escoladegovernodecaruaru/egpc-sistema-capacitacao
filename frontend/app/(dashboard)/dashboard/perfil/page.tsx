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
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/[0.06]">
      <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/20 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary-light" />
      </div>
      <h2 className="text-[14px] font-semibold text-zinc-300">{title}</h2>
    </div>
  );
}

function ReadField({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">{label}</p>
      <p className={cn("text-[14px] text-zinc-200", mono && "font-mono tracking-wide", !value && "text-zinc-600 italic")}>
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
      <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)}
        className="input-dark w-full"
      />
    </div>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full",
      active
        ? "bg-success/10 text-success border border-success/20"
        : "bg-red-500/10 text-red-400 border border-red-500/20"
    )}>
      {active ? <BadgeCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}

const TIPO_COLOR: Record<string, string> = {
  SERVIDOR_ATIVO: "bg-secondary/10 text-secondary border-secondary/20",
  CIDADAO:        "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  TERCEIRIZADO:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ESTAGIARIO:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  INSTRUTOR:      "bg-primary/10 text-primary-light border-primary/20",
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

  // Sincroniza preview se a fotoUrl mudar externamente (ex: após refreshProfile)
  useEffect(() => {
    setPreview(fotoUrl);
  }, [fotoUrl]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl); // Preview imediato
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
      // Ao invés de atualizar só o preview local, notifica o contexto global
      await onUploadSuccess();
      toast.success("Foto atualizada com sucesso em todo o portal!");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(`Falha no upload: ${apiErr.message}`);
      setPreview(fotoUrl); // Reverte preview em caso de erro
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
        className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/[0.08]
                   hover:border-primary/50 transition-all duration-200 focus:outline-none
                   focus:ring-2 focus:ring-primary/40"
      >
        {preview ? (
          <Image src={preview} alt="Foto de perfil" fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full bg-primary/20 flex items-center justify-center
                          text-2xl font-bold text-primary-light">
            {nome.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity">
          {loading
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : <Camera className="w-5 h-5 text-white" />}
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary border-2
                      border-[var(--surface)] flex items-center justify-center pointer-events-none">
        <Camera className="w-3 h-3 text-white" />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PerfilPage() {
  // Usa o contexto compartilhado — sem fetch próprio
  const { profile, isLoading, refreshProfile } = useProfile();

  const [isSaving, setIsSaving] = useState(false);
  const [saved,    setSaved]    = useState(false);

  // Campos editáveis locais (inicializados e sincronizados com o contexto)
  const [nomeSocial,  setNomeSocial]  = useState("");
  const [telefone,    setTelefone]    = useState("");
  const [emailChefe,  setEmailChefe]  = useState("");

  // Sincroniza os campos locais quando o perfil carrega ou é atualizado
  useEffect(() => {
    if (profile) {
      setNomeSocial(profile.nome_social  || "");
      setTelefone(  profile.telefone     || "");
      setEmailChefe(profile.email_chefe  || "");
    }
  }, [profile]);

  const handleSalvar = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await fetchApi<Profile>("/users/auth/me/", {
        method:      "PATCH",
        requireAuth: true,
        body: JSON.stringify({
          nome_social:  nomeSocial  || null,
          telefone:     telefone.replace(/\D/g, "") || null,
          email_chefe:  emailChefe  || null,
        }),
      });
      // Notifica o contexto para re-fetch e propaga para Sidebar e outros consumidores
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
    emailChefe !== (profile?.email_chefe  || "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary-light animate-spin" />
          <p className="text-sm text-zinc-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }
  if (!profile) return null;

  const nomeExibido = profile.nome_social || profile.nome_completo;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Cabeçalho ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 flex items-start gap-5"
      >
        {/* Upload de avatar — ao terminar chama refreshProfile() */}
        <AvatarUpload
          nome={nomeExibido}
          fotoUrl={profile.foto_perfil_url}
          onUploadSuccess={refreshProfile}
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-zinc-100 truncate">{nomeExibido}</h1>
          {profile.nome_social && (
            <p className="text-[12px] text-zinc-500 mt-0.5">Nome completo: {profile.nome_completo}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full border",
              TIPO_COLOR[profile.tipo_usuario] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
            )}>
              <Briefcase className="w-3.5 h-3.5" />
              {profile.tipo_usuario_display}
            </span>
            <StatusBadge active={profile.is_active} label={profile.is_active ? "Conta ativa" : "Conta inativa"} />
            {profile.esta_bloqueado && (
              <StatusBadge active={false} label={`Suspenso até ${formatDate(profile.bloqueado_ate)}`} />
            )}
            {profile.esta_de_licenca && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full
                               bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />Em licença
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
        className="glass-card p-6"
      >
        <SectionTitle icon={User} title="Identificação" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
        className="glass-card p-6"
      >
        <SectionTitle icon={Phone} title="Contato e Dados Pessoais" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          className="glass-card p-6"
        >
          <SectionTitle icon={Building2} title="Dados Funcionais" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {profile.tipo_usuario === "SERVIDOR_ATIVO" && (
              <ReadField label="Matrícula funcional" value={profile.matricula} mono />
            )}
            {(profile.tipo_usuario === "TERCEIRIZADO" || profile.tipo_usuario === "ESTAGIARIO") && (
              <ReadField label="Empresa / Órgão" value={profile.empresa} />
            )}
            <ReadField label="Secretaria / Setor" value={profile.secretaria} />
            <EditField
              label="E-mail da chefia imediata"
              value={emailChefe}
              onChange={setEmailChefe}
              type="email"
              placeholder="chefia@orgao.gov.br"
            />
          </div>
        </motion.div>
      )}

      {/* ── Situação ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20 }}
        className="glass-card p-6"
      >
        <SectionTitle icon={ShieldCheck} title="Situação na Plataforma" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Confirmação de dados</p>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-zinc-600" />
              <p className="text-[14px] text-zinc-200">{formatDate(profile.data_ultima_confirmacao)}</p>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1">Reconfirmação necessária a cada 90 dias.</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Restrições</p>
            {!profile.esta_bloqueado && !profile.esta_de_licenca
              ? <p className="text-[13px] text-success mt-1">Nenhuma restrição ativa</p>
              : (
                <div className="space-y-1 mt-1">
                  {profile.esta_bloqueado  && <p className="text-[13px] text-red-400">• Suspenso até {formatDate(profile.bloqueado_ate)}</p>}
                  {profile.esta_de_licenca && <p className="text-[13px] text-amber-400">• Em período de licença</p>}
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
            className="sticky bottom-4 z-10"
          >
            <div className="glass-card p-3 flex items-center justify-between gap-3">
              <p className="text-[13px] text-zinc-400 pl-1">Alterações não salvas.</p>
              <button
                onClick={handleSalvar}
                disabled={isSaving}
                className={cn(
                  "btn-primary !py-2 !px-5 flex items-center gap-2",
                  saved && "!bg-success !border-success"
                )}
              >
                {isSaving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : saved
                    ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
                    : <><Save className="w-4 h-4" /> Salvar Alterações</>}
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
        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
      >
        <ClipboardList className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
        <p className="text-[11px] text-zinc-700 font-mono truncate">ID: {profile.id}</p>
      </motion.div>

    </div>
  );
}
