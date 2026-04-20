/**
 * Utilitários para variação aleatória de preços
 */

/**
 * Gera uma variação aleatória de ±10% no preço base
 * @param basePrice - Preço base do produto
 * @returns Novo preço com variação aleatória
 */
export const generatePriceVariation = (basePrice: number): number => {
  // Gera um número aleatório entre -0.1 e 0.1 (±10%)
  const variation = (Math.random() - 0.5) * 0.2;
  
  // Aplica a variação ao preço base
  const newPrice = basePrice * (1 + variation);
  
  // Arredonda para 2 casas decimais
  return Math.round(newPrice * 100) / 100;
};

/**
 * Atualiza os preços de todos os produtos com variação aleatória
 * @param products - Array de produtos
 * @returns Array de produtos com preços atualizados
 */
export const updateProductPrices = (products: any[]): any[] => {
  return products.map(product => ({
    ...product,
    currentPrice: generatePriceVariation(product.baseStreetPrice)
  }));
};

/**
 * Verifica se é hora de atualizar os preços (a cada 30 segundos)
 * @param lastUpdate - Timestamp da última atualização
 * @param currentTime - Timestamp atual
 * @returns true se deve atualizar os preços
 */
export const shouldUpdatePrices = (lastUpdate: number, currentTime: number): boolean => {
  const timeDifference = currentTime - lastUpdate;
  const updateInterval = 30000; // 30 segundos em milissegundos
  
  return timeDifference >= updateInterval;
};