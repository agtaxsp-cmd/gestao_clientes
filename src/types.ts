export type RegimeEnum = 'regular' | 'especifico' | 'diferenciado';
export type SegmentoEnum = string;

export interface RegimeConfig {
  key: RegimeEnum;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  barColor: string;
  description: string;
}

export const REGIMES_CONFIG: Record<RegimeEnum, RegimeConfig> = {
  regular: {
    key: 'regular',
    label: 'Regime Regular (Normal)',
    shortLabel: 'Regime Regular',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    dotColor: 'bg-indigo-500',
    barColor: 'bg-indigo-500',
    description: 'Regime cumulativo / não-cumulativo padrão (Indústria, Comércio e Serviços)'
  },
  especifico: {
    key: 'especifico',
    label: 'Regimes Específicos (Apurações e Bases Próprias)',
    shortLabel: 'Regime Específico',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
    barColor: 'bg-purple-500',
    description: 'Apurações e bases de cálculo próprias'
  },
  diferenciado: {
    key: 'diferenciado',
    label: 'Regimes Diferenciados (Alíquotas Reduzidas ou Zero)',
    shortLabel: 'Regime Diferenciado',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    barColor: 'bg-emerald-500',
    description: 'Alíquotas reduzidas ou alíquota zero'
  }
};

export const SEGMENTOS_POR_REGIME: { regime: RegimeEnum; label: string; segmentos: string[] }[] = [
  {
    regime: 'regular',
    label: 'Regime Regular (Normal)',
    segmentos: [
      'Normal - Indústria Geral',
      'Normal - Comércio Geral',
      'Normal - Serviços em Geral'
    ]
  },
  {
    regime: 'especifico',
    label: 'Regimes Específicos (Apurações e Bases de Cálculo Próprias)',
    segmentos: [
      'Especifico - Combustíveis e Lubrificantes',
      'Especifico - Serviços Financeiros',
      'Especifico - Seguros e Resseguros',
      'Especifico - Previdência Complementar e Capitalização',
      'Especifico - Planos de Assistência à Saúde',
      'Especifico - Planos de Assistência Funerária',
      'Especifico - Operações Imobiliárias e Incorporação',
      'Especifico - Sociedades Cooperativas',
      'Especifico - Concursos de Prognósticos (Loterias e Apostas)',
      'Especifico - Hotelaria e Parques Temáticos',
      'Especifico - Transporte Coletivo de Passageiros',
      'Especifico - Agências de Turismo'
    ]
  },
  {
    regime: 'diferenciado',
    label: 'Regimes Diferenciados (Alíquotas Reduzidas ou Alíquota Zero)',
    segmentos: [
      'Diferenciado - Serviços de Saúde (Hospitais e Clínicas)',
      'Diferenciado - Serviços de Educação',
      'Diferenciado - Bares e Restaurantes',
      'Diferenciado - Profissionais Liberais (Sociedades Intelectuais)',
      'Diferenciado - Produtor Rural (Pessoa Física ou Jurídica)',
      'Diferenciado - Insumos Agropecuários e Aquícolas',
      'Diferenciado - Dispositivos Médicos e de Acessibilidade',
      'Diferenciado - Medicamentos e Produtos de Saúde Menstrual'
    ]
  }
];

export function getRegimeFromSegmento(segmento?: string | null): RegimeEnum {
  if (!segmento) return 'regular';
  if (segmento.startsWith('Especifico')) return 'especifico';
  if (segmento.startsWith('Diferenciado')) return 'diferenciado';
  return 'regular';
}

export type TipoContratoEnum = 'recorrente' | 'poc';
export type StatusPocEnum = 'em_andamento' | 'convertido' | 'perdido';

export interface Client {
  id: string;
  cnpj: string;
  nome_grupo?: string | null;
  razao_social: string;
  cnae_principal: string;
  segmento: string;
  regime: RegimeEnum;
  tipo_contrato?: TipoContratoEnum;
  status_poc?: StatusPocEnum | string;
  data_limite_poc?: string | null;
  data_kickoff?: string | null;
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
export type EtapaColorStatus = 'na' | 'em_andamento' | 'concluido' | 'pendente' | 'verde' | 'amarelo' | 'vermelho' | 'cinza';

export interface StepStatusConfig {
  key: 'na' | 'em_andamento' | 'concluido' | 'pendente';
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotBg: string;
}

export function normalizeStepStatus(status?: string | null): 'na' | 'em_andamento' | 'concluido' | 'pendente' {
  if (!status) return 'pendente';
  if (status === 'na' || status === 'nao_se_aplica') return 'na';
  if (status === 'em_andamento' || status === 'amarelo') return 'em_andamento';
  if (status === 'concluido' || status === 'verde') return 'concluido';
  if (status === 'vermelho') return 'em_andamento';
  return 'pendente';
}

export const STEP_STATUS_MAP: Record<'na' | 'em_andamento' | 'concluido' | 'pendente', StepStatusConfig> = {
  na: {
    key: 'na',
    label: 'Não se aplica',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    dotBg: 'bg-slate-400'
  },
  em_andamento: {
    key: 'em_andamento',
    label: 'Em andamento',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    dotBg: 'bg-amber-500'
  },
  concluido: {
    key: 'concluido',
    label: 'Concluído',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    dotBg: 'bg-emerald-500'
  },
  pendente: {
    key: 'pendente',
    label: 'Pendente',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    dotBg: 'bg-slate-400'
  }
};

export type FaseGrupoEnum = 'fase_1' | 'fase_2' | 'fase_3' | 'fase_poc';
export type FaseTabEnum = 'fase_1' | 'fase_2' | 'fase_3' | 'fase_poc' | 'cronograma';

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
  regime?: RegimeEnum | 'geral';
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
