import React, { useState, useEffect } from 'react';
import { Save, Users, PlusCircle, Pencil, GitMerge, Trash2, Loader2, X, Plus, Check, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { TeamMember, WorkflowAssignment, FaseEnum, WorkflowPhase } from '../types';

const DEFAULT_FASES: { key: string; name: string; color: string; ordem: number }[] = [
  { key: 'coleta_arquivos', name: 'Arquivos', color: 'bg-slate-500', ordem: 1 },
  { key: 'calculadora_rtc', name: 'Calculadora RTC', color: 'bg-indigo-500', ordem: 2 },
  { key: 'compliance_rtc', name: 'Compliance RTC', color: 'bg-indigo-600', ordem: 3 },
  { key: 'apuracao_assistida', name: 'Apuração Assistida', color: 'bg-indigo-700', ordem: 4 },
  { key: 'entrega_apresentacao', name: 'Entrega e Apresentação', color: 'bg-emerald-500', ordem: 5 },
];

export default function Configuracoes() {
  const { getUserName } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [phases, setPhases] = useState<WorkflowPhase[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { principal?: string; backup?: string }>>({});

  const [loading, setLoading] = useState(true);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState(false);

  // Form para novos membros
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [iniciais, setIniciais] = useState('');

  // Form para nova fase
  const [novaFaseNome, setNovaFaseNome] = useState('');

  // Edição inline de nome da fase
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [tempPhaseName, setTempPhaseName] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Buscar membros
      const { data: membersData, error: memErr } = await supabase
        .from('team_members')
        .select('*')
        .order('nome');
      if (memErr) throw memErr;
      setMembers(membersData || []);

      // Buscar fases do fluxo
      const { data: phasesData, error: phaseErr } = await supabase
        .from('workflow_phases')
        .select('*')
        .order('ordem', { ascending: true });

      if (phaseErr) console.error('Erro ao buscar fases:', phaseErr);
      
      let currentPhases: WorkflowPhase[] = [];
      if (phasesData && phasesData.length > 0) {
        currentPhases = phasesData;
      } else {
        // Fallback default
        currentPhases = DEFAULT_FASES.map(f => ({
          id: f.key,
          key: f.key,
          nome: f.name,
          ordem: f.ordem,
          color: f.color
        }));
      }
      setPhases(currentPhases);

      // Buscar atribuições
      const { data: assignData, error: assErr } = await supabase
        .from('workflow_assignments')
        .select('*');
      if (assErr) throw assErr;

      const assignMap: Record<string, { principal?: string; backup?: string }> = {};
      assignData?.forEach((item: WorkflowAssignment) => {
        assignMap[item.fase_fluxo] = {
          principal: item.responsavel_principal_id || '',
          backup: item.responsavel_backup_id || ''
        };
      });

      setAssignments(assignMap);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar configurações:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cargo || !iniciais) return;

    try {
      const { error: insErr } = await supabase
        .from('team_members')
        .insert({
          nome,
          cargo,
          iniciais: iniciais.toUpperCase().slice(0, 3),
          ui_color_bg: 'bg-indigo-100',
          ui_color_text: 'text-indigo-700'
        });

      if (insErr) throw insErr;

      await logActivity({
        titulo: 'Novo Membro da Equipe',
        descricao: `${nome} (${cargo}) foi adicionado à equipe`,
        tipo_log: 'success',
        usuario_nome: getUserName()
      });

      setNome('');
      setCargo('');
      setIniciais('');
      setShowMemberModal(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao adicionar membro: ' + message);
    }
  };

  const handleDeleteMember = async (id: string) => {
    const memObj = members.find(m => m.id === id);
    if (!confirm(`Deseja remover ${memObj?.nome || 'este membro'} da equipe?`)) return;
    try {
      const { error: delErr } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;

      await logActivity({
        titulo: 'Membro Removido',
        descricao: `${memObj?.nome || 'Membro'} foi removido da equipe`,
        tipo_log: 'error',
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao remover membro: ' + message);
    }
  };

  const handleAddPhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaFaseNome.trim()) return;

    try {
      const newOrdem = phases.length + 1;
      const newKey = `fase_custom_${Date.now()}`;

      const { error: insErr } = await supabase
        .from('workflow_phases')
        .insert({
          key: newKey,
          nome: novaFaseNome.trim(),
          ordem: newOrdem,
          color: 'bg-indigo-600'
        });

      if (insErr) throw insErr;

      await logActivity({
        titulo: 'Nova Fase Criada',
        descricao: `Nova etapa do fluxo "${novaFaseNome.trim()}" criada (Ordem: ${newOrdem})`,
        tipo_log: 'success',
        usuario_nome: getUserName()
      });

      setNovaFaseNome('');
      setShowPhaseModal(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao criar fase: ' + message);
    }
  };

  const handleSavePhaseName = async (phase: WorkflowPhase) => {
    if (!tempPhaseName.trim()) return;
    try {
      const { error: upErr } = await supabase
        .from('workflow_phases')
        .update({ nome: tempPhaseName.trim() })
        .eq('id', phase.id);

      if (upErr) throw upErr;

      await logActivity({
        titulo: 'Fase Renomeada',
        descricao: `A etapa "${phase.nome}" foi renomeada para "${tempPhaseName.trim()}"`,
        tipo_log: 'info',
        usuario_nome: getUserName()
      });

      setEditingPhaseId(null);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao atualizar nome da fase: ' + message);
    }
  };

  const handleDeletePhase = async (phase: WorkflowPhase) => {
    if (!confirm(`Tem certeza que deseja excluir a fase "${phase.nome}"?`)) return;
    try {
      const { error: delErr } = await supabase
        .from('workflow_phases')
        .delete()
        .eq('id', phase.id);

      if (delErr) throw delErr;

      await supabase
        .from('workflow_assignments')
        .delete()
        .eq('fase_fluxo', phase.key);

      await logActivity({
        titulo: 'Fase Removida',
        descricao: `A etapa "${phase.nome}" foi removida das configurações`,
        tipo_log: 'error',
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao excluir fase: ' + message);
    }
  };

  const handleMovePhase = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;

    const newPhases = [...phases];
    const temp = newPhases[index];
    newPhases[index] = newPhases[newIndex];
    newPhases[newIndex] = temp;

    const reorderedPhases = newPhases.map((p, i) => ({
      ...p,
      ordem: i + 1
    }));

    setPhases(reorderedPhases);

    try {
      const updates = reorderedPhases.map(p => ({
        id: p.id,
        key: p.key,
        nome: p.nome,
        ordem: p.ordem,
        color: p.color || 'bg-indigo-600'
      }));

      const { error } = await supabase
        .from('workflow_phases')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;

      await logActivity({
        titulo: 'Ordem das Fases Alterada',
        descricao: 'A ordem das etapas do fluxo foi reordenada com sucesso',
        tipo_log: 'info',
        usuario_nome: getUserName()
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao reordenar fases: ' + message);
      fetchData();
    }
  };

  const handleAssignmentChange = (faseKey: string, type: 'principal' | 'backup', value: string) => {
    setAssignments(prev => ({
      ...prev,
      [faseKey]: {
        ...prev[faseKey],
        [type]: value
      }
    }));
  };

  const handleSaveAssignments = async () => {
    try {
      setSavingAssignments(true);
      const updates = phases.map((phase) => ({
        fase_fluxo: phase.key,
        responsavel_principal_id: assignments[phase.key]?.principal || null,
        responsavel_backup_id: assignments[phase.key]?.backup || null,
        updated_at: new Date().toISOString()
      }));

      const { error: upsertErr } = await supabase
        .from('workflow_assignments')
        .upsert(updates, { onConflict: 'fase_fluxo' });

      if (upsertErr) throw upsertErr;

      await logActivity({
        titulo: 'Responsáveis Atualizados',
        descricao: 'Matriz de responsáveis pelas etapas do fluxo de trabalho salva com sucesso',
        tipo_log: 'info',
        usuario_nome: getUserName()
      });

      alert('Matriz de atribuições salva com sucesso!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao salvar atribuições:', message);
      alert('Erro ao salvar atribuições: ' + message);
    } finally {
      setSavingAssignments(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full p-2 relative gap-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-slate-900">Configurações de Fluxo e Responsáveis</h1>
          <p className="text-slate-600 text-sm">
            Gerencie as fases do processo, adicione/renomeie/reordene etapas e atribua os responsáveis da equipe.
          </p>
        </div>
        <button 
          onClick={handleSaveAssignments}
          disabled={savingAssignments}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {savingAssignments ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Todas Atribuições
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          Carregando membros e fases do fluxo...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          {/* Equipe Section */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-slate-200">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Membros da Equipe ({members.length})
                </h2>
                <button 
                  onClick={() => setShowMemberModal(true)}
                  className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-full transition-colors cursor-pointer"
                  title="Adicionar Membro"
                >
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 max-h-[400px]">
                {members.length === 0 ? (
                  <div className="text-center text-sm text-slate-400 py-8">
                    Nenhum membro cadastrado. Clique no botão + acima.
                  </div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl group/member border border-transparent hover:border-slate-200 transition-all">
                      <div className={`w-10 h-10 rounded-full ${member.ui_color_bg || 'bg-indigo-100'} ${member.ui_color_text || 'text-indigo-700'} flex items-center justify-center font-semibold text-base shrink-0`}>
                        {member.iniciais}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-slate-900 truncate">{member.nome}</span>
                        <span className="text-xs text-slate-500 truncate mt-0.5">{member.cargo}</span>
                      </div>
                      <div className="flex items-center opacity-0 group-hover/member:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Matriz de Atribuições & Gerenciador de Fases */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-slate-200">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitMerge className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Fases do Fluxo & Responsáveis</h2>
                    <p className="text-xs text-slate-500">Adicione novas fases, altere a ordem ou renomeie as etapas existentes do pipeline.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPhaseModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Incluir Nova Fase
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="p-4 text-xs font-semibold text-slate-500 w-20 text-center">Etapa / Ordem</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 w-2/5">Nome da Fase do Fluxo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500">Responsável Principal</th>
                      <th className="p-4 text-xs font-semibold text-slate-500">Responsável Backup</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 w-10">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {phases.map((phase, index) => {
                      const isEditing = editingPhaseId === phase.id;

                      return (
                        <tr key={phase.id || phase.key} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMovePhase(index, 'up')}
                                  className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer transition-colors"
                                  title="Mover para cima"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === phases.length - 1}
                                  onClick={() => handleMovePhase(index, 'down')}
                                  className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer transition-colors"
                                  title="Mover para baixo"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text"
                                  value={tempPhaseName}
                                  onChange={(e) => setTempPhaseName(e.target.value)}
                                  className="px-2 py-1 border border-indigo-300 rounded-md text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 w-full"
                                  autoFocus
                                />
                                <button 
                                  onClick={() => handleSavePhaseName(phase)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  title="Salvar Nome"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setEditingPhaseId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group/phase pr-2">
                                <span className="text-sm font-semibold text-slate-900">{phase.nome}</span>
                                <button
                                  onClick={() => {
                                    setEditingPhaseId(phase.id);
                                    setTempPhaseName(phase.nome);
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover/phase:opacity-100 transition-opacity cursor-pointer"
                                  title="Editar Nome da Fase"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <select 
                              value={assignments[phase.key]?.principal || ''}
                              onChange={(e) => handleAssignmentChange(phase.key, 'principal', e.target.value)}
                              className="w-full h-9 px-2 bg-transparent border-b border-transparent group-hover:border-slate-200 hover:bg-slate-100 rounded text-xs font-medium text-indigo-700 focus:outline-none focus:border-indigo-600 transition-all cursor-pointer"
                            >
                              <option value="">-- Selecionar Principal --</option>
                              {members.map(m => (
                                <option key={m.id} value={m.id}>{m.nome} ({m.cargo})</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">
                            <select 
                              value={assignments[phase.key]?.backup || ''}
                              onChange={(e) => handleAssignmentChange(phase.key, 'backup', e.target.value)}
                              className="w-full h-9 px-2 bg-transparent border-b border-transparent group-hover:border-slate-200 hover:bg-slate-100 rounded text-xs font-medium text-slate-600 focus:outline-none focus:border-indigo-400 transition-all cursor-pointer"
                            >
                              <option value="">-- Selecionar Backup --</option>
                              {members.map(m => (
                                <option key={m.id} value={m.id}>{m.nome} ({m.cargo})</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4 text-center">
                            {phase.id && (
                              <button 
                                onClick={() => handleDeletePhase(phase)}
                                className="p-1.5 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Excluir Fase"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Membro */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 relative">
            <button 
              onClick={() => setShowMemberModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Adicionar Novo Membro</h3>
            <form onSubmit={handleAddMember} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome Completo</label>
                <input 
                  type="text" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Gabriel Rocha" 
                  required 
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Cargo</label>
                <input 
                  type="text" 
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Consultor Tributário" 
                  required 
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Iniciais (2 ou 3 letras)</label>
                <input 
                  type="text" 
                  value={iniciais}
                  onChange={(e) => setIniciais(e.target.value)}
                  placeholder="Ex: GR" 
                  maxLength={3}
                  required 
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none uppercase"
                />
              </div>
              <button 
                type="submit" 
                className="mt-2 w-full h-10 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                Cadastrar Membro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Nova Fase do Fluxo */}
      {showPhaseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 relative">
            <button 
              onClick={() => setShowPhaseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Incluir Nova Fase do Fluxo</h3>
            <p className="text-xs text-slate-500 mb-4">
              Digite o nome da nova etapa. Ela será inserida no final da sequência do pipeline.
            </p>
            <form onSubmit={handleAddPhase} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome da Etapa</label>
                <input 
                  type="text" 
                  value={novaFaseNome}
                  onChange={(e) => setNovaFaseNome(e.target.value)}
                  placeholder="Ex: Validação Fiscal Especial" 
                  required 
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                />
              </div>
              <button 
                type="submit" 
                className="mt-2 w-full h-10 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                Criar Fase
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
