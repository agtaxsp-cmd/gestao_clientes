import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, UserPlus, FileSpreadsheet, Download, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { StatusDocEnum, StatusGeralEnum } from '../types';
import { cn } from '../lib/utils';

const MESES = [
  { id: 1, nome: 'Janeiro' },
  { id: 2, nome: 'Fevereiro' },
  { id: 3, nome: 'Março' },
  { id: 4, nome: 'Abril' },
  { id: 5, nome: 'Maio' },
  { id: 6, nome: 'Junho' },
  { id: 7, nome: 'Julho' },
  { id: 8, nome: 'Agosto' },
  { id: 9, nome: 'Setembro' },
  { id: 10, nome: 'Outubro' },
  { id: 11, nome: 'Novembro' },
  { id: 12, nome: 'Dezembro' },
];

const STATUS_IMPORT_MAP: Record<string, StatusDocEnum> = {
  'entregue': 'compliant',
  'conforme': 'compliant',
  'compliant': 'compliant',
  'ok': 'compliant',
  'c': 'compliant',
  'pendente': 'pending',
  'pending': 'pending',
  'p': 'pending',
  'critico': 'critical',
  'crítico': 'critical',
  'atrasado': 'critical',
  'critical': 'critical',
  'x': 'critical',
  'na': 'na',
  'n/a': 'na',
  'não aplicável': 'na',
  'nao aplicavel': 'na'
};

interface NovoRegistroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function NovoRegistroModal({ isOpen, onClose, onSuccess }: NovoRegistroModalProps) {
  const [tabModal, setTabModal] = useState<'individual' | 'massa'>('individual');
  const [clients, setClients] = useState<any[]>([]);

  // Form Individual
  const [formClientId, setFormClientId] = useState('');
  const [formAno, setFormAno] = useState(2023);
  const [formMes, setFormMes] = useState(1);
  const [formEfdIcms, setFormEfdIcms] = useState<StatusDocEnum>('na');
  const [formEfdPis, setFormEfdPis] = useState<StatusDocEnum>('na');
  const [formSpedEcd, setFormSpedEcd] = useState<StatusDocEnum>('na');
  const [formSpedEcf, setFormSpedEcf] = useState<StatusDocEnum>('na');
  const [formXmlNfe, setFormXmlNfe] = useState<StatusDocEnum>('na');
  const [formXmlCte, setFormXmlCte] = useState<StatusDocEnum>('na');
  const [formXmlNfse, setFormXmlNfse] = useState<StatusDocEnum>('na');
  const [savingIndividual, setSavingIndividual] = useState(false);

