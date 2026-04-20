/**
 * Utility functions for normalizing game data during migration from old code
 */
import { MARKETPLACE_DRIVERS } from '@/data/gameData'

/**
 * Normalizes a value to a number, returning a default if invalid
 * @param n - Value to normalize
 * @param def - Default value if normalization fails
 * @returns Normalized number or default
 */
export function normalizeNumber(n: any, def = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

/**
 * Normalizes a value to an array, returning a default if invalid
 * @param a - Value to normalize
 * @param def - Default array if normalization fails
 * @returns Normalized array or default
 */
export function normalizeArray(a: any, def: any[] = []): any[] {
  return Array.isArray(a) ? a : def;
}

/**
 * Normalizes a value to an object, returning a default if invalid
 * @param o - Value to normalize
 * @param def - Default object if normalization fails
 * @returns Normalized object or default
 */
export function normalizeObject(o: any, def: any = {}): any {
  return o && typeof o === 'object' && !Array.isArray(o) ? o : def;
}

/**
 * Default game time seed for new games
 */
export const SEED_GAME_TIME = {
  day: 1,
  hour: 6,
  minute: 0,
  lastUpdate: 0
};

/**
 * Normalizes game state data from database or old format (for useGameProgressSimple)
 * @param db - Raw database data
 * @returns Normalized game state
 */
export function normalizeGameState(db: any) {
  console.log('🔧 [NORMALIZATION] normalizeGameState chamado com:', db);
  console.log('🔧 [NORMALIZATION] Enterprises no db:', db.enterprises);
  
  const normalizedEnterprises = normalizeArray(db.enterprises);
  console.log('🔧 [NORMALIZATION] Enterprises normalizados:', normalizedEnterprises);
  
  // Migração de motoristas para garantir que tenham dailyWage
  const rawDrivers = normalizeArray(db.drivers);
  const migratedDrivers = rawDrivers.map(driver => {
    if (!driver.dailyWage) {
      console.log('🔧 [MIGRATION] Motorista sem dailyWage:', driver.name);
      // Buscar no marketplace
      const marketplaceDriver = MARKETPLACE_DRIVERS.find(md => md.name === driver.name);
      if (marketplaceDriver && marketplaceDriver.specs?.dailyWage) {
        driver.dailyWage = marketplaceDriver.specs.dailyWage;
        console.log('🔧 [MIGRATION] dailyWage adicionado do marketplace:', driver.dailyWage);
      } else {
        driver.dailyWage = 257; // Fallback
        console.log('🔧 [MIGRATION] dailyWage fallback aplicado:', driver.dailyWage);
      }
    }
    return driver;
  });
  
  const result = {
    money: normalizeNumber(db.money, 20000),
    vehicles: normalizeArray(db.vehicles),
    inventory: normalizeNumber(db.inventory, 0),
    drivers: migratedDrivers,
    buyers: normalizeArray(db.buyers),
    motorcycles: normalizeArray(db.motorcycles),
    pending_deliveries: normalizeArray(db.pending_deliveries),
    police_interceptions: normalizeArray(db.police_interceptions),
    current_trips: normalizeArray(db.current_trips),
    gameTime: normalizeObject(db.gameTime || db.game_time, SEED_GAME_TIME),
    warehouse_level: normalizeNumber(db.warehouse_level, 1),
    warehouse_capacity: normalizeNumber(db.warehouse_capacity, 1440),
    current_warehouse: db.current_warehouse || 'rua36',
    lawyer_hired: Boolean(db.lawyer_hired),
    tow_truck_hired: Boolean(db.tow_truck_hired),
    stock: normalizeObject(db.stock),
    overdraft_limit: normalizeNumber(db.overdraft_limit, -30000),
    last_price_update: normalizeNumber(db.last_price_update, 0),
    completed_orders: normalizeNumber(db.completed_orders, 0),
    last_interest_calculation: normalizeNumber(db.last_interest_calculation, 1),
    last_weekly_cost_paid: normalizeNumber(db.last_weekly_cost_paid, 1),
    last_buyer_generation: normalizeNumber(db.last_buyer_generation, 1),
    completed_sales_in_cycle: normalizeNumber(db.completed_sales_in_cycle, 0),
    vehicle_sales: normalizeArray(db.vehicle_sales),
    product_sales: normalizeArray(db.product_sales),
    enterprises: normalizedEnterprises,
  };
  
  console.log('🔧 [NORMALIZATION] Resultado final enterprises:', result.enterprises);
  return result;
}

/**
 * Normalizes game state data for useGameProgress (vehicles as number)
 * @param db - Raw database data
 * @returns Normalized game state for complex backend
 */
export function normalizeGameStateComplex(db: any) {
  return {
    money: normalizeNumber(db.money, 20000),
    vehicles: normalizeNumber(db.vehicles, 1),
    inventory: normalizeNumber(db.inventory, 0),
    drivers: normalizeArray(db.drivers),
    buyers: normalizeArray(db.buyers),
    motorcycles: normalizeArray(db.motorcycles),
    pending_deliveries: normalizeArray(db.pending_deliveries),
    police_interceptions: normalizeArray(db.police_interceptions),
    current_trips: normalizeArray(db.current_trips),
    gameTime: normalizeObject(db.gameTime || db.game_time, SEED_GAME_TIME),
    warehouse_level: normalizeNumber(db.warehouse_level, 1),
    warehouse_capacity: normalizeNumber(db.warehouse_capacity, 1440),
    current_warehouse: db.current_warehouse || 'rua36',
    lawyer_hired: Boolean(db.lawyer_hired),
    tow_truck_hired: Boolean(db.tow_truck_hired),
    stock: normalizeObject(db.stock),
    overdraft_limit: normalizeNumber(db.overdraft_limit, -30000),
    last_price_update: normalizeNumber(db.last_price_update, 0),
    completed_orders: normalizeNumber(db.completed_orders, 0),
    last_interest_calculation: normalizeNumber(db.last_interest_calculation, 1),
    last_weekly_cost_paid: normalizeNumber(db.last_weekly_cost_paid, 1),
    last_buyer_generation: normalizeNumber(db.last_buyer_generation, 1),
    completed_sales_in_cycle: normalizeNumber(db.completed_sales_in_cycle, 0),
    vehicle_sales: normalizeArray(db.vehicle_sales),
    enterprises: normalizeArray(db.enterprises),
  };
}