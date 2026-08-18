export type SegmentoEnum = 'industria' | 'comercio' | 'servico';

export interface Client {
  id: string;
  cnpj: string;
  nome_grupo?: string | null;
  razao_social: string;
  cnae_principal: string;
  segmento: SegmentoEnum;
  observacao?: string | null;
  ui_color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type StatusDocEnum = 'compliant' | 'pending' | 'critical' | 'na';
export type StatusGeralEnum = 'completo' | 'pendente' | 'atraso';

export interface FiscalDocumentMatrix {
  id: string;
  client_id: string;
  ano_base: number;
  mes_base: number;
  efd_icms_ipi: StatusDocEnum;
  efd_pis_cofins: StatusDocEnum;
  sped_ecd: StatusDocEnum;
  sped_ecf: StatusDocEnum;
  xml_nfe: StatusDocEnum;
  xml_cte: StatusDocEnum;
  xml_nfse: StatusDocEnum;
  status_geral: StatusGeralEnum;
  updated_at?: string;
  clients?: Client;
}

export type PipelineStatusEnum = 'iniciado' | 'em_andamento' | 'concluido' | 'bloqueado';
export type EtapaColorStatus = 'verde' | 'amarelo' | 'vermelho' | 'pendente';

export type FaseGrupoEnum = 'fase_1' | 'fase_2' | 'fase_3';
export type FaseTabEnum = 'fase_1' | 'fase_2' | 'fase_3' | 'cronograma';

export interface StepResponsibles {
  principal_id?: string | null;
  backup_id?: string | null;
}

export interface StepDates {
  data_inicio?: string | null;
  data_fim?: string | null;
}

export interface WorkflowPipeline {
  id: string;
  client_id: string;
  fase_grupo: FaseGrupoEnum;
  status: PipelineStatusEnum;
  etapa_atual: number;
  mensagem_info?: string | null;
  caminho_rede?: string | null;
  caminhos_rede_etapas?: Record<string, string> | null;
  observacoes_etapas?: Record<string, string> | null;
  responsaveis_etapas?: Record<string, StepResponsibles> | null;
  periodo_escopo?: string | null;
  start_as_is?: string | null;
  start_to_be?: string | null;
  status_etapas?: Record<string, EtapaColorStatus> | null;
  datas_etapas?: Record<string, StepDates> | null;
  responsaveis_multiplos_etapas?: Record<string, string[]> | null;
  fases_desabilitadas?: Record<string, boolean> | null;
  ano_referencia?: number | null;
  mes_referencia?: number | null;
  created_at?: string;
  updated_at?: string;
  clients?: Client;
}

export type FaseEnum =
  | 'outorga_sped'
  | 'outorga_apuracao_assistida'
  | 'coleta_documental'
  | 'processamento_as_is'
  | 'apresentacao_as_is'
  | 'processamento_to_be'
  | 'apresentacao_to_be'
  | 'elaborar'
  | 'acompanhamento'
  | 'auditoria'
  | string;

export interface WorkflowPhase {
  id: string;
  key: string;
  nome: string;
  ordem: number;
  grupo_fase: FaseGrupoEnum;
  color?: string;
  created_at?: string;
}

export interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  iniciais: string;
  ui_color_bg: string;
  ui_color_text: string;
  created_at?: string;
}

export interface WorkflowAssignment {
  id: string;
  fase_fluxo: FaseEnum;
  responsavel_principal_id?: string | null;
  responsavel_backup_id?: string | null;
  updated_at?: string;
  responsavel_principal?: TeamMember;
  responsavel_backup?: TeamMember;
}

export type LogTypeEnum = 'success' | 'error' | 'info' | 'sync';

export interface ActivityLog {
  id: string;
  client_id?: string | null;
  user_id?: string | null;
  usuario_nome?: string | null;
  lido?: boolean;
  tipo_log: LogTypeEnum;
  titulo: string;
  descricao: string;
  created_at: string;
  clients?: Client;
}
