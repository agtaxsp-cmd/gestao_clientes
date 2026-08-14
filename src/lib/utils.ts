import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove todos os caracteres não numéricos.
 */
export function cleanDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Formata um CNPJ no padrão 00.000.000/0000-00.
 * Aceita números com ou sem pontuação.
 */
export function formatCNPJ(value: string | null | undefined): string {
  if (!value) return '';
  const digits = cleanDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Formata um CNAE no padrão oficial 0000-0/00.
 * Aceita números com ou sem pontuação/barra.
 */
export function formatCNAE(value: string | null | undefined): string {
  if (!value) return '';
  const digits = cleanDigits(value).slice(0, 7);
  if (digits.length <= 4) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5, 7)}`;
}
