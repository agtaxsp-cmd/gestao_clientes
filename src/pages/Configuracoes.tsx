import React, { useState, useEffect } from 'react';
import { Save, Users, PlusCircle, Pencil, GitMerge, Trash2, Loader2, X, Plus, Check, ArrowUp, ArrowDown, ShieldCheck, FileCheck, Compass, CheckCircle2, UserPlus, Send, Mail, AlertCircle, Filter, Tag, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { TeamMember, WorkflowAssignment, WorkflowPhase, FaseGrupoEnum, REGIMES_CONFIG, RegimeEnum } from '../types';
import { cn } from '../lib/utils';

const DEFAULT_FASES: { key: string; name: string; grupo_fase: FaseGrupoEnum; ordem: number; color: string }[] = [
  // FASE 1 - DIAGNOSTICO
  { key: 'outorga_sped', name: 'OUTORGA SPED', grupo_fase: 'fase_1', ordem: 1, color: 'bg-indigo-600' },
  { key: 'outorga_apuracao_assistida', name: 'OUTORGA APURAÇÃO ASSISTIDA', grupo_fase: 'fase_1', ordem: 2, color: 'bg-indigo-600' },
  { key: 'coleta_documental', name: 'COLETA DOCUMENTAL', grupo_fase: 'fase_1', ordem: 3, color: 'bg-indigo-600' },
  { key: 'processamento_as_is', name: 'PROCESSAMENTO AS-IS', grupo_fase: 'fase_1', ordem: 4, color: 'bg-indigo-600' },
  { key: 'apresentacao_as_is', name: 'APRESENTAÇÃO AS-IS', grupo_fase: 'fase_1', ordem: 5, color: 'bg-indigo-600' },
  { key: 'processamento_to_be', name: 'PROCESSAMENTO TO-BE', grupo_fase: 'fase_1', ordem: 6, color: 'bg-indigo-600' },
  { key: 'apresentacao_to_be', name: 'APRESENTAÇÃO TO-BE', grupo_fase: 'fase_1', ordem: 7, color: 'bg-indigo-600' },

  // FASE 2 - PLANO DE AÇÃO
  { key: 'elaborar', name: 'ELABORAR', grupo_fase: 'fase_2', ordem: 1, color: 'bg-blue-600' },
  { key: 'acompanhamento', name: 'ACOMPANHAMENTO', grupo_fase: 'fase_2', ordem: 2, color: 'bg-blue-600' },

  // FASE 3 - GOVERNANÇA
  { key: 'elaborar_fase3', name: 'ELABORAR', grupo_fase: 'fase_3', ordem: 1, color: 'bg-emerald-600' },
  { key: 'envio_ao_cliente', name: 'ENVIO AO CLIENTE', grupo_fase: 'fase_3', ordem: 2, color: 'bg-emerald-600' },
];

const GRUPO_LABELS: Record<FaseGrupoEnum, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; badge: string; badgeColor: string }> = {
  fase_1: {
    title: 'Fase 1 — Diagnóstico',
    subtitle: 'Estrutura de diagnóstico inicial por empresa',
    icon: Compass,
    badge: 'Diagnóstico (7 Etapas)',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  fase_2: {
    title: 'Fase 2 — Plano de Ação',
    subtitle: 'Fluxo mensal / anual recorrente (visão do ano corrente, 12 meses)',
    icon: FileCheck,
    badge: 'Recorrente Mensal (2 Etapas)',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  fase_3: {
    title: 'Fase 3 — Governança',
    subtitle: 'Auditoria fiscal mensal / anual recorrente (visão do ano corrente, 12 meses)',
    icon: ShieldCheck,
    badge: 'Recorrente Mensal (1 Etapa)',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  fase_poc: {
    title: 'Módulo POC — Provas de Conceito',
    subtitle: 'Etapas de pré-venda, amostragem e validação técnica da POC',
    icon: FlaskConical,
    badge: 'Esteira de Testes (POC)',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-300'
  }
};

export default function Configuracoes() {
  const { getUserName } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [phases, setPhases] = useState<WorkflowPhase[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { principal?: string; backup?: string }>>({});

  const [loading, setLoading] = useState(true);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState(false);

  // Form para convite de usuário
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteNome, setInviteNome] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCargo, setInviteCargo] = useState('');
  const [inviteIniciais, setInviteIniciais] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);
  const [inviteErrorMsg, setInviteErrorMsg] = useState<string | null>(null);

  // Form para membros
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [iniciais, setIniciais] = useState('');

  // Form para nova fase
  const [novaFaseNome, setNovaFaseNome] = useState('');
  const [novaFaseGrupo, setNovaFaseGrupo] = useState<FaseGrupoEnum>('fase_1');
  const [novaFaseRegime, setNovaFaseRegime] = useState<RegimeEnum | 'geral'>('geral');
  const [selectedRegimeFilter, setSelectedRegimeFilter] = useState<RegimeEnum>('regular');

  // Edição inline de nome da fase
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [tempPhaseName, setTempPhaseName] = useState('');

  const handleOpenInviteModal = () => {
    setInviteNome('');
    setInviteEmail('');
    setInviteCargo('');
    setInviteIniciais('');
    setInviteSuccessMsg(null);
    setInviteErrorMsg(null);
    setShowInviteModal(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSuccessMsg(null);
    setInviteErrorMsg(null);

    if (!inviteNome.trim() || !inviteEmail.trim()) {
      setInviteErrorMsg('Por favor, preencha o nome completo e o e-mail do usuário.');
      return;
    }

    try {
      setSendingInvite(true);
      
      const computedInitials = (inviteIniciais.trim() || inviteNome.trim().split(' ').map(n => n[0]).join('').substring(0, 2)).toUpperCase();

      // 1. Cadastrar como membro da equipe
      const { error: teamErr } = await supabase.from('team_members').insert([
        {
          nome: inviteNome.trim(),
          cargo: inviteCargo.trim() || 'Analista Fiscal',
          iniciais: computedInitials || 'US',
          ui_color_bg: 'bg-indigo-100',
          ui_color_text: 'text-indigo-700',
        },
      ]);

      if (teamErr) throw teamErr;

      // 2. Registra convite/criação de conta de usuário via Supabase Auth
      const tempPassword = `Agtax#${Math.random().toString(36).slice(-8)}${Math.floor(Math.random() * 100)}`;
      const { error: authErr } = await supabase.auth.signUp({
        email: inviteEmail.trim(),
        password: tempPassword,
        options: {
          data: {
            full_name: inviteNome.trim(),
            invited_by: getUserName(),
          },
        },
      });

      if (authErr && !authErr.message.includes('User already registered')) {
        console.warn('Nota ao cadastrar usuário no Supabase Auth:', authErr);
      }

      // 3. Log de Atividade
      await logActivity({
        titulo: 'Convite Enviado',
        descricao: `Convite enviado para ${inviteNome.trim()} (${inviteEmail.trim()}) - Cargo: ${inviteCargo.trim() || 'Analista Fiscal'}.`,
        tipo_log: 'success',
        usuario_nome: getUserName(),
      });

      setInviteSuccessMsg(`Convite registrado e enviado para ${inviteEmail.trim()} com sucesso!`);
      fetchData();

      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccessMsg(null);
      }, 1800);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao enviar convite:', message);
      setInviteErrorMsg('Erro ao enviar convite: ' + message);
    } finally {
      setSendingInvite(false);
    }
  };


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
        currentPhases = DEFAULT_FASES.map(f => ({
          id: f.key,
          key: f.key,
          nome: f.name,
          ordem: f.ordem,
          grupo_fase: f.grupo_fase,
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

  const handleOpenAddMember = () => {
    setEditingMemberId(null);
    setNome('');
    setCargo('');
    setIniciais('');
    setShowMemberModal(true);
  };

  const handleOpenEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setNome(member.nome);
    setCargo(member.cargo);
    setIniciais(member.iniciais);
    setShowMemberModal(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cargo || !iniciais) return;

    try {
      if (editingMemberId) {
        const { error: upErr } = await supabase
          .from('team_members')
          .update({
            nome,
            cargo,
            iniciais: iniciais.toUpperCase().slice(0, 3)
          })
          .eq('id', editingMemberId);

        if (upErr) throw upErr;

        await logActivity({
          titulo: 'Membro Atualizado',
          descricao: `Os dados de ${nome} (${cargo}) foram atualizados`,
          tipo_log: 'info',
          usuario_nome: getUserName()
        });
      } else {
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
      }

      setNome('');
      setCargo('');
      setIniciais('');
      setEditingMemberId(null);
      setShowMemberModal(false);
      fetchData();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || (err instanceof Error ? err.message : String(err));
      alert('Erro ao salvar membro: ' + message);
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
      const phasesInGroup = phases.filter(p => p.grupo_fase === novaFaseGrupo);
      const newOrdem = phasesInGroup.length + 1;
      const baseKey = `${novaFaseGrupo}_custom_${Date.now()}`;
      const color = novaFaseGrupo === 'fase_1' ? 'bg-indigo-600' : novaFaseGrupo === 'fase_2' ? 'bg-blue-600' : 'bg-emerald-600';

      const targetRegimes: RegimeEnum[] = novaFaseRegime === 'geral' 
        ? ['regular', 'especifico', 'diferenciado'] 
        : [novaFaseRegime as RegimeEnum];

      for (const reg of targetRegimes) {
        const newKey = `${baseKey}_${reg}`;
        const { error: insErr } = await supabase
          .from('workflow_phases')
          .insert({
            key: newKey,
            nome: novaFaseNome.trim().toUpperCase(),
            grupo_fase: novaFaseGrupo,
            ordem: newOrdem,
            regime: reg,
            color
          });

        if (insErr) throw insErr;

        await supabase
          .from('workflow_assignments')
          .insert({ fase_fluxo: newKey })
          .select()
          .single();
      }

      await logActivity({
        titulo: 'Nova Fase Criada',
        descricao: `Nova etapa "${novaFaseNome.trim().toUpperCase()}" adicionada na ${GRUPO_LABELS[novaFaseGrupo].title}`,
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
        .update({ nome: tempPhaseName.trim().toUpperCase() })
        .eq('id', phase.id);

      if (upErr) throw upErr;

      await logActivity({
        titulo: 'Fase Renomeada',
        descricao: `A etapa "${phase.nome}" foi renomeada para "${tempPhaseName.trim().toUpperCase()}"`,
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
    if (!confirm(`Tem certeza que deseja excluir a etapa "${phase.nome}"?`)) return;
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

  const handleMovePhaseInGroup = async (grupo: FaseGrupoEnum, indexInGroup: number, direction: 'up' | 'down') => {
    const groupPhases = phases.filter(p => p.grupo_fase === grupo).sort((a, b) => a.ordem - b.ordem);
    const targetIndex = direction === 'up' ? indexInGroup - 1 : indexInGroup + 1;
    if (targetIndex < 0 || targetIndex >= groupPhases.length) return;

    const currentItem = groupPhases[indexInGroup];
    const targetItem = groupPhases[targetIndex];

    try {
      // Trocar ordens no banco
      const { error: err1 } = await supabase
        .from('workflow_phases')
        .update({ ordem: targetItem.ordem })
        .eq('id', currentItem.id);
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from('workflow_phases')
        .update({ ordem: currentItem.ordem })
        .eq('id', targetItem.id);
      if (err2) throw err2;

      await logActivity({
        titulo: 'Ordem das Fases Alterada',
        descricao: `Etapas reordenadas no bloco ${GRUPO_LABELS[grupo].title}`,
        tipo_log: 'info',
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao reordenar fases: ' + message);
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
    setSaveSuccess(false);
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
        descricao: 'Matriz de responsáveis pelas 3 fases do fluxo de trabalho salva com sucesso',
        tipo_log: 'info',
        usuario_nome: getUserName()
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao salvar atribuições:', message);
      alert('Erro ao salvar atribuições: ' + message);
    } finally {
      setSavingAssignments(false);
    }
  };

  const phaseGroups: FaseGrupoEnum[] = ['fase_1', 'fase_2', 'fase_3'];

  return (
    <div className="flex flex-col w-full h-full p-2 relative gap-8">
      {/* Header Superior */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-slate-900">Configurações de Fluxo e Responsáveis</h1>
          <p className="text-slate-600 text-sm">
            Gerencie as fases do processo distribuídas em 3 blocos estruturais e atribua os responsáveis da equipe.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSaveAssignments}
            disabled={savingAssignments}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50",
              saveSuccess 
                ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                : "bg-indigo-700 text-white hover:bg-indigo-800"
            )}
          >
            {savingAssignments ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveSuccess ? 'Atribuições Salvas!' : 'Salvar Todas Atribuições'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Carregando membros e fases do fluxo...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          {/* Seção Membros da Equipe */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-slate-200 sticky top-4">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Membros ({members.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleOpenInviteModal}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                    title="Enviar Convite para Novo Colaborador"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Enviar Convite
                  </button>
                  <button 
                    onClick={handleOpenAddMember}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-200/70 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Adicionar Manualmente"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 max-h-[580px]">
                {members.length === 0 ? (
                  <div className="text-center text-sm text-slate-400 py-8">
                    Nenhum membro cadastrado. Clique no botão acima para adicionar.
                  </div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl group/member border border-transparent hover:border-slate-200 hover:bg-white transition-all shadow-2xs">
                      <div className={`w-9 h-9 rounded-full ${member.ui_color_bg || 'bg-indigo-100'} ${member.ui_color_text || 'text-indigo-700'} flex items-center justify-center font-bold text-xs shrink-0`}>
                        {member.iniciais}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-900 truncate">{member.nome}</span>
                        <span className="text-[11px] text-slate-500 truncate">{member.cargo}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEditMember(member)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Editar Membro"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Seção Fases do Fluxo & Responsáveis Separada em 3 Blocos */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-indigo-600" />
                  Fases do Fluxo de Trabalho & Responsáveis
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  As etapas estão organizadas em 3 fases respeitando o ciclo de diagnóstico e operação contínua.
                </p>
              </div>
              <button
                onClick={() => setShowPhaseModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                Nova Etapa
              </button>
            </div>

            {/* Filtro de Regime Tributário para Fases */}
            <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 px-3 flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                Filtrar Regime:
              </span>
              <button
                type="button"
                onClick={() => setSelectedRegimeFilter('regular')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  selectedRegimeFilter === 'regular'
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-indigo-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Regime Regular
              </button>
              <button
                type="button"
                onClick={() => setSelectedRegimeFilter('especifico')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  selectedRegimeFilter === 'especifico'
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-purple-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Regimes Específicos
              </button>
              <button
                type="button"
                onClick={() => setSelectedRegimeFilter('diferenciado')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  selectedRegimeFilter === 'diferenciado'
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-emerald-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Regimes Diferenciados
              </button>
            </div>

            {/* 4 Blocos Visuais */}
            {(['fase_1', 'fase_2', 'fase_3', 'fase_poc'] as FaseGrupoEnum[]).map((grupoKey) => {
              const meta = GRUPO_LABELS[grupoKey];
              const IconComp = meta.icon;
              const groupPhases = phases
                .filter(p => p.grupo_fase === grupoKey && p.regime === selectedRegimeFilter)
                .sort((a, b) => a.ordem - b.ordem);

              return (
                <div 
                  key={grupoKey} 
                  className="bg-white rounded-2xl shadow-xs overflow-hidden flex flex-col border border-slate-200 hover:shadow-md transition-shadow"
                >
                  {/* Cabeçalho do Bloco */}
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs",
                        grupoKey === 'fase_1' ? "bg-indigo-100 text-indigo-700" :
                        grupoKey === 'fase_2' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{meta.title}</h3>
                        <p className="text-[11px] text-slate-500">{meta.subtitle}</p>
                      </div>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold border self-start sm:self-auto", meta.badgeColor)}>
                      {meta.badge}
                    </span>
                  </div>

                  {/* Tabela de Etapas deste Bloco */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200">
                          <th className="p-3 text-[11px] font-semibold text-slate-500 w-16 text-center">Ordem</th>
                          <th className="p-3 text-[11px] font-semibold text-slate-500 w-2/5">Nome da Etapa & Scope</th>
                          <th className="p-3 text-[11px] font-semibold text-slate-500">Responsável Principal</th>
                          <th className="p-3 text-[11px] font-semibold text-slate-500">Responsável Backup</th>
                          <th className="p-3 text-[11px] font-semibold text-slate-500 w-12 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {groupPhases.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-slate-400">
                              Nenhuma etapa cadastrada neste bloco para o filtro selecionado.
                            </td>
                          </tr>
                        ) : (
                          groupPhases.map((phase, indexInGroup) => {
                            const isEditing = editingPhaseId === phase.id;

                            return (
                              <tr key={phase.id || phase.key} className="group hover:bg-slate-50/60 transition-colors">
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={cn(
                                      "w-6 h-6 rounded-full text-[11px] font-bold inline-flex items-center justify-center shrink-0",
                                      grupoKey === 'fase_1' ? "bg-indigo-100 text-indigo-700" :
                                      grupoKey === 'fase_2' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                    )}>
                                      {indexInGroup + 1}
                                    </span>
                                    <div className="flex flex-col gap-0.5">
                                      <button
                                        type="button"
                                        disabled={indexInGroup === 0}
                                        onClick={() => handleMovePhaseInGroup(grupoKey, indexInGroup, 'up')}
                                        className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer transition-colors"
                                        title="Mover para cima"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={indexInGroup === groupPhases.length - 1}
                                        onClick={() => handleMovePhaseInGroup(grupoKey, indexInGroup, 'down')}
                                        className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer transition-colors"
                                        title="Mover para baixo"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="text"
                                        value={tempPhaseName}
                                        onChange={(e) => setTempPhaseName(e.target.value)}
                                        className="px-2.5 py-1 border border-indigo-300 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 w-full uppercase"
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
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-slate-800">{phase.nome}</span>
                                        {phase.regime && phase.regime !== 'geral' ? (
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                            REGIMES_CONFIG[phase.regime]?.badgeBg,
                                            REGIMES_CONFIG[phase.regime]?.badgeText,
                                            REGIMES_CONFIG[phase.regime]?.badgeBorder
                                          )}>
                                            {REGIMES_CONFIG[phase.regime]?.shortLabel}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                            Geral
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setEditingPhaseId(phase.id);
                                          setTempPhaseName(phase.nome);
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover/phase:opacity-100 transition-opacity cursor-pointer rounded"
                                        title="Editar Nome da Etapa"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <select 
                                    value={assignments[phase.key]?.principal || ''}
                                    onChange={(e) => handleAssignmentChange(phase.key, 'principal', e.target.value)}
                                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all cursor-pointer"
                                  >
                                    <option value="">-- Sem Responsável Principal --</option>
                                    {members.map(m => (
                                      <option key={m.id} value={m.id}>{m.nome} ({m.cargo})</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-3">
                                  <select 
                                    value={assignments[phase.key]?.backup || ''}
                                    onChange={(e) => handleAssignmentChange(phase.key, 'backup', e.target.value)}
                                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all cursor-pointer"
                                  >
                                    <option value="">-- Sem Backup --</option>
                                    {members.map(m => (
                                      <option key={m.id} value={m.id}>{m.nome} ({m.cargo})</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-3 text-center">
                                  {phase.id && (
                                    <button 
                                      onClick={() => handleDeletePhase(phase)}
                                      className="p-1 text-slate-300 hover:text-red-600 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                      title="Excluir Etapa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Adicionar / Editar Membro */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 relative">
            <button 
              onClick={() => setShowMemberModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingMemberId ? 'Editar Membro da Equipe' : 'Adicionar Novo Membro'}
            </h3>
            <form onSubmit={handleSaveMember} className="flex flex-col gap-4">
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
                {editingMemberId ? 'Salvar Alterações' : 'Cadastrar Membro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Nova Etapa do Fluxo */}
      {showPhaseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 relative">
            <button 
              onClick={() => setShowPhaseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Incluir Nova Etapa do Fluxo</h3>
            <p className="text-xs text-slate-500 mb-4">
              Selecione o bloco da fase e digite o nome da nova etapa.
            </p>
            <form onSubmit={handleAddPhase} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Bloco / Fase do Fluxo</label>
                <select 
                  value={novaFaseGrupo}
                  onChange={(e) => setNovaFaseGrupo(e.target.value as FaseGrupoEnum)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none bg-white"
                >
                  <option value="fase_1">Fase 1 — Diagnóstico</option>
                  <option value="fase_2">Fase 2 — Plano de Ação</option>
                  <option value="fase_3">Fase 3 — Governança</option>
                  <option value="fase_poc">Módulo POC — Provas de Conceito</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Regime Tributário Alvo</label>
                <select 
                  value={novaFaseRegime}
                  onChange={(e) => setNovaFaseRegime(e.target.value as RegimeEnum | 'geral')}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none bg-white font-medium"
                >
                  <option value="geral">Geral (Aplicável a Todos os Regimes)</option>
                  <option value="regular">Regime Regular (Normal)</option>
                  <option value="especifico">Regimes Específicos (Apurações e Bases Próprias)</option>
                  <option value="diferenciado">Regimes Diferenciados (Alíquotas Reduzidas ou Zero)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Nome da Etapa</label>
                <input 
                  type="text" 
                  value={novaFaseNome}
                  onChange={(e) => setNovaFaseNome(e.target.value)}
                  placeholder="Ex: AUDITORIA EXTERNA" 
                  required 
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none uppercase"
                />
              </div>
              <button 
                type="submit" 
                className="mt-2 w-full h-10 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                Criar Etapa
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Enviar Convite de Usuário */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 relative">
            <button 
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Enviar Convite de Acesso</h3>
                <p className="text-xs text-slate-500">Cadastre o colaborador e envie o convite para a plataforma</p>
              </div>
            </div>

            {inviteErrorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{inviteErrorMsg}</span>
              </div>
            )}

            {inviteSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{inviteSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={inviteNome}
                  onChange={(e) => {
                    setInviteNome(e.target.value);
                    if (!inviteIniciais) {
                      const computed = e.target.value.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                      setInviteIniciais(computed);
                    }
                  }}
                  placeholder="Ex: Ana Souza" 
                  required 
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">E-mail Corporativo</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input 
                    type="email" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ana.souza@empresa.com.br" 
                    required 
                    className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-700 block mb-1">Cargo / Função</label>
                  <input 
                    type="text" 
                    value={inviteCargo}
                    onChange={(e) => setInviteCargo(e.target.value)}
                    placeholder="Ex: Consultor Tributário" 
                    required 
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Iniciais</label>
                  <input 
                    type="text" 
                    value={inviteIniciais}
                    onChange={(e) => setInviteIniciais(e.target.value.toUpperCase())}
                    placeholder="AS" 
                    maxLength={3}
                    required 
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all uppercase text-center font-bold"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed">
                ℹ️ O novo colaborador será cadastrado e atrelado imediatamente às opções de atribuição dos fluxos de trabalho.
              </div>

              <button 
                type="submit" 
                disabled={sendingInvite}
                className="mt-1 w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {sendingInvite ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando Convite...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Convite</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

