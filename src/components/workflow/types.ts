export interface MonthItem {
  id: number;
  nome: string;
  sigla: string;
}

export const MESES: MonthItem[] = [
  { id: 1, nome: 'Janeiro', sigla: 'Jan' },
  { id: 2, nome: 'Fevereiro', sigla: 'Fev' },
  { id: 3, nome: 'Março', sigla: 'Mar' },
  { id: 4, nome: 'Abril', sigla: 'Abr' },
  { id: 5, nome: 'Maio', sigla: 'Mai' },
  { id: 6, nome: 'Junho', sigla: 'Jun' },
  { id: 7, nome: 'Julho', sigla: 'Jul' },
  { id: 8, nome: 'Agosto', sigla: 'Ago' },
  { id: 9, nome: 'Setembro', sigla: 'Set' },
  { id: 10, nome: 'Outubro', sigla: 'Out' },
  { id: 11, nome: 'Novembro', sigla: 'Nov' },
  { id: 12, nome: 'Dezembro', sigla: 'Dez' },
];
