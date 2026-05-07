// =====================================================================
// useWorkInvites — Sistema de colaboração entre jogadores
// Dono cria convite → colaborador aceita → recursos são combinados
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ActiveWork } from '@/types/game';
import { EMPLOYEE_TYPES, MACHINE_CATALOG } from '@/data/construction';

// ── Types ─────────────────────────────────────────────────────────

export interface NeededEmployee {
  type:     string;
  label:    string;
  icon:     string;
  quantity: number;
}

export interface NeededMachine {
  typeId:   string;
  name:     string;
  icon:     string;
  quantity: number;
}

export interface NeededResources {
  employees: NeededEmployee[];
  machines:  NeededMachine[];
}

export interface WorkSnapshot {
  workId:        string;
  nome:          string;
  tipo:          string;
  tamanhoM2:     number;
  contractValue: number;
  progressPct:   number;
  efficiencyPct: number;
  deadline:      number;
}

export interface WorkInvite {
  id:                    string;
  owner_id:              string;
  owner_name:            string;
  work_snapshot:         WorkSnapshot;
  needed_resources:      NeededResources;
  payment_amount:        number;
  status:                'open' | 'accepted' | 'cancelled' | 'completed';
  collaborator_id:       string | null;
  collaborator_name:     string | null;
  contributed_resources: NeededResources | null;
  created_at:            string;
  expires_at:            string;
  completed_at:          string | null;
}

// ── Auto-detect missing resources from a work ─────────────────────

export function detectMissingResources(work: ActiveWork): NeededResources {
  const req = work.requisitos;
  if (!req) return { employees: [], machines: [] };

  const employees: NeededEmployee[] = [];
  const machines:  NeededMachine[]  = [];

  for (const er of req.employees) {
    const allocated = work.allocatedEmployees.filter(e => e.type === er.type).length;
    const missing   = Math.max(0, er.quantity - allocated);
    if (missing > 0) {
      const def = EMPLOYEE_TYPES.find(d => d.type === er.type);
      employees.push({
        type:     er.type,
        label:    def?.label ?? er.type,
        icon:     def?.icon  ?? '👷',
        quantity: missing,
      });
    }
  }

  for (const mr of req.machines) {
    const allocated = work.allocatedMachines.filter(m => m.typeId === mr.typeId).length;
    const missing   = Math.max(0, mr.quantity - allocated);
    if (missing > 0) {
      const def = MACHINE_CATALOG.find(d => d.typeId === mr.typeId);
      machines.push({
        typeId:   mr.typeId,
        name:     mr.name,
        icon:     def?.icon ?? '🚜',
        quantity: missing,
      });
    }
  }

  return { employees, machines };
}

// ── Hook ──────────────────────────────────────────────────────────

export function useWorkInvites(playerName: string) {
  const [openInvites,    setOpenInvites]    = useState<WorkInvite[]>([]);
  const [myInvites,      setMyInvites]      = useState<WorkInvite[]>([]);
  const [myCollabs,      setMyCollabs]      = useState<WorkInvite[]>([]);
  const [loading,        setLoading]        = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load data ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !mountedRef.current) return;

    const now = new Date().toISOString();

    // Open invites from other players (not expired, not mine)
    const { data: open } = await supabase
      .from('work_invites')
      .select('*')
      .eq('status', 'open')
      .neq('owner_id', user.id)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(20);

    // My sent invites
    const { data: mine } = await supabase
      .from('work_invites')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Invites I accepted as collaborator
    const { data: collabs } = await supabase
      .from('work_invites')
      .select('*')
      .eq('collaborator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!mountedRef.current) return;
    setOpenInvites((open ?? []) as WorkInvite[]);
    setMyInvites((mine ?? []) as WorkInvite[]);
    setMyCollabs((collabs ?? []) as WorkInvite[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Real-time subscription ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('work_invites_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_invites' }, () => {
        if (mountedRef.current) refresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  // ── Actions ───────────────────────────────────────────────────

  const createInvite = useCallback(async (params: {
    work:            ActiveWork;
    neededResources: NeededResources;
    paymentAmount:   number;
  }): Promise<{ ok: boolean; message: string; inviteId?: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'Não autenticado.' };

    const snapshot: WorkSnapshot = {
      workId:        params.work.id,
      nome:          params.work.nome,
      tipo:          params.work.tipo,
      tamanhoM2:     params.work.tamanhoM2,
      contractValue: params.work.contractValue,
      progressPct:   params.work.progressPct,
      efficiencyPct: params.work.efficiencyPct,
      deadline:      params.work.deadline,
    };

    setLoading(true);
    const { data, error } = await supabase
      .from('work_invites')
      .insert({
        owner_id:         user.id,
        owner_name:       playerName,
        work_snapshot:    snapshot,
        needed_resources: params.neededResources,
        payment_amount:   params.paymentAmount,
        status:           'open',
        expires_at:       new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    setLoading(false);

    if (error) return { ok: false, message: error.message };
    await refresh();
    return { ok: true, message: 'Convite criado!', inviteId: data.id };
  }, [playerName, refresh]);

  const acceptInvite = useCallback(async (
    inviteId: string,
    contributedResources: NeededResources,
  ): Promise<{ ok: boolean; message: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'Não autenticado.' };

    setLoading(true);
    const { error } = await supabase
      .from('work_invites')
      .update({
        status:                'accepted',
        collaborator_id:       user.id,
        collaborator_name:     playerName,
        contributed_resources: contributedResources,
      })
      .eq('id', inviteId)
      .eq('status', 'open');
    setLoading(false);

    if (error) return { ok: false, message: error.message };
    await refresh();
    return { ok: true, message: 'Colaboração aceita!' };
  }, [playerName, refresh]);

  const cancelInvite = useCallback(async (
    inviteId: string,
  ): Promise<{ ok: boolean; message: string }> => {
    const { error } = await supabase
      .from('work_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId);

    if (error) return { ok: false, message: error.message };
    await refresh();
    return { ok: true, message: 'Convite cancelado.' };
  }, [refresh]);

  const completeInvite = useCallback(async (
    inviteId: string,
  ): Promise<{ ok: boolean; message: string }> => {
    const { error } = await supabase
      .from('work_invites')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (error) return { ok: false, message: error.message };
    await refresh();
    return { ok: true, message: 'Colaboração concluída!' };
  }, [refresh]);

  return {
    openInvites,
    myInvites,
    myCollabs,
    loading,
    refresh,
    createInvite,
    acceptInvite,
    cancelInvite,
    completeInvite,
    detectMissingResources,
  };
}
