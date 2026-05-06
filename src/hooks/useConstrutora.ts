// =====================================================================
// useConstrutora — Estado principal do jogo de construtora
// Gestão de empresa: dinheiro, funcionários, máquinas, galpão, obras
// =====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GameState,
  Employee,
  Machine,
  WarehouseItem,
  ActiveWork,
  WorkRecord,
  AllocatedEmployee,
  AllocatedMachine,
  ConsumedMaterial,
  EmployeeType,
  WorkType,
} from '@/types/game';
import { ensureGameState } from '@/types/game';
import {
  EMPLOYEE_TYPES,
  MACHINE_CATALOG,
  MATERIALS,
  currentMaterialPrice,
  randomEmployeeName,
  getMaterialDef,
} from '@/data/construction';
import {
  buildActiveWork,
  tickActiveWork,
  checkRequirements,
  calcWorkCost,
  calcTempoEstimadoMin,
  calcProducaoPerMin,
} from '@/lib/obraEngine';
import { ensureReputation, addXp, XP_REWARDS } from '@/lib/reputation';
import { supabase } from '@/integrations/supabase/client';

// ── Config ────────────────────────────────────────────────────────────
const LOCAL_SAVE_KEY      = 'gsia_construtora_v1';
const PROPERTIES_SAVE_KEY = 'gsia_properties_v2';
const AUTO_SAVE_MS        = 30_000;
const TICK_MS             = 1_000;
/** 1 tick real (10s) = 1 minuto de jogo. 1 dia de jogo = ~4 minutos reais. */
const GAME_CLOCK_TICK_MS  = 10_000;
const XP_PER_CONTRACT: Record<WorkType, number> = {
  pequena: 15,
  media:   40,
  grande:  120,
  mega:    400,
};

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Hook ──────────────────────────────────────────────────────────────
export function useConstrutora() {
  const [gameState,  setGameState]  = useState<GameState>(() => ensureGameState({}));
  const [gameLoaded, setGameLoaded] = useState(false);
  const [playerName, setPlayerName] = useState('Jogador');
  // localStorage é síncrono; sem sync remoto neste build → sempre false
  const isSyncing = false;

  const stateRef    = useRef(gameState);
  const mountedRef  = useRef(true);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameState>;
        setGameState(ensureGameState(parsed));
      }
    } catch { /* fallback */ }
    setGameLoaded(true);
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from('player_profiles')
        .select('display_name')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          const name = profile?.display_name || data.user?.email?.split('@')[0] || 'Jogador';
          if (mountedRef.current) setPlayerName(name);
        });
    });
  }, []);

  const saveGame = useCallback((state: GameState = stateRef.current) => {
    try {
      localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setInterval(() => saveGame(), AUTO_SAVE_MS);
    return () => clearInterval(t);
  }, [saveGame]);

  // ── Relógio do jogo (1 tick real = 1 minuto de jogo) ────────────
  useEffect(() => {
    const t = setInterval(() => {
      if (!mountedRef.current) return;
      setGameState(prev => {
        const gt = prev.gameTime;
        let minute = gt.minute + 1;
        let hour   = gt.hour;
        let day    = gt.day;
        if (minute >= 60) { minute = 0; hour++; }
        if (hour   >= 24) { hour   = 0; day++;  }
        const next = { ...prev, gameTime: { day, hour, minute, lastUpdate: Date.now() } };
        if (day !== gt.day) saveGame(next);
        return next;
      });
    }, GAME_CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, [saveGame]);

  // ── Tick de obras ───────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      if (!mountedRef.current) return;
      const now = Date.now();
      setGameState(prev => {
        const hasRunning = prev.activeWorks.some(w => w.status === 'running');
        if (!hasRunning) return prev;

        const updatedWorks = prev.activeWorks.map(w => tickActiveWork(w, now));
        const justCompleted = updatedWorks.filter(
          (w, i) => w.status === 'completed' && prev.activeWorks[i]!.status === 'running',
        );

        if (justCompleted.length === 0) {
          return { ...prev, activeWorks: updatedWorks };
        }

        let money = prev.money;
        let totalRevenue = prev.totalRevenue;
        let totalSpent   = prev.totalSpent;
        let completedContracts = prev.completedContracts;
        let rep = ensureReputation(prev.reputation);
        const newHistory: WorkRecord[] = [...prev.workHistory];

        for (const work of justCompleted) {
          const timeTakenMin = (now - work.startedAt) / 60_000;
          const cost = calcWorkCost(
            work.allocatedEmployees,
            work.allocatedMachines,
            work.consumedMaterials,
            timeTakenMin,
          );

          const operationalCost = cost.laborCost + cost.machineCost;
          const profit    = work.contractValue - operationalCost - cost.materialCost;
          const profitPct = Math.round((profit / work.contractValue) * 100);

          money        += work.contractValue - operationalCost;
          totalRevenue += work.contractValue;
          totalSpent   += operationalCost;
          completedContracts++;

          const xpGain = XP_PER_CONTRACT[work.tipo] ?? 15;
          rep = addXp(rep, xpGain);

          newHistory.unshift({
            id:            genId(),
            nome:          work.nome,
            tipo:          work.tipo,
            contractValue: work.contractValue,
            totalCost:     cost.total,
            profit,
            profitPct,
            tamanhoM2:     work.tamanhoM2,
            completedAt:   now,
            timeTakenMin:  Math.round(timeTakenMin),
            succeeded:     true,
          });
        }

        const completedIds = new Set(justCompleted.map(w => w.id));
        const freeEmployees = prev.employees.map(e =>
          e.assignedWorkId && completedIds.has(e.assignedWorkId)
            ? { ...e, status: 'idle' as const, assignedWorkId: undefined }
            : e
        );
        const freeMachines = prev.machines.map(m =>
          m.assignedWorkId && completedIds.has(m.assignedWorkId)
            ? { ...m, status: 'idle' as const, assignedWorkId: undefined }
            : m
        );

        const next: GameState = {
          ...prev,
          money,
          totalRevenue,
          totalSpent,
          completedContracts,
          reputation: rep,
          employees: freeEmployees,
          machines:  freeMachines,
          activeWorks: updatedWorks.filter(w => w.status !== 'completed'),
          workHistory: newHistory.slice(0, 50),
        };
        saveGame(next);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [saveGame]);

  // ── Helpers ──────────────────────────────────────────────────────
  const addMoney = useCallback((amount: number) => {
    setGameState(prev => {
      const next = { ...prev, money: prev.money + amount };
      saveGame(next);
      return next;
    });
  }, [saveGame]);

  const spendMoney = useCallback((amount: number): boolean => {
    if (stateRef.current.money < amount) return false;
    setGameState(prev => {
      const next = { ...prev, money: prev.money - amount, totalSpent: prev.totalSpent + amount };
      saveGame(next);
      return next;
    });
    return true;
  }, [saveGame]);

  // ── Funcionários ─────────────────────────────────────────────────
  const hireEmployee = useCallback((type: EmployeeType): { ok: boolean; message: string } => {
    const def = EMPLOYEE_TYPES.find(d => d.type === type);
    if (!def) return { ok: false, message: 'Tipo inválido.' };
    const rep = ensureReputation(stateRef.current.reputation);
    if (rep.level < def.minLevel) return { ok: false, message: `Requer nível ${def.minLevel}.` };
    if (stateRef.current.money < def.hiringCost) return { ok: false, message: 'Saldo insuficiente.' };

    const employee: Employee = {
      instanceId: genId(),
      type,
      name:       randomEmployeeName(),
      skill:      Math.round(50 + Math.random() * 40),
      status:     'idle',
      hiredAt:    Date.now(),
    };

    setGameState(prev => {
      const next = { ...prev, money: prev.money - def.hiringCost, totalSpent: prev.totalSpent + def.hiringCost, employees: [...prev.employees, employee] };
      saveGame(next);
      return next;
    });
    return { ok: true, message: `${def.label} contratado!` };
  }, [saveGame]);

  const fireEmployee = useCallback((instanceId: string): { ok: boolean; message: string } => {
    const emp = stateRef.current.employees.find(e => e.instanceId === instanceId);
    if (!emp) return { ok: false, message: 'Funcionário não encontrado.' };
    if (emp.status === 'working') return { ok: false, message: 'Não pode demitir em obra.' };
    setGameState(prev => {
      const next = { ...prev, employees: prev.employees.filter(e => e.instanceId !== instanceId) };
      saveGame(next);
      return next;
    });
    return { ok: true, message: 'Funcionário demitido.' };
  }, [saveGame]);

  // ── Máquinas ─────────────────────────────────────────────────────
  const buyMachine = useCallback((typeId: string): { ok: boolean; message: string } => {
    const def = MACHINE_CATALOG.find(m => m.typeId === typeId);
    if (!def) return { ok: false, message: 'Máquina inválida.' };
    const rep = ensureReputation(stateRef.current.reputation);
    if (rep.level < def.minLevel) return { ok: false, message: `Requer nível ${def.minLevel}.` };
    if (stateRef.current.money < def.purchasePrice) return { ok: false, message: 'Saldo insuficiente.' };

    const machine: Machine = {
      instanceId:    genId(),
      typeId:        def.typeId,
      name:          def.name,
      icon:          def.icon,
      category:      def.category,
      costPerMin:    def.costPerMin,
      purchasePrice: def.purchasePrice,
      status:        'idle',
      purchasedAt:   Date.now(),
    };

    setGameState(prev => {
      const next = { ...prev, money: prev.money - def.purchasePrice, totalSpent: prev.totalSpent + def.purchasePrice, machines: [...prev.machines, machine] };
      saveGame(next);
      return next;
    });
    return { ok: true, message: `${def.name} adquirida!` };
  }, [saveGame]);

  const sellMachine = useCallback((instanceId: string): { ok: boolean; message: string } => {
    const mach = stateRef.current.machines.find(m => m.instanceId === instanceId);
    if (!mach) return { ok: false, message: 'Máquina não encontrada.' };
    if (mach.status === 'working') return { ok: false, message: 'Em uso numa obra.' };
    const resaleValue = Math.round(mach.purchasePrice * 0.5);
    setGameState(prev => {
      const next = { ...prev, money: prev.money + resaleValue, machines: prev.machines.filter(m => m.instanceId !== instanceId) };
      saveGame(next);
      return next;
    });
    return { ok: true, message: `Máquina vendida por R$ ${resaleValue.toLocaleString('pt-BR')}.` };
  }, [saveGame]);

  // ── Galpão ───────────────────────────────────────────────────────
  const buyMaterial = useCallback((materialId: string, quantity: number, unitPrice: number): { ok: boolean; message: string } => {
    const total = quantity * unitPrice;
    if (stateRef.current.money < total) return { ok: false, message: 'Saldo insuficiente.' };
    const def = getMaterialDef(materialId);
    if (!def) return { ok: false, message: 'Material inválido.' };

    setGameState(prev => {
      const existing = prev.warehouse.find(w => w.materialId === materialId);
      let newWarehouse: WarehouseItem[];
      if (existing) {
        const totalQty = existing.quantity + quantity;
        const avgPrice = (existing.unitPrice * existing.quantity + unitPrice * quantity) / totalQty;
        newWarehouse = prev.warehouse.map(w => w.materialId === materialId ? { ...w, quantity: totalQty, unitPrice: avgPrice } : w);
      } else {
        newWarehouse = [...prev.warehouse, { materialId, name: def.name, category: def.category, unit: def.unit, quantity, unitPrice, icon: def.icon }];
      }
      const next = { ...prev, money: prev.money - total, totalSpent: prev.totalSpent + total, warehouse: newWarehouse };
      saveGame(next);
      return next;
    });
    return { ok: true, message: `${def.name} comprado!` };
  }, [saveGame]);

  // ── Iniciar obra ─────────────────────────────────────────────────
  const startWork = useCallback((params: {
    licitacaoId:        string;
    nome:               string;
    tipo:               WorkType;
    tamanhoM2:          number;
    contractValue:      number;
    allocatedEmployees: AllocatedEmployee[];
    allocatedMachines:  AllocatedMachine[];
    materialQtys:       { materialId: string; quantity: number }[];
  }): { ok: boolean; message: string } => {
    const state = stateRef.current;

    const consumedMaterials: ConsumedMaterial[] = params.materialQtys.map(mq => {
      const wItem = state.warehouse.find(w => w.materialId === mq.materialId);
      return { materialId: mq.materialId, name: wItem?.name ?? mq.materialId, quantity: mq.quantity, unitPrice: wItem?.unitPrice ?? 0 };
    });

    const newWarehouse: WarehouseItem[] = state.warehouse
      .map(w => {
        const consumed = consumedMaterials.find(c => c.materialId === w.materialId);
        if (!consumed) return w;
        return { ...w, quantity: w.quantity - consumed.quantity };
      })
      .filter(w => w.quantity > 0);

    const work = buildActiveWork({
      licitacaoId:        params.licitacaoId,
      nome:               params.nome,
      tipo:               params.tipo,
      tamanhoM2:          params.tamanhoM2,
      contractValue:      params.contractValue,
      allocatedEmployees: params.allocatedEmployees,
      allocatedMachines:  params.allocatedMachines,
      consumedMaterials,
    });

    const workId  = work.id;
    const empIds  = new Set(params.allocatedEmployees.map(e => e.instanceId));
    const machIds = new Set(params.allocatedMachines.map(m => m.instanceId));

    setGameState(prev => {
      const next: GameState = {
        ...prev,
        warehouse: newWarehouse,
        employees: prev.employees.map(e => empIds.has(e.instanceId)  ? { ...e, status: 'working' as const, assignedWorkId: workId } : e),
        machines:  prev.machines.map(m  => machIds.has(m.instanceId) ? { ...m, status: 'working' as const, assignedWorkId: workId } : m),
        activeWorks: [...prev.activeWorks, work],
      };
      saveGame(next);
      return next;
    });
    return { ok: true, message: 'Obra iniciada!' };
  }, [saveGame]);

  // ── Gerenciar obra em andamento ──────────────────────────────────
  const addEmployeeToWork = useCallback((workId: string, instanceId: string): { ok: boolean; message: string } => {
    const state = stateRef.current;
    const work = state.activeWorks.find(w => w.id === workId);
    if (!work || work.status !== 'running') return { ok: false, message: 'Obra não encontrada.' };
    const emp = state.employees.find(e => e.instanceId === instanceId);
    if (!emp) return { ok: false, message: 'Funcionário não encontrado.' };
    if (emp.status !== 'idle') return { ok: false, message: 'Funcionário já está ocupado.' };

    const now = Date.now();
    setGameState(prev => {
      const w = prev.activeWorks.find(w => w.id === workId);
      if (!w || w.status !== 'running') return prev;
      const e = prev.employees.find(e => e.instanceId === instanceId);
      if (!e || e.status !== 'idle') return prev;

      const newAllocated: AllocatedEmployee[] = [
        ...w.allocatedEmployees,
        { instanceId: e.instanceId, type: e.type, name: e.name, skill: e.skill },
      ];
      const newProducao = calcProducaoPerMin(newAllocated);
      const remainingM2 = Math.max(0, w.tamanhoM2 - w.currentM2Done);
      const newEstCompletion = newProducao > 0
        ? now + (remainingM2 / newProducao) * 60_000
        : now + 99_999 * 60_000;

      const next: GameState = {
        ...prev,
        employees: prev.employees.map(e => e.instanceId === instanceId ? { ...e, status: 'working' as const, assignedWorkId: workId } : e),
        activeWorks: prev.activeWorks.map(w => w.id === workId ? { ...w, allocatedEmployees: newAllocated, producaoPerMin: newProducao, estimatedCompletesAt: newEstCompletion } : w),
      };
      saveGame(next);
      return next;
    });
    return { ok: true, message: 'Funcionário adicionado à obra!' };
  }, [saveGame]);

  const removeEmployeeFromWork = useCallback((workId: string, instanceId: string): { ok: boolean; message: string } => {
    const state = stateRef.current;
    const work = state.activeWorks.find(w => w.id === workId);
    if (!work || work.status !== 'running') return { ok: false, message: 'Obra não encontrada.' };
    const inWork = work.allocatedEmployees.some(e => e.instanceId === instanceId);
    if (!inWork) return { ok: false, message: 'Funcionário não está alocado nesta obra.' };

    const now = Date.now();
    setGameState(prev => {
      const w = prev.activeWorks.find(w => w.id === workId);
      if (!w || w.status !== 'running') return prev;

      const newAllocated = w.allocatedEmployees.filter(e => e.instanceId !== instanceId);
      const newProducao  = calcProducaoPerMin(newAllocated);
      const remainingM2  = Math.max(0, w.tamanhoM2 - w.currentM2Done);
      const newEstCompletion = newProducao > 0
        ? now + (remainingM2 / newProducao) * 60_000
        : now + 99_999 * 60_000;

      const next: GameState = {
        ...prev,
        employees: prev.employees.map(e => e.instanceId === instanceId ? { ...e, status: 'idle' as const, assignedWorkId: undefined } : e),
        activeWorks: prev.activeWorks.map(w => w.id === workId ? { ...w, allocatedEmployees: newAllocated, producaoPerMin: newProducao, estimatedCompletesAt: newEstCompletion } : w),
      };
      saveGame(next);
      return next;
    });
    return { ok: true, message: 'Funcionário liberado da obra.' };
  }, [saveGame]);

  const addMachineToWork = useCallback((workId: string, instanceId: string): { ok: boolean; message: string } => {
    const state = stateRef.current;
    const work  = state.activeWorks.find(w => w.id === workId);
    if (!work || work.status !== 'running') return { ok: false, message: 'Obra não encontrada.' };
    const mach = state.machines.find(m => m.instanceId === instanceId);
    if (!mach) return { ok: false, message: 'Máquina não encontrada.' };
    if (mach.status !== 'idle') return { ok: false, message: 'Máquina já está em uso.' };

    setGameState(prev => {
      const w = prev.activeWorks.find(w => w.id === workId);
      if (!w || w.status !== 'running') return prev;
      const m = prev.machines.find(m => m.instanceId === instanceId);
      if (!m || m.status !== 'idle') return prev;

      const next: GameState = {
        ...prev,
        machines: prev.machines.map(m => m.instanceId === instanceId ? { ...m, status: 'working' as const, assignedWorkId: workId } : m),
        activeWorks: prev.activeWorks.map(w => w.id === workId
          ? { ...w, allocatedMachines: [...w.allocatedMachines, { instanceId: m.instanceId, typeId: m.typeId, name: m.name, icon: m.icon, costPerMin: m.costPerMin }] }
          : w),
      };
      saveGame(next);
      return next;
    });
    return { ok: true, message: 'Máquina adicionada à obra!' };
  }, [saveGame]);

  const removeMachineFromWork = useCallback((workId: string, instanceId: string): { ok: boolean; message: string } => {
    const state = stateRef.current;
    const work = state.activeWorks.find(w => w.id === workId);
    if (!work || work.status !== 'running') return { ok: false, message: 'Obra não encontrada.' };
    const inWork = work.allocatedMachines.some(m => m.instanceId === instanceId);
    if (!inWork) return { ok: false, message: 'Máquina não está alocada nesta obra.' };

    setGameState(prev => {
      const w = prev.activeWorks.find(w => w.id === workId);
      if (!w || w.status !== 'running') return prev;

      const next: GameState = {
        ...prev,
        machines: prev.machines.map(m => m.instanceId === instanceId ? { ...m, status: 'idle' as const, assignedWorkId: undefined } : m),
        activeWorks: prev.activeWorks.map(w => w.id === workId
          ? { ...w, allocatedMachines: w.allocatedMachines.filter(m => m.instanceId !== instanceId) }
          : w),
      };
      saveGame(next);
      return next;
    });
    return { ok: true, message: 'Máquina liberada da obra.' };
  }, [saveGame]);

  // ── Reset ────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    // Limpa também o save dos imóveis
    try { localStorage.removeItem(PROPERTIES_SAVE_KEY); } catch { /* ignore */ }
    const fresh = ensureGameState({});
    setGameState(fresh);
    saveGame(fresh);
  }, [saveGame]);

  // ── Preços NPC ───────────────────────────────────────────────────
  const getNpcPrices = useCallback(() => {
    return MATERIALS.map(m => ({ ...m, currentPrice: currentMaterialPrice(m) }));
  }, []);

  // ── Verificar requisitos ─────────────────────────────────────────
  const checkWorkRequirements = useCallback((req: import('@/types/game').WorkRequirements) => {
    const s = stateRef.current;
    return checkRequirements(req, s.employees, s.machines, s.warehouse);
  }, []);

  const reputation    = ensureReputation(gameState.reputation);
  const idleEmployees = gameState.employees.filter(e => e.status === 'idle');
  const idleMachines  = gameState.machines.filter(m => m.status === 'idle');

  return {
    gameState,
    gameLoaded,
    isSyncing,
    playerName,
    reputation,
    idleEmployees,
    idleMachines,

    addMoney,
    spendMoney,
    hireEmployee,
    fireEmployee,
    buyMachine,
    sellMachine,
    buyMaterial,
    startWork,
    addEmployeeToWork,
    removeEmployeeFromWork,
    addMachineToWork,
    removeMachineFromWork,
    resetGame,
    saveGame,
    getNpcPrices,
    checkWorkRequirements,
  };
}
