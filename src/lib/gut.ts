import { GutCriticityLevel } from '../types';

export function calculateGutScore(gravidade: number, urgencia: number, tendencia: number): number {
  const g = Math.min(5, Math.max(1, Number(gravidade) || 1));
  const u = Math.min(5, Math.max(1, Number(urgencia) || 1));
  const t = Math.min(5, Math.max(1, Number(tendencia) || 1));
  return g * u * t;
}

export interface GutCriticityConfig {
  level: GutCriticityLevel;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  textColor: string;
  description: string;
}

export function getGutCriticity(score: number): GutCriticityConfig {
  if (score >= 80) {
    return {
      level: 'critica',
      label: 'Crítico',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      badgeBorder: 'border-rose-200',
      dotColor: 'bg-rose-600',
      textColor: 'text-rose-600',
      description: 'Ação imediata requerida. Alto risco de impacto no cliente.'
    };
  }
  if (score >= 50) {
    return {
      level: 'alta',
      label: 'Alta',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-600',
      description: 'Prioridade elevada. Solucionar no curto prazo.'
    };
  }
  if (score >= 25) {
    return {
      level: 'media',
      label: 'Média',
      badgeBg: 'bg-indigo-50',
      badgeText: 'text-indigo-700',
      badgeBorder: 'border-indigo-200',
      dotColor: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      description: 'Prioridade normal de atendimento.'
    };
  }
  return {
    level: 'baixa',
    label: 'Baixa',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    description: 'Pode ser planejada conforme conveniência.'
  };
}

export const GUT_DESCRIPTIONS = {
  gravidade: {
    1: 'Sem gravidade / Impacto irrelevante',
    2: 'Pouco grave / Pequeno incômodo',
    3: 'Grave / Dano moderado reversível',
    4: 'Muito grave / Prejuízo significativo',
    5: 'Extremamente grave / Perda irreparável ou risco fiscal/legal'
  },
  urgencia: {
    1: 'Pode esperar / Sem pressão de prazo',
    2: 'Pouco urgente / Prazo elástico',
    3: 'Urgente / Exige ação em prazo padrão',
    4: 'Muito urgente / Prazo apertado, resolver logo',
    5: 'Imediata / Exige intervenção agora sem demora'
  },
  tendencia: {
    1: 'Não vai mudar / Estável se nada for feito',
    2: 'Piora lenta a longo prazo',
    3: 'Piora progressiva a médio prazo',
    4: 'Piora rápida em poucos dias',
    5: 'Piora imediata e exponencial se nada for feito'
  }
} as const;
