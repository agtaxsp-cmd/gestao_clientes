import React, { useState, useEffect } from 'react';
import { Building2, Save, Lightbulb, Filter, Pencil, Hash, Trash2, Loader2, Tag, Compass, FileCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { 
  Client, 
  REGIMES_CONFIG, 
  SEGMENTOS_POR_REGIME, 
  getRegimeFromSegmento, 
  RegimeEnum 
} from '../types';
import { formatCNPJ, formatCNAE, cleanDigits } from '../lib/utils';

export default function Clientes() {
  const { getUserName } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnaePrincipal, setCnaePrincipal] = useState('');
  const [segmento, setSegmento] = useState<string>('');
  const [observacao, setObservacao] = useState('');
  const [fasesContratadas, setFasesContratadas] = useState<{ fase_1: boolean; fase_2: boolean; fase_3: boolean }>({
    fase_1: true,
    fase_2: true,
    fase_3: true
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setClients(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar clientes:', err);
      setError('Falha ao carregar lista de clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedCnpj = formatCNPJ(cnpj);
    const formattedCnae = formatCNAE(cnaePrincipal);
    const cnpjDigits = cleanDigits(formattedCnpj);
    const cnaeDigits = cleanDigits(formattedCnae);

    if (!cnpjDigits || !razaoSocial.trim() || !cnaeDigits || !segmento) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (cnpjDigits.length !== 14) {
      alert('CNPJ inválido: o CNPJ deve conter exatamente 14 dígitos.');
      return;
    }

    if (cnaeDigits.length !== 7) {
      alert('CNAE inválido: o CNAE deve conter exatamente 7 dígitos.');
      return;
    }

    const computedRegime = getRegimeFromSegmento(segmento);
    const fasesDesabilitadasObj = {
      fase_1: !fasesContratadas.fase_1,
      fase_2: !fasesContratadas.fase_2,
      fase_3: !fasesContratadas.fase_3
    };

    try {
      setSaving(true);
      if (editingId) {
        const { error: updateErr } = await supabase
          .from('clients')
          .update({
            cnpj: formattedCnpj,
            nome_grupo: nomeGrupo.trim() || null,
            razao_social: razaoSocial.trim(),
            cnae_principal: formattedCnae,
            segmento: segmento.trim(),
            regime: computedRegime,
            observacao: observacao.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (updateErr) throw updateErr;

        // Atualizar fases desabilitadas no pipeline de workflow
        const { data: existingPipe } = await supabase
          .from('workflow_pipelines')
          .select('id, fases_desabilitadas')
          .eq('client_id', editingId)
          .eq('fase_grupo', 'fase_1')
          .maybeSingle();

        if (existingPipe) {
          await supabase
            .from('workflow_pipelines')
            .update({ fases_desabilitadas: fasesDesabilitadasObj, updated_at: new Date().toISOString() })
            .eq('id', existingPipe.id);
        } else {
          await supabase
            .from('workflow_pipelines')
            .insert({
              client_id: editingId,
              fase_grupo: 'fase_1',
              status: 'iniciado',
              etapa_atual: 1,
              mensagem_info: 'Fase 1 - Diagnóstico iniciada automaticamente.',
              fases_desabilitadas: fasesDesabilitadasObj
            });
        }

        await logActivity({
          titulo: 'Cliente Atualizado',
          descricao: `Os dados e fases contratadas do cliente ${razaoSocial.trim()} (CNPJ: ${formattedCnpj}) foram atualizados`,
          tipo_log: 'info',
          client_id: editingId,
          usuario_nome: getUserName()
        });
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('clients')
          .insert({
            cnpj: formattedCnpj,
            nome_grupo: nomeGrupo.trim() || null,
            razao_social: razaoSocial.trim(),
            cnae_principal: formattedCnae,
            segmento: segmento.trim(),
            regime: computedRegime,
            observacao: observacao.trim() || null
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        if (inserted?.id) {
          const { error: pipeErr } = await supabase
            .from('workflow_pipelines')
            .insert({
              client_id: inserted.id,
              fase_grupo: 'fase_1',
              status: 'iniciado',
              etapa_atual: 1,
              mensagem_info: 'Fase 1 - Diagnóstico iniciada automaticamente ao cadastrar cliente.',
              mes_referencia: null,
              caminhos_rede_etapas: {},
              observacoes_etapas: {},
              fases_desabilitadas: fasesDesabilitadasObj
            });

          if (pipeErr) console.error('Erro ao criar esteira automática:', pipeErr);
        }

        await logActivity({
          titulo: 'Cliente Cadastrado',
          descricao: `Novo cliente ${razaoSocial.trim()} (CNPJ: ${formattedCnpj}) cadastrado com esteira de fases configurada`,
          tipo_log: 'success',
          client_id: inserted?.id,
          usuario_nome: getUserName()
        });
      }

      resetForm();
      fetchClients();
    } catch (err: unknown) {
      console.error('Erro ao salvar cliente:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert('Erro ao salvar cliente: ' + (msg || 'Verifique os dados'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (client: Client) => {
    setEditingId(client.id);
    setCnpj(formatCNPJ(client.cnpj));
    setNomeGrupo(client.nome_grupo || '');
    setRazaoSocial(client.razao_social);
    setCnaePrincipal(formatCNAE(client.cnae_principal));
    setSegmento(client.segmento);
    setObservacao(client.observacao || '');

    // Buscar fases desabilitadas existentes no pipeline
    const { data: pipe } = await supabase
      .from('workflow_pipelines')
      .select('fases_desabilitadas')
      .eq('client_id', client.id)
      .eq('fase_grupo', 'fase_1')
      .maybeSingle();

    const dis = (pipe?.fases_desabilitadas || {}) as Record<string, boolean>;
    setFasesContratadas({
      fase_1: !dis['fase_1'],
      fase_2: !dis['fase_2'],
      fase_3: !dis['fase_3']
    });
  };

  const handleDelete = async (id: string) => {
    const clientObj = clients.find(c => c.id === id);
    if (!confirm(`Tem certeza que deseja excluir o cliente ${clientObj?.razao_social || ''}?`)) return;
    try {
      const { error: delErr } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;

      await logActivity({
        titulo: 'Cliente Removido',
        descricao: `O cliente ${clientObj?.razao_social || ''} foi excluído do sistema`,
        tipo_log: 'error',
        usuario_nome: getUserName()
      });

      fetchClients();
    } catch (err: any) {
      console.error('Erro ao deletar cliente:', err);
      alert('Erro ao deletar cliente: ' + err.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCnpj('');
    setNomeGrupo('');
    setRazaoSocial('');
    setCnaePrincipal('');
    setSegmento('');
    setObservacao('');
    setFasesContratadas({ fase_1: true, fase_2: true, fase_3: true });
  };

  const filteredClients = clients.filter(c => {
    const searchLower = search.toLowerCase();
    const regimeKey = c.regime || getRegimeFromSegmento(c.segmento);
    const regimeLabel = REGIMES_CONFIG[regimeKey as RegimeEnum]?.shortLabel || '';
    
    return (
      c.razao_social.toLowerCase().includes(searchLower) ||
      c.cnpj.includes(search) ||
      (c.nome_grupo && c.nome_grupo.toLowerCase().includes(searchLower)) ||
      c.segmento.toLowerCase().includes(searchLower) ||
      regimeLabel.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="flex flex-col w-full gap-8 relative">
      <div>
        <h1 className="text-[32px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">Gestão de Clientes</h1>
        <p className="text-slate-600 text-base max-w-3xl">
          Cadastre e gerencie a carteira de clientes categorizada por <strong>Regime Tributário</strong> e <strong>Segmento</strong>.
        </p>
      </div>

      {/* Top Section: Form Card (Novo Cadastro / Editar) */}
      <div className="w-full bg-[#f2ecf4] rounded-2xl shadow-sm p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-200/40 rounded-full blur-3xl -mr-20 -mt-20 transition-transform group-hover:scale-150 duration-700 ease-in-out"></div>
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            {editingId ? 'Editar Cliente' : 'Novo Cadastro de Cliente'}
          </h2>
          {editingId && (
            <button 
              type="button" 
              onClick={resetForm} 
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline bg-indigo-100/60 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar Edição
            </button>
          )}
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col gap-5 relative z-10">
          {/* Row 1: CNPJ, Nome do Grupo, CNAE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600" htmlFor="cnpj">CNPJ *</label>
              <input 
                type="text" 
                id="cnpj" 
                placeholder="00.000.000/0000-00" 
                maxLength={18}
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                required
                className="w-full h-10 px-4 rounded-xl bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs font-mono" 
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600" htmlFor="nome_grupo">Nome do Grupo (Opcional)</label>
              <input 
                type="text" 
                id="nome_grupo" 
                placeholder="Ex: Grupo Alpha" 
                value={nomeGrupo}
                onChange={(e) => setNomeGrupo(e.target.value)}
                className="w-full h-10 px-4 rounded-xl bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs" 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600" htmlFor="cnae">CNAE Principal *</label>
              <div className="relative">
                <input 
                  type="text" 
                  id="cnae" 
                  placeholder="0000-0/00" 
                  maxLength={9}
                  value={cnaePrincipal}
                  onChange={(e) => setCnaePrincipal(formatCNAE(e.target.value))}
                  required
                  className="w-full h-10 px-4 rounded-xl bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs font-mono" 
                />
                <Hash className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
          
          {/* Row 2: Razão Social, Segmento & Regime */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600" htmlFor="razao_social">Razão Social *</label>
              <input 
                type="text" 
                id="razao_social" 
                placeholder="Razão Social Completa S.A." 
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                required
                className="w-full h-10 px-4 rounded-xl bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs" 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600" htmlFor="segmento">Segmento & Regime Tributário *</label>
              <select 
                id="segmento" 
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl bg-white border border-transparent text-xs text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-2xs font-semibold"
              >
                <option value="" disabled>Selecione um segmento por regime...</option>
                {SEGMENTOS_POR_REGIME.map((grupo) => (
                  <optgroup key={grupo.regime} label={`── ${grupo.label} ──`}>
                    {grupo.segmentos.map((seg) => (
                      <option key={seg} value={seg}>
                        {seg}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {segmento && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Regime Detectado:</span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${REGIMES_CONFIG[getRegimeFromSegmento(segmento)].badgeBg} ${REGIMES_CONFIG[getRegimeFromSegmento(segmento)].badgeText} ${REGIMES_CONFIG[getRegimeFromSegmento(segmento)].badgeBorder}`}>
                    {REGIMES_CONFIG[getRegimeFromSegmento(segmento)].shortLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Row 3: Fases Contratadas pelo Cliente */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Fases Contratadas pelo Cliente *</span>
              <span className="text-[11px] font-normal text-slate-500">Selecione quais fases do fluxo de trabalho foram contratadas</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFasesContratadas(prev => ({ ...prev, fase_1: !prev.fase_1 }))}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  fasesContratadas.fase_1
                    ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-2xs'
                    : 'bg-white/80 border-slate-200 text-slate-400 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Compass className={`w-4 h-4 ${fasesContratadas.fase_1 ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Fase 1</div>
                    <div className="text-[10px] text-slate-500 font-medium">Diagnóstico</div>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  fasesContratadas.fase_1 ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {fasesContratadas.fase_1 ? 'Contratada' : 'N/A'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFasesContratadas(prev => ({ ...prev, fase_2: !prev.fase_2 }))}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  fasesContratadas.fase_2
                    ? 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-2xs'
                    : 'bg-white/80 border-slate-200 text-slate-400 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className={`w-4 h-4 ${fasesContratadas.fase_2 ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Fase 2</div>
                    <div className="text-[10px] text-slate-500 font-medium">Plano de Ação</div>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  fasesContratadas.fase_2 ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {fasesContratadas.fase_2 ? 'Contratada' : 'N/A'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFasesContratadas(prev => ({ ...prev, fase_3: !prev.fase_3 }))}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  fasesContratadas.fase_3
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                    : 'bg-white/80 border-slate-200 text-slate-400 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className={`w-4 h-4 ${fasesContratadas.fase_3 ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Fase 3</div>
                    <div className="text-[10px] text-slate-500 font-medium">Governança</div>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  fasesContratadas.fase_3 ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {fasesContratadas.fase_3 ? 'Contratada' : 'N/A'}
                </span>
              </button>
            </div>
          </div>

          {/* Row 4: Observação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600" htmlFor="observacao">Observação (Livre)</label>
            <textarea
              id="observacao"
              rows={2}
              placeholder="Observações importantes sobre o cliente..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full p-3 rounded-xl bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs resize-none"
            />
          </div>
          
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-indigo-900/80">
              <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Cada cliente cadastrado ativa automaticamente a esteira de <strong>Diagnóstico (Fase 1)</strong> no Fluxo de Trabalho.
              </span>
            </div>

            <button 
              type="submit" 
              disabled={saving}
              className="w-full sm:w-auto px-8 h-10 bg-indigo-700 text-white text-sm font-semibold rounded-xl hover:bg-indigo-800 transition-all shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
              {editingId ? 'Atualizar Cliente' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Section: Table Card (Lista de Clientes) */}
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Lista de Clientes ({filteredClients.length})</h2>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <input 
                type="text" 
                placeholder="Filtrar por nome, CNPJ, segmento ou regime..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-full bg-slate-100 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 border border-transparent transition-all placeholder:text-slate-500" 
              />
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto max-h-[390px] scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center p-16 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm">
              Nenhum cliente cadastrado no momento. Preencha o formulário acima para adicionar.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                <tr className="text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3.5">Razão Social / Grupo</th>
                  <th className="px-6 py-3.5 whitespace-nowrap min-w-[170px]">CNPJ / CNAE</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Regime Tributário</th>
                  <th className="px-6 py-3.5 min-w-[200px]">Segmento</th>
                  <th className="px-6 py-3.5">Observação</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const regimeKey = (client.regime || getRegimeFromSegmento(client.segmento)) as RegimeEnum;
                  const regimeConf = REGIMES_CONFIG[regimeKey] || REGIMES_CONFIG.regular;

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group relative border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4 relative">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${regimeConf.barColor} rounded-r-full`}></div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{client.razao_social}</span>
                          <span className="text-slate-500 text-[12px] mt-0.5">{client.nome_grupo || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">{formatCNPJ(client.cnpj)}</div>
                        {client.cnae_principal && (
                          <div className="text-[11px] text-slate-400 font-normal mt-0.5">CNAE: {formatCNAE(client.cnae_principal)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full ${regimeConf.badgeBg} ${regimeConf.badgeText} ${regimeConf.badgeBorder} border text-[11px] font-bold gap-1.5 shadow-2xs`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${regimeConf.dotColor}`}></span>
                          {regimeConf.shortLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
                          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[260px]" title={client.segmento}>{client.segmento}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-[200px]">
                        <span className="text-xs text-slate-600 line-clamp-2" title={client.observacao || ''}>
                          {client.observacao || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(client)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Editar Cliente"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(client.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Excluir Cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

