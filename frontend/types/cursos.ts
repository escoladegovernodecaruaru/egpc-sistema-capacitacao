export type StatusTurma = "PREVISTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA" | "CANCELADA" | "SEM_TURMAS";
export type TurnoTurma = "MANHA" | "TARDE" | "NOITE";

export interface EventoTurma {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  espaco: string;
  espaco_externo_nome: string;
}

export interface Turma {
  id: number;
  codigo: string;
  letra: string;
  local: string;
  turno: TurnoTurma;
  data_inicio: string | null;
  data_fim: string | null;
  carga_horaria: number;
  vagas: number;
  vagas_restantes?: number;
  instrutor_nome: string | null;
  status: StatusTurma;
  modalidade: string;
  eventos: EventoTurma[];
}

export interface Curso {
  id: number;
  codigo_oficial: string;
  titulo: string;
  ementa: string;
  eixo?: string;
  tipo: "CENTRALIZADO" | "DESCENTRALIZADO";
  status_geral: StatusTurma;
  turmas?: Turma[];
}

export type TurnoReserva = "MANHA" | "TARDE" | "NOITE";
export type StatusSolicitacao = "PENDENTE" | "APROVADA" | "RECUSADA" | "CANCELADA";

export interface ItemReserva {
  id?: string;
  espaco: string;
  data: string; // YYYY-MM-DD
  turno_reserva?: TurnoReserva;
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
}

export interface SolicitacaoReserva {
  id: string;
  solicitante_nome: string;
  titulo: string;
  descricao: string;
  status: StatusSolicitacao;
  protocolo: string;
  justificativa_recusa?: string;
  itens: ItemReserva[];
  criado_em: string;
}

export interface EventoAgenda {
  id: string;
  tipo: "AULA" | "RESERVA_AVULSA";
  titulo: string;
  data: string; // YYYY-MM-DD
  turno: TurnoReserva;
  local: string;
  hora_inicio?: string;
  hora_fim?: string;
  status: string;
}