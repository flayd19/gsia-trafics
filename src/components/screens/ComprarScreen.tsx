// =====================================================================
// ComprarScreen — Aba "Comprar" com sub-abas Global, P2P e Leilões
// =====================================================================
import { useState } from 'react';
import { Globe, Users, Gavel } from 'lucide-react';
import { FornecedoresCarrosScreen } from './FornecedoresCarrosScreen';
import { PlayerMarketScreen } from './PlayerMarketScreen';
import { AuctionsTab } from './AuctionsTab';
import type { GameState, OwnedCar } from '@/types/game';
import type { GlobalCar } from '@/hooks/useGlobalMarketplace';

interface ComprarScreenProps {
  // ── Estado do jogo ──────────────────────────────────────────
  gameState: GameState;

  // ── Marketplace global ───────────────────────────────────────
  globalCars: GlobalCar[];
  loading: boolean;
  isOnline: boolean;
  errorMsg?: string | null;
  minsLeft: number | null;
  onBuyCar: (car: GlobalCar) => Promise<{ success: boolean; message: string }>;
  onBuyAtPrice?: (car: GlobalCar, price: number) => Promise<{ success: boolean; message: string }>;
  onRefreshMarketplace: () => void | Promise<void>;

  // ── Mercado P2P ──────────────────────────────────────────────
  onSpendMoney: (amount: number) => boolean;
  onAddMoney: (amount: number) => void;
  onAddToGarage: (car: OwnedCar, paidPrice: number) => { success: boolean; message: string };
  onSoldListing: (carInstanceId: string) => void;
}

type SubTab = 'global' | 'p2p' | 'auctions';

export function ComprarScreen(props: ComprarScreenProps) {
  const [subTab, setSubTab] = useState<SubTab>('global');

  const {
    gameState,
    globalCars, loading, isOnline, errorMsg, minsLeft,
    onBuyCar, onBuyAtPrice, onRefreshMarketplace,
    onSpendMoney, onAddMoney, onAddToGarage, onSoldListing,
  } = props;

  return (
    <div className="flex flex-col min-h-0">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-muted rounded-[12px] p-1 mx-0 mb-3">
        <button
          onClick={() => setSubTab('global')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${
            subTab === 'global'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          <Globe size={13} />
          Global
        </button>
        <button
          onClick={() => setSubTab('p2p')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${
            subTab === 'p2p'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          <Users size={13} />
          Jogadores
        </button>
        <button
          onClick={() => setSubTab('auctions')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${
            subTab === 'auctions'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          <Gavel size={13} />
          Leilões
        </button>
      </div>

      {/* Conteúdo da sub-aba */}
      {subTab === 'global' && (
        <FornecedoresCarrosScreen
          gameState={gameState}
          globalCars={globalCars}
          loading={loading}
          isOnline={isOnline}
          errorMsg={errorMsg}
          minsLeft={minsLeft}
          onBuyCar={onBuyCar}
          onBuyAtPrice={onBuyAtPrice}
          onRefreshMarketplace={onRefreshMarketplace}
        />
      )}
      {subTab === 'p2p' && (
        <PlayerMarketScreen
          gameState={gameState as any}
          products={[]}
          onReserveStock={() => {}}
          onReturnStock={() => {}}
          onReceiveStock={() => {}}
          onSpendMoney={onSpendMoney}
          onAddMoney={onAddMoney}
          onAddToGarage={onAddToGarage}
          onSoldListing={onSoldListing}
        />
      )}
      {subTab === 'auctions' && (
        <AuctionsTab
          gameState={gameState}
          onAddCarToGarage={(car) => onAddToGarage(car, car.purchasePrice)}
        />
      )}
    </div>
  );
}
