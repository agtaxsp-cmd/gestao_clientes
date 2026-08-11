import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Search, Building, CheckCircle2, Clock, AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight, X, Minus, Loader2, ChevronDown, Filter, ChevronRight as ArrowRightIcon, Plus, Download, Upload, FileSpreadsheet, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { FiscalDocumentMatrix, StatusDocEnum, StatusGeralEnum } from '../types';
import { cn } from '../lib/utils';

const MESES = [
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

const DOC_KEYS: (keyof FiscalDocumentMatrix)[] = [
  'efd_icms_ipi',
  'efd_pis_cofins',
  'sped_ecd',
  'sped_ecf',
  'xml_nfe',
  'xml_cte',
  'xml_nfse'
];

const DOC_LABELS = ['EFD ICMS/IPI', 'EFD PIS/COFINS', 'SPED ECD', 'SPED ECF', 'XML NF-e', 'XML CT-e', 'XML NFS-e'];

const NEXT_STATUS: Record<StatusDocEnum, StatusDocEnum> = {
  compliant: 'pending',
  pending: 'critical',
  critical: 'na',
  na: 'compliant'
};

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

export default function Checklist() {
  const [viewMode, setViewMode] = useState<'sintetico' | 'analitico'>('sintetico');
  const [matrixData, setMatrixData] = useState<FiscalDocumentMatrix[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [anoBase, setAnoBase] = useState(2023);
  const [mesBase, setMesBase] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Modais
  const [showModalNovoRegistro, setShowModalNovoRegistro] = useState(false);
  const [tabModal, setTabModal] = useState<'individual' | 'massa'>('individual');

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

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('razao_social');

      if (clientErr) throw clientErr;
      setClients(clientsData || []);

      let query = supabase
        .from('fiscal_documents_matrix')
        .select('*')
        .eq('ano_base', anoBase);

      if (viewMode === 'analitico') {
        query = query.eq('mes_base', mesBase);
      }

      const { data: matrixRows, error: matErr } = await query;
      if (matErr) throw matErr;

      setMatrixData(matrixRows || []);
    } catch (err: any) {
      console.error('Erro ao carregar matriz de checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [anoBase, mesBase, viewMode]);

  const calcStatusGeral = (docs: StatusDocEnum[]): StatusGeralEnum => {
    if (docs.includes('critical')) return 'atraso';
    if (docs.includes('pending')) return 'pendente';
    // Se não houver nenhum arquivo marcado como entregue/conforme ('compliant'), o status geral é 'pendente'
    const compliantCount = docs.filter(d => d === 'compliant').length;
    if (compliantCount === 0) return 'pendente';
    return 'completo';
  };

  const toggleDocStatus = async (client_id: string, mes: number, docKey: keyof FiscalDocumentMatrix) => {
    const existing = matrixData.find(m => m.client_id === client_id && m.mes_base === mes);
    const currentVal = (existing ? existing[docKey] : 'na') as StatusDocEnum;
    const newVal = NEXT_STATUS[currentVal];

    const updatedItem = existing ? { ...existing, [docKey]: newVal } : {
      client_id,
      ano_base: anoBase,
      mes_base: mes,
      efd_icms_ipi: 'na',
      efd_pis_cofins: 'na',
      sped_ecd: 'na',
      sped_ecf: 'na',
      xml_nfe: 'na',
      xml_cte: 'na',
      xml_nfse: 'na',
      [docKey]: newVal
    };

    const values = DOC_KEYS.map(k => (updatedItem as any)[k] as StatusDocEnum);
    const newStatusGeral = calcStatusGeral(values);
    updatedItem.status_geral = newStatusGeral;

    setMatrixData(prev => {
      const idx = prev.findIndex(m => m.client_id === client_id && m.mes_base === mes);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedItem as FiscalDocumentMatrix;
        return copy;
      }
      return [...prev, updatedItem as FiscalDocumentMatrix];
    });

    try {
      const payload = {
        client_id,
        ano_base: anoBase,
        mes_base: mes,
        efd_icms_ipi: updatedItem.efd_icms_ipi,
        efd_pis_cofins: updatedItem.efd_pis_cofins,
        sped_ecd: updatedItem.sped_ecd,
        sped_ecf: updatedItem.sped_ecf,
        xml_nfe: updatedItem.xml_nfe,
        xml_cte: updatedItem.xml_cte,
        xml_nfse: updatedItem.xml_nfse,
        status_geral: newStatusGeral,
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('fiscal_documents_matrix')
        .upsert(payload, { onConflict: 'client_id,ano_base,mes_base' });

      if (upsertErr) throw upsertErr;

      const clientObj = clients.find(c => c.id === client_id);
      await logActivity({
        titulo: 'Status de Documento Alterado',
        descricao: `${clientObj?.razao_social || 'Cliente'} teve a obrigação ${docKey.toUpperCase()} alterada para ${newVal} (${mes}/${anoBase})`,
        tipo_log: 'sync',
        client_id,
        usuario_nome: 'Administrador'
      });
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      fetchMatrix();
    }
  };

  // Salvar cadastro individual
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

      // Auto-criar esteira se não existir para este cliente/período
      const { data: existingPipe } = await supabase
        .from('workflow_pipelines')
        .select('id')
        .eq('client_id', formClientId)
        .eq('ano_referencia', formAno)
        .eq('mes_referencia', formMes)
        .maybeSingle();

      if (!existingPipe) {
        await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: formClientId,
            status: 'iniciado',
            etapa_atual: 1,
            mensagem_info: 'Esteira iniciada automaticamente ao cadastrar checklist.',
            ano_referencia: formAno,
            mes_referencia: formMes,
            caminhos_rede_etapas: {},
            observacoes_etapas: {}
          });
      }

      setShowModalNovoRegistro(false);
      fetchMatrix();
      alert('Registro salvo com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar registro: ' + err.message);
    } finally {
      setSavingIndividual(false);
    }
  };

  // Baixar Modelo / Template Excel
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

  // Importar arquivo Excel / CSV em massa
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

      // Buscar todos os clientes para mapear CNPJ -> ID
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

        const ano = Number(row['Ano']) || anoBase;
        const mes = Number(row['Mês (1-12)'] || row['Mes (1-12)'] || row['Mês'] || row['Mes']) || mesBase;

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

      // Auto-criar esteiras para a importação em massa se não existirem
      for (const item of payloadList) {
        const { data: existingPipe } = await supabase
          .from('workflow_pipelines')
          .select('id')
          .eq('client_id', item.client_id)
          .eq('ano_referencia', item.ano_base)
          .eq('mes_referencia', item.mes_base)
          .maybeSingle();

        if (!existingPipe) {
          await supabase
            .from('workflow_pipelines')
            .insert({
              client_id: item.client_id,
              status: 'iniciado',
              etapa_atual: 1,
              mensagem_info: 'Esteira iniciada automaticamente via importação em massa.',
              ano_referencia: item.ano_base,
              mes_referencia: item.mes_base,
              caminhos_rede_etapas: {},
              observacoes_etapas: {}
            });
        }
      }

      if (upsertErr) throw upsertErr;

      setImportSuccessMsg(`Importação concluída! ${payloadList.length} registros processados com sucesso. ${ignoradosCount > 0 ? `(${ignoradosCount} CNPJs não encontrados no sistema foram ignorados)` : ''}`);
      fetchMatrix();
    } catch (err: any) {
      console.error('Erro na importação em massa:', err);
      alert('Falha ao processar arquivo: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: StatusDocEnum) => {
    switch (status) {
      case 'compliant': return <div className="p-0.5 rounded-full bg-emerald-100 text-emerald-600 cursor-pointer hover:scale-110 transition-transform"><CheckCircle2 className="w-4 h-4" /></div>;
      case 'pending': return <div className="p-0.5 rounded-full bg-amber-100 text-amber-600 animate-pulse cursor-pointer hover:scale-110 transition-transform"><Clock className="w-4 h-4" /></div>;
      case 'critical': return <div className="p-0.5 rounded-full bg-red-100 text-red-600 cursor-pointer hover:scale-110 transition-transform"><X className="w-4 h-4" /></div>;
      default: return <Minus className="w-4 h-4 text-slate-300 mx-auto cursor-pointer hover:text-slate-500" />;
    }
  };

  const filteredClients = clients.filter(c =>
    c.razao_social.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    (c.nome_grupo && c.nome_grupo.toLowerCase().includes(search.toLowerCase()))
  );

  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({ length: 18 }, (_, i) => 2018 + i);
  const customYearsFromData = matrixData.map(m => m.ano_base).filter(Boolean);
  const availableYears = Array.from(new Set([...defaultYears, anoBase, currentYear, ...customYearsFromData])).sort((a, b) => b - a);

  const getClientYearStatusSummary = (clientId: string) => {
    const clientRecords = matrixData.filter(m => m.client_id === clientId);
    if (clientRecords.length === 0) return 'pendente';
    if (clientRecords.some(m => m.status_geral === 'atraso')) return 'atraso';
    if (clientRecords.some(m => m.status_geral === 'pendente')) return 'pendente';
    if (clientRecords.length > 0 && clientRecords.every(m => m.status_geral === 'completo')) return 'completo';
    return 'pendente';
  };

  const getClientMonthStatus = (clientId: string, mes: number): StatusGeralEnum => {
    const rec = matrixData.find(m => m.client_id === clientId && m.mes_base === mes);
    return rec ? rec.status_geral : 'pendente';
  };

  const openAnaliticoForClient = (clientId: string, mesId?: number) => {
    setSelectedClientId(clientId);
    if (mesId) setMesBase(mesId);
    setViewMode('analitico');
  };

  return (
    <div className="flex flex-col w-full h-full relative p-2 gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-4 border-b border-slate-200">
        {/* Título e Descrição */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-600 tracking-widest uppercase">Módulo 3</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-500">Checklist Fiscal</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">Matriz de Documentos Fiscais</h1>
          <p className="text-slate-600 text-sm max-w-2xl mt-1">
            Análise consolidada por mês e ano. Alterne entre a **Visão Sintética Anual** e a **Visão Analítica Mensal**.
          </p>
        </div>

        {/* Barra de Controles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Botão Novo Registro */}
          <button
            onClick={() => setShowModalNovoRegistro(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Registro
          </button>

          {/* Separador visual */}
          <div className="w-px h-6 bg-slate-200 hidden md:block" />

          {/* Alternador de Visão */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('sintetico')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                viewMode === 'sintetico' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Visão Sintética (12 Meses)
            </button>
            <button
              onClick={() => setViewMode('analitico')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                viewMode === 'analitico' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Visão Analítica (Detalhada)
            </button>
          </div>

          {/* Separador visual */}
          <div className="w-px h-6 bg-slate-200 hidden md:block" />

          {/* Seletor Ano Dinâmico */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium text-slate-500">Ano:</span>
            <select
              value={anoBase}
              onChange={(e) => setAnoBase(Number(e.target.value))}
              className="text-sm font-semibold text-slate-900 bg-transparent outline-none cursor-pointer"
            >
              {availableYears.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>

          {/* Seletor Mês */}
          {viewMode === 'analitico' && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Mês:</span>
              <select
                value={mesBase}
                onChange={(e) => setMesBase(Number(e.target.value))}
                className="text-sm font-semibold text-slate-900 bg-transparent outline-none cursor-pointer"
              >
                {MESES.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Busca (empurrada para a direita) */}
          <div className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm ml-auto">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs text-slate-900 w-40 ml-2 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Total de Clientes</span>
            <h3 className="text-2xl font-bold text-slate-900">{filteredClients.length}</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Conformes</span>
            <h3 className="text-2xl font-bold text-slate-900">
              {filteredClients.filter(c => getClientYearStatusSummary(c.id) === 'completo').length}
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Com Pendências</span>
            <h3 className="text-2xl font-bold text-slate-900">
              {filteredClients.filter(c => getClientYearStatusSummary(c.id) === 'pendente').length}
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Críticos (Atraso)</span>
            <h3 className="text-2xl font-bold text-slate-900">
              {filteredClients.filter(c => getClientYearStatusSummary(c.id) === 'atraso').length}
            </h3>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          Carregando dados da matriz fiscal...
        </div>
      ) : viewMode === 'sintetico' ? (
        /* VISÃO SINTÉTICA */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Visão Sintética Anual ({anoBase}) — Clique em um mês para abrir o Analítico
            </span>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Conforme</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pendente</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Crítico</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-4 px-6 sticky left-0 bg-white shadow-[1px_0_0_rgba(0,0,0,0.05)] w-72">Razão Social / Cliente</th>
                  <th className="py-4 px-4">CNPJ</th>
                  {MESES.map(m => (
                    <th key={m.id} className="py-4 px-2 text-center w-14">
                      {m.sigla}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400">Nenhum cliente encontrado.</td>
                  </tr>
                ) : (
                  filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 sticky left-0 bg-inherit font-medium text-slate-900 shadow-[1px_0_0_rgba(0,0,0,0.03)] truncate max-w-[250px]">
                        {client.razao_social}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {client.cnpj}
                      </td>
                      {MESES.map(m => {
                        const st = getClientMonthStatus(client.id, m.id);
                        return (
                          <td 
                            key={m.id} 
                            className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => openAnaliticoForClient(client.id, m.id)}
                            title={`Abrir ${m.nome} para ${client.razao_social}`}
                          >
                            <span className={cn(
                              "inline-block w-4 h-4 rounded-full transition-transform hover:scale-125",
                              st === 'completo' && 'bg-emerald-500 shadow-sm',
                              st === 'pendente' && 'bg-amber-400 shadow-sm',
                              st === 'atraso' && 'bg-red-500 shadow-sm'
                            )} />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISÃO ANALÍTICA */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col gap-4 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Detalhamento Analítico</span>
              <h2 className="text-xl font-bold text-slate-900">
                {MESES.find(m => m.id === mesBase)?.nome} / {anoBase}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Filtrar por Cliente:</span>
              <select
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value || null)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 outline-none cursor-pointer"
              >
                <option value="">-- Todos os Clientes --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.razao_social}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <th className="py-3.5 px-6">Cliente</th>
                  <th className="py-3.5 px-4">CNPJ</th>
                  {DOC_LABELS.map((label, idx) => (
                    <th key={idx} className="py-3.5 px-2 text-center w-24">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{label.split(' ')[0]}</span>
                        <span className="text-xs font-bold text-slate-800">{label.split(' ')[1]}</span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3.5 px-6 text-right">Status Geral</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {(selectedClientId ? filteredClients.filter(c => c.id === selectedClientId) : filteredClients).map(client => {
                  const rec = matrixData.find(m => m.client_id === client.id && m.mes_base === mesBase);

                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        {client.razao_social}
                        <span className="block text-xs text-slate-400 font-normal">{client.nome_grupo || '-'}</span>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {client.cnpj}
                      </td>
                      {DOC_KEYS.map((docKey, i) => {
                        const statusVal = rec ? (rec[docKey] as StatusDocEnum) : 'na';
                        return (
                          <td 
                            key={i} 
                            className="py-4 px-2 text-center hover:bg-slate-100/80 transition-colors cursor-pointer"
                            onClick={() => toggleDocStatus(client.id, mesBase, docKey)}
                            title="Clique para alternar o status do documento"
                          >
                            <div className="flex justify-center">
                              {getStatusIcon(statusVal)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-4 px-6 text-right">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize",
                          rec?.status_geral === 'completo' && 'bg-emerald-100 text-emerald-700',
                          rec?.status_geral === 'pendente' && 'bg-amber-100 text-amber-700',
                          rec?.status_geral === 'atraso' && 'bg-red-100 text-red-700',
                          !rec && 'bg-slate-100 text-slate-600'
                        )}>
                          {rec?.status_geral || 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL NOVO REGISTRO / IMPORTAÇÃO */}
      {showModalNovoRegistro && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-slate-200 relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Novo Registro de Checklist Fiscal
              </h3>
              <button onClick={() => setShowModalNovoRegistro(false)} className="text-slate-400 hover:text-slate-600">
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
                /* TAB IMPORTAÇÃO EM MASSA */
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

                  {/* Alerta Sucesso */}
                  {importSuccessMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-medium flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>{importSuccessMsg}</div>
                    </div>
                  )}

                  {/* Dica de formato */}
                  <div className="text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">Valores aceitos nas colunas de obrigações:</p>
                    <p>• **Conforme / Entregue**: <code className="bg-slate-100 px-1 rounded text-slate-700">entregue</code>, <code className="bg-slate-100 px-1 rounded text-slate-700">compliant</code>, <code className="bg-slate-100 px-1 rounded text-slate-700">ok</code></p>
                    <p>• **Pendente**: <code className="bg-slate-100 px-1 rounded text-slate-700">pendente</code>, <code className="bg-slate-100 px-1 rounded text-slate-700">pending</code></p>
                    <p>• **Crítico / Atraso**: <code className="bg-slate-100 px-1 rounded text-slate-700">critico</code>, <code className="bg-slate-100 px-1 rounded text-slate-700">atrasado</code></p>
                    <p>• **Não Aplicável**: <code className="bg-slate-100 px-1 rounded text-slate-700">na</code> ou deixe em branco.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
