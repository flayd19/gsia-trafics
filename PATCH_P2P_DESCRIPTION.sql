-- =====================================================================
-- PATCH: adiciona coluna description na tabela player_market_listings
-- Execute no Supabase SQL Editor
-- =====================================================================

ALTER TABLE player_market_listings
  ADD COLUMN IF NOT EXISTS description text CHECK (char_length(description) <= 150);