  // Importação em Massa
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      supabase.from('clients').select('id, razao_social, cnpj').order('razao_social').then(({ data }) => {
        setClients(data || []);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calcStatusGeral = (docs: StatusDocEnum[]): StatusGeralEnum => {
    if (docs.includes('critical')) return 'atraso';
    if (docs.includes('pending')) return 'pendente';
    return 'completo';
  };

  const handleSaveIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      alert('Selecione um cliente.');
      return;
    }

    try {
      setSavingIndividual(true);
      const docs = [formEfdIcms, formEfdPis, formSpedEcd, formSpedEcf, formXmlNfe, formXmlCte, formXmlNfse];
      const statusGeral = calcStatusGeral(docs);

      const payload = {
        client_id: formClientId,
        ano_base: formAno,
        mes_base: formMes,
        efd_icms_ipi: formEfdIcms,
        efd_pis_cofins: formEfdPis,
        sped_ecd: formSpedEcd,
        sped_ecf: formSpedEcf,
        xml_nfe: formXmlNfe,
        xml_cte: formXmlCte,
        xml_nfse: formXmlNfse,
        status_geral: statusGeral,
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('fiscal_documents_matrix')
        .upsert(payload, { onConflict: 'client_id,ano_base,mes_base' });

      if (upsertErr) throw upsertErr;

      onClose();
      if (onSuccess) onSuccess();
      alert('Registro salvo com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar registro: ' + err.message);
    } finally {
      setSavingIndividual(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'CNPJ': '12.345.678/0001-90',
        'Ano': 2023,
        'Mês (1-12)': 1,
        'EFD ICMS/IPI': 'entregue',
        'EFD PIS/COFINS': 'entregue',
        'SPED ECD': 'pendente',
        'SPED ECF': 'na',
        'XML NF-e': 'entregue',
        'XML CT-e': 'na',
        'XML NFS-e': 'entregue'
      },
      {
        'CNPJ': '98.765.432/0001-12',
        'Ano': 2023,
        'Mês (1-12)': 2,
        'EFD ICMS/IPI': 'pendente',
        'EFD PIS/COFINS': 'pendente',
        'SPED ECD': 'critico',
        'SPED ECF': 'na',
        'XML NF-e': 'entregue',
        'XML CT-e': 'na',
        'XML NFS-e': 'na'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo_Checklist');
    XLSX.writeFile(workbook, 'Modelo_Importacao_Checklist_Fiscal.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportSuccessMsg(null);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

      if (!rows || rows.length === 0) {
        alert('O arquivo selecionado está vazio.');
        return;
      }

      const { data: allClients, error: clientErr } = await supabase.from('clients').select('id, cnpj');
      if (clientErr) throw clientErr;

      const clientMap = new Map((allClients || []).map(c => [c.cnpj.replace(/\D/g, ''), c.id]));
      const payloadList: any[] = [];
      let ignoradosCount = 0;

      rows.forEach(row => {
        const rawCnpj = String(row['CNPJ'] || '').replace(/\D/g, '');
        const clientId = clientMap.get(rawCnpj);

        if (!clientId) {
          ignoradosCount++;
          return;
        }

        const ano = Number(row['Ano']) || 2023;
        const mes = Number(row['Mês (1-12)'] || row['Mes (1-12)'] || row['Mês'] || row['Mes']) || 1;

        const parseStatus = (val: any): StatusDocEnum => {
          if (!val) return 'na';
          const clean = String(val).trim().toLowerCase();
          return STATUS_IMPORT_MAP[clean] || 'na';
        };

        const efdIcms = parseStatus(row['EFD ICMS/IPI']);
        const efdPis = parseStatus(row['EFD PIS/COFINS']);
        const spedEcd = parseStatus(row['SPED ECD']);
        const spedEcf = parseStatus(row['SPED ECF']);
        const xmlNfe = parseStatus(row['XML NF-e']);
        const xmlCte = parseStatus(row['XML CT-e']);
        const xmlNfse = parseStatus(row['XML NFS-e']);

        const docs = [efdIcms, efdPis, spedEcd, spedEcf, xmlNfe, xmlCte, xmlNfse];
        const statusGeral = calcStatusGeral(docs);

        payloadList.push({
          client_id: clientId,
          ano_base: ano,
          mes_base: mes,
          efd_icms_ipi: efdIcms,
          efd_pis_cofins: efdPis,
          sped_ecd: spedEcd,
          sped_ecf: spedEcf,
          xml_nfe: xmlNfe,
          xml_cte: xmlCte,
          xml_nfse: xmlNfse,
          status_geral: statusGeral,
          updated_at: new Date().toISOString()
        });
      });

      if (payloadList.length === 0) {
        alert('Nenhum registro correspondente a CNPJs cadastrados foi encontrado no arquivo.');
        return;
      }

      const { error: upsertErr } = await supabase
        .from('fiscal_documents_matrix')
        .upsert(payloadList, { onConflict: 'client_id,ano_base,mes_base' });

      if (upsertErr) throw upsertErr;

      setImportSuccessMsg(`Importação concluída! ${payloadList.length} registros processados. ${ignoradosCount > 0 ? `(${ignoradosCount} CNPJs não cadastrados foram ignorados)` : ''}`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Erro na importação em massa:', err);
      alert('Falha ao processar arquivo: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-slate-200 relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Novo Registro de Checklist Fiscal
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 p-1">
          <button
            onClick={() => setTabModal('individual')}
            className={cn(
              "flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
              tabModal === 'individual' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <UserPlus className="w-4 h-4" />
            Cadastro Individual
          </button>
          <button
            onClick={() => setTabModal('massa')}
            className={cn(
              "flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
              tabModal === 'massa' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importação em Massa (CSV / Excel)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {tabModal === 'individual' ? (
            <form onSubmit={handleSaveIndividual} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="text-xs font-medium text-slate-600">Cliente *</label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    required
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 outline-none"
                  >
                    <option value="" disabled>Selecione um cliente</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.razao_social} ({c.cnpj})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Ano *</label>
                  <input
                    type="number"
                    value={formAno}
                    onChange={(e) => setFormAno(Number(e.target.value))}
                    required
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Mês *</label>
                  <select
                    value={formMes}
                    onChange={(e) => setFormMes(Number(e.target.value))}
                    required
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 outline-none"
                  >
                    {MESES.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100 my-1" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status Inicial das Obrigações</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">EFD ICMS/IPI</label>
                  <select value={formEfdIcms} onChange={(e) => setFormEfdIcms(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">EFD PIS/COFINS</label>
                  <select value={formEfdPis} onChange={(e) => setFormEfdPis(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">SPED ECD</label>
                  <select value={formSpedEcd} onChange={(e) => setFormSpedEcd(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">SPED ECF</label>
                  <select value={formSpedEcf} onChange={(e) => setFormSpedEcf(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">XML NF-e</label>
                  <select value={formXmlNfe} onChange={(e) => setFormXmlNfe(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">XML CT-e</label>
                  <select value={formXmlCte} onChange={(e) => setFormXmlCte(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">XML NFS-e</label>
                  <select value={formXmlNfse} onChange={(e) => setFormXmlNfse(e.target.value as StatusDocEnum)} className="w-full h-9 px-2 border rounded-lg text-xs mt-1">
                    <option value="na">Não Aplicável</option>
                    <option value="compliant">Entregue / Conforme</option>
                    <option value="pending">Pendente</option>
                    <option value="critical">Crítico (Atraso)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingIndividual}
                className="mt-4 w-full h-10 bg-indigo-700 hover:bg-indigo-800 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingIndividual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Salvar Registro
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Passo 1: Download Template */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900 uppercase">Passo 1: Baixar Template Padrão</h4>
                  <p className="text-xs text-indigo-700/80 mt-0.5">
                    Faça o download do modelo `.xlsx` pré-formatado com as colunas necessárias.
                  </p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Baixar Modelo (.xlsx)
                </button>
              </div>

              {/* Passo 2: Upload do arquivo */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <FileSpreadsheet className="w-10 h-10 text-indigo-600" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Passo 2: Selecionar Arquivo Preenchido</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Suporta arquivos no formato **.xlsx**, **.xls** ou **.csv**.
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="mt-2 flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Processando Arquivo...' : 'Selecionar Arquivo'}
                </button>
              </div>

              {importSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>{importSuccessMsg}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
