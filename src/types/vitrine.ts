// =====================================================================
// vitrine.ts — Vitrine (public marketplace), freight & escrow types
// Doc 06 — Multiplayer Interactions
// =====================================================================

export type PaymentTerms = 'avista' | 'parcelado';

export type OfferStatus = 'active' | 'sold_out' | 'cancelled' | 'expired';

export interface VitrineOffer {
  id:              string;
  sellerId:        string;
  sellerName:      string;
  companyId:       string;
  companyName:     string;
  productId:       string;
  productName:     string;
  regionId:        string;
  totalQty:        number;
  availableQty:    number;
  pricePerUnit:    number;
  minQty:          number;
  paymentTerms:    PaymentTerms;
  installments:    number;
  status:          OfferStatus;
  expiresAt?:      string | null;
  createdAt:       string;
  // PMR comparison tag populated client-side
  pmrTag?:         'green' | 'yellow' | 'red';
}

export type FreightStatus =
  | 'open'
  | 'accepted'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface FreightCall {
  id:               string;
  originOfferId?:   string | null;
  buyerId:          string;
  buyerName:        string;
  sellerId:         string;
  originRegionId:   string;
  destRegionId:     string;
  productId:        string;
  productName:      string;
  qty:              number;
  freightValue:     number;
  carrierId?:       string | null;
  carrierName?:     string | null;
  carrierCompanyId?: string | null;
  acceptedAt?:      string | null;
  expectedBy?:      string | null;
  deliveredAt?:     string | null;
  status:           FreightStatus;
  createdAt:        string;
}

export type EscrowStatus =
  | 'held'
  | 'released_seller'
  | 'released_buyer'
  | 'disputed';

export interface EscrowHold {
  id:             string;
  freightCallId:  string;
  buyerId:        string;
  sellerId:       string;
  carrierId?:     string | null;
  productValue:   number;
  freightValue:   number;
  totalValue:     number;
  status:         EscrowStatus;
  releasedAt?:    string | null;
  createdAt:      string;
}

export interface PaymentSchedule {
  id:            string;
  escrowId:      string;
  installmentNo: number;
  amount:        number;
  dueAt:         string;
  paidAt?:       string | null;
  status:        'pending' | 'paid' | 'overdue';
}

// ── Form types ────────────────────────────────────────────────────────

export interface PublishOfferForm {
  companyId:    string;
  companyName:  string;
  productId:    string;
  productName:  string;
  regionId:     string;
  totalQty:     number;
  pricePerUnit: number;
  minQty:       number;
  paymentTerms: PaymentTerms;
  installments: number;
}

export interface BuyOfferForm {
  offerId: string;
  qty:     number;
  destRegionId: string;
}
