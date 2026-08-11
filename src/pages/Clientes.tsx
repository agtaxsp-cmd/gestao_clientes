import React, { useState, useEffect } from 'react';
import { Building2, Save, Lightbulb, Filter, MoreVertical, Eye, Pencil, Hash, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { Client, SegmentoEnum } from '../types';

const SEGMENTO_MAP: Record<SegmentoEnum, { label: string; bg: string; text: string; dot: string; bar: string }> = {
  industria: { label: 'Indústria', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500/80' },
  comercio: { label: 'Comércio', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', bar: 'bg-indigo-500/80' },
  servico: { label: 'Serviço', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', bar: 'bg-slate-500/80' }
};

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
  const [segmento, setSegmento] = useState<SegmentoEnum | ''>('');

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
    if (!cnpj || !razaoSocial || !cnaePrincipal || !segmento) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        const { error: updateErr } = await supabase
          .from('clients')
          .update({
            cnpj,
            nome_grupo: nomeGrupo || null,
            razao_social: razaoSocial,
            cnae_principal: cnaePrincipal,
            segmento: segmento as SegmentoEnum,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (updateErr) throw updateErr;

        await logActivity({
          titulo: 'Cliente Atualizado',
          descricao: `Os dados do cliente ${razaoSocial} (CNPJ: ${cnpj}) foram atualizados`,
          tipo_log: 'info',
          client_id: editingId,
          usuario_nome: getUserName()
        });
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('clients')
          .insert({
            cnpj,
            nome_grupo: nomeGrupo || null,
            razao_social: razaoSocial,
            cnae_principal: cnaePrincipal,
            segmento: segmento as SegmentoEnum
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        if (inserted?.id) {
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;

          const { error: pipeErr } = await supabase
            .from('workflow_pipelines')
            .insert({
              client_id: inserted.id,
              status: 'iniciado',
              etapa_atual: 1,
              mensagem_info: 'Esteira iniciada automaticamente ao cadastrar cliente.',
              ano_referencia: currentYear,
              mes_referencia: currentMonth,
              caminhos_rede_etapas: {},
              observacoes_etapas: {}
            });

          if (pipeErr) console.error('Erro ao criar esteira automática:', pipeErr);
        }

        await logActivity({
          titulo: 'Cliente Cadastrado',
          descricao: `Novo cliente ${razaoSocial} (CNPJ: ${cnpj}) cadastrado e esteira iniciada automaticamente`,
          tipo_log: 'success',
          client_id: inserted?.id,
          usuario_nome: getUserName()
        });
      }

      resetForm();
      fetchClients();
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      alert('Erro ao salvar cliente: ' + (err.message || 'Verifique os dados'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setCnpj(client.cnpj);
    setNomeGrupo(client.nome_grupo || '');
    setRazaoSocial(client.razao_social);
    setCnaePrincipal(client.cnae_principal);
    setSegmento(client.segmento);
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
  };

  const filteredClients = clients.filter(c =>
    c.razao_social.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    (c.nome_grupo && c.nome_grupo.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col w-full relative">
      <div className="mb-8">
        <h1 className="text-[32px] font-semibold text-slate-900 tracking-tight leading-tight mb-2">Gestão de Clientes</h1>
        <p className="text-slate-600 text-base max-w-2xl">
          Cadastre e gerencie a carteira de clientes integrada em tempo real ao Supabase.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full h-full">
        {/* Left Column: Form */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-[#f2ecf4] rounded-2xl shadow-sm p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/40 rounded-full blur-2xl -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700 ease-in-out"></div>
            
            <h2 className="text-lg font-semibold text-slate-900 mb-6 relative z-10 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                {editingId ? 'Editar Cliente' : 'Novo Cadastro'}
              </span>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs text-indigo-600 underline">
                  Cancelar
                </button>
              )}
            </h2>
            
            <form onSubmit={handleSave} className="flex flex-col gap-4 relative z-10">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600" htmlFor="cnpj">CNPJ *</label>
                <input 
                  type="text" 
                  id="cnpj" 
                  placeholder="00.000.000/0000-00" 
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  required
                  className="w-full h-10 px-4 rounded-lg bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" 
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
                  className="w-full h-10 px-4 rounded-lg bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" 
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600" htmlFor="razao_social">Razão Social *</label>
                <input 
                  type="text" 
                  id="razao_social" 
                  placeholder="Razão Social Completa S.A." 
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  required
                  className="w-full h-10 px-4 rounded-lg bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" 
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600" htmlFor="cnae">CNAE Principal *</label>
                <div className="relative">
                  <input 
                    type="text" 
                    id="cnae" 
                    placeholder="0000-0/00" 
                    value={cnaePrincipal}
                    onChange={(e) => setCnaePrincipal(e.target.value)}
                    required
                    className="w-full h-10 px-4 rounded-lg bg-white border border-transparent text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" 
                  />
                  <Hash className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600" htmlFor="segmento">Segmento *</label>
                <select 
                  id="segmento" 
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value as SegmentoEnum)}
                  required
                  className="w-full h-10 px-4 rounded-lg bg-white border border-transparent text-sm text-slate-900 appearance-none focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm"
                >
                  <option value="" disabled>Selecione um segmento</option>
                  <option value="industria">Indústria</option>
                  <option value="comercio">Comércio</option>
                  <option value="servico">Serviço</option>
                </select>
              </div>
              
              <button 
                type="submit" 
                disabled={saving}
                className="mt-2 w-full h-10 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 transition-colors shadow flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                {editingId ? 'Atualizar Cliente' : 'Salvar Cliente'}
              </button>
            </form>
          </div>
          
          <div className="bg-[#e1d4fd]/50 rounded-2xl p-5 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-indigo-700 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm text-indigo-900 mb-1">Status do Banco</h4>
              <p className="text-sm text-indigo-800/80">
                Os dados desta tela são persistidos diretamente na tabela <code className="bg-indigo-200/60 px-1 rounded">public.clients</code> do Supabase.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Table */}
        <div className="w-full lg:w-2/3 flex flex-col">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900">Lista de Clientes ({filteredClients.length})</h2>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Filtrar clientes..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 h-9 pl-9 pr-4 rounded-full bg-slate-100 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 border border-transparent transition-all placeholder:text-slate-500" 
                  />
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  Carregando clientes...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  Nenhum cliente cadastrado no momento. Preencha o formulário ao lado para adicionar.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-4">Razão Social / Grupo</th>
                      <th className="px-6 py-4">CNPJ</th>
                      <th className="px-6 py-4">Segmento</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredClients.map((client) => {
                      const segConfig = SEGMENTO_MAP[client.segmento] || SEGMENTO_MAP.servico;
                      return (
                        <tr key={client.id} className="hover:bg-slate-50 transition-colors group relative border-b border-slate-100 last:border-0">
                          <td className="px-6 py-4 relative">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${segConfig.bar} rounded-r-full`}></div>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{client.razao_social}</span>
                              <span className="text-slate-500 text-[12px] mt-0.5">{client.nome_grupo || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-600">{client.cnpj}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full ${segConfig.bg} ${segConfig.text} text-xs font-medium gap-1.5`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${segConfig.dot}`}></span>
                              {segConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEdit(client)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(client.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Excluir"
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
      </div>
    </div>
  );
}
