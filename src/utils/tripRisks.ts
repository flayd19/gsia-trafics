// Utility functions for trip risks: vehicle breakdowns and police seizures

import { Vehicle, Driver, Product } from '@/types/game';

export interface RiskCalculation {
  breakdownChance: number;
  seizureChance: number;
  hasIllicitProducts: boolean;
  riskFactors: string[];
}

/**
 * Calcula a chance de quebra do veículo baseado no veículo e motorista
 */
export function calculateBreakdownChance(vehicle: Vehicle, driver?: Driver): number {
  // Chance base do veículo (nunca passa de 10%)
  const baseChance = Math.min(vehicle.breakdownChance || 0.05, 0.10);
  
  // Modificador do motorista (pode aumentar ou diminuir)
  const driverModifier = driver?.breakdownChanceModifier || 0;
  
  // Aplica o modificador (positivo aumenta chance, negativo diminui)
  let finalChance = baseChance + (baseChance * driverModifier);
  
  // Garantir que a chance final não passe de 10% nem seja negativa
  finalChance = Math.max(0, Math.min(finalChance, 0.10));
  
  return finalChance;
}

/**
 * Calcula a chance de apreensão baseado nos produtos e motorista
 */
export function calculateSeizureChance(products: Product[], driver?: Driver): number {
  // Verifica se há produtos ilícitos
  const hasIllicitProducts = products.some(p => p.isIllicit);
  
  if (!hasIllicitProducts) {
    return 0; // Sem produtos ilícitos, sem chance de apreensão
  }
  
  // Chance base de 10% para produtos ilícitos
  let baseChance = 0.10;
  
  // Modificador do motorista
  const driverModifier = driver?.seizureChanceModifier || 0;
  
  // Aplica o modificador
  let finalChance = baseChance + (baseChance * driverModifier);
  
  // Garantir que a chance final não seja negativa nem passe de 100%
  finalChance = Math.max(0, Math.min(finalChance, 1.0));
  
  return finalChance;
}

/**
 * Calcula todos os riscos de uma viagem
 */
export function calculateTripRisks(
  vehicle: Vehicle, 
  products: Product[], 
  driver?: Driver
): RiskCalculation {
  const breakdownChance = calculateBreakdownChance(vehicle, driver);
  const seizureChance = calculateSeizureChance(products, driver);
  const hasIllicitProducts = products.some(p => p.isIllicit);
  
  const riskFactors: string[] = [];
  
  // Fatores de risco por veículo
  if (vehicle.breakdownChance && vehicle.breakdownChance > 0.07) {
    riskFactors.push('Veículo com alta chance de quebra');
  }
  
  // Fatores de risco por motorista
  if (driver?.breakdownChanceModifier && driver.breakdownChanceModifier > 0.1) {
    riskFactors.push('Motorista inexperiente aumenta risco de quebra');
  }
  
  if (driver?.seizureChanceModifier && driver.seizureChanceModifier > 0.2) {
    riskFactors.push('Motorista conhecido da polícia');
  }
  
  // Fatores de risco por produtos
  if (hasIllicitProducts) {
    riskFactors.push('Transportando produtos ilícitos');
  }
  
  return {
    breakdownChance,
    seizureChance,
    hasIllicitProducts,
    riskFactors
  };
}

/**
 * Executa o teste de quebra (rola os dados)
 */
export function rollBreakdownCheck(chance: number): boolean {
  return Math.random() < chance;
}

/**
 * Executa o teste de apreensão (rola os dados)
 */
export function rollSeizureCheck(chance: number): boolean {
  return Math.random() < chance;
}

/**
 * Formata a chance como porcentagem para display
 */
export function formatChanceAsPercentage(chance: number): string {
  return `${(chance * 100).toFixed(1)}%`;
}