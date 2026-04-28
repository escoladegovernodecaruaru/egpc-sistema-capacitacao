/**
 * labels.ts — Tradução centralizada de enums do backend para exibição na UI.
 * Evita strings brutas como "EM_ANDAMENTO" ou "GESTAO_PUBLICA" espalhadas nos componentes.
 */

export const STATUS_TURMA_LABEL: Record<string, string> = {
  EM_ANDAMENTO: "Em Andamento",
  PREVISTA:     "Prevista",
  CONCLUIDA:    "Concluída",
  ADIADA:       "Adiada",
  CANCELADA:    "Cancelada",
  SEM_TURMAS:   "Sem Turmas",
};

export const MODALIDADE_LABEL: Record<string, string> = {
  PRESENCIAL: "Presencial",
  REMOTO:     "EAD (Assíncrono)",
  HIBRIDO:    "Híbrido",
};

export const EIXO_LABEL: Record<string, string> = {
  GESTAO_PUBLICA:       "Gestão Pública",
  TECNOLOGIA:           "Tecnologia",
  TECNICO_ESPECIALIZADO:"Técnico Especializado",
  RELACOES_HUMANAS:     "Relações Humanas",
};

export const TIPO_CURSO_LABEL: Record<string, string> = {
  CENTRALIZADO:    "Centralizado",
  DESCENTRALIZADO: "Descentralizado",
};

export const STATUS_INSCRICAO_LABEL: Record<string, string> = {
  pendente:         "Pendente",
  aprovado_chefia:  "Aprov. Chefia",
  inscrito:         "Inscrito",
  concluido:        "Concluído",
  reprovado:        "Reprovado",
  cancelado:        "Cancelado",
};

export const STATUS_SOLICITACAO_LABEL: Record<string, string> = {
  PENDENTE:  "Em Análise",
  APROVADA:  "Aprovada",
  RECUSADA:  "Recusada",
  CANCELADA: "Cancelada",
};

export const TURNO_LABEL: Record<string, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
  NOITE: "Noite",
};

/** Retorna o label traduzido, ou o próprio valor se não encontrado */
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}
