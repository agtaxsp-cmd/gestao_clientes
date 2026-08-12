export type SegmentoEnum = 'industria' | 'comercio' | 'servico';

export interface Client {
  id: string;
  cnpj: string;
  nome_grupo?: string | null;
  razao_social: string;
  cnae_principal: string;
  segmento: SegmentoEnum;
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

export interface StepResponsibles {
  principal_id?: string | null;
  backup_id?: string | null;
}

export interface WorkflowPipeline {
  id: string;
  client_id: string;
  status: PipelineStatusEnum;
  etapa_atual: number;
  mensagem_info?: string | null;
  caminho_rede?: string | null;
  caminhos_rede_etapas?: Record<string, string> | null;
  observacoes_etapas?: Record<string, string> | null;
  responsaveis_etapas?: Record<string, StepResponsibles> | null;
  ano_referencia: number;
  mes_referencia?: number;
  created_at?: string;
  updated_at?: string;
  clients?: Client;
}

export type FaseEnum = 'coleta_arquivos' | 'calculadora_rtc' | 'compliance_rtc' | 'apuracao_assistida' | 'entrega_apresentacao' | string;

export interface WorkflowPhase {
  id: string;
  key: string;
  nome: string;
  ordem: number;
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
