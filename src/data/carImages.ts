/**
 * Mapeamento de modelId → URL de imagem do Wikimedia Commons.
 * Usa Special:FilePath que redireciona automaticamente para o arquivo correto
 * sem necessidade de calcular hashes MD5. Funciona diretamente em <img src>.
 * Se a imagem falhar (onError), o componente mostra o emoji do carro como fallback.
 */

export const CAR_IMAGES: Record<string, string> = {

  // ── VOLKSWAGEN ───────────────────────────────────────────────────
  gol:                'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Gol_G5_2009.jpg?width=480',
  polo:               'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Polo_Mk6_IMG_3046.jpg?width=480',
  voyage:             'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Voyage_2011_02.jpg?width=480',
  saveiro:            'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Saveiro_Cross_CE_2017.jpg?width=480',
  up:                 'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_up!_white.jpg?width=480',
  tcross:             'https://commons.wikimedia.org/wiki/Special:FilePath/VW_T-Cross_2021.jpg?width=480',
  golf:               'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Golf_VII_Comfortline.jpg?width=480',
  jetta:              'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Jetta_VII_2018.jpg?width=480',
  amarok:             'https://commons.wikimedia.org/wiki/Special:FilePath/VW_Amarok_2012.jpg?width=480',
  virtus:             'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Virtus_Highline_2018.jpg?width=480',
  nivus:              'https://commons.wikimedia.org/wiki/Special:FilePath/VW_Nivus_front.jpg?width=480',
  taos:               'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Taos_2022_front.jpg?width=480',
  tiguan:             'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Tiguan_II.jpg?width=480',
  golf_gti:           'https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen_Golf_GTI_Mk8.jpg?width=480',

  // ── FIAT ─────────────────────────────────────────────────────────
  uno:                'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Uno_Vivace_2013.jpg?width=480',
  uno_mille:          'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Uno_Mille_1999.jpg?width=480',
  mobi:               'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Mobi_1.0_2016.jpg?width=480',
  argo:               'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Argo_Drive_1.0_2018.jpg?width=480',
  cronos:             'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Cronos_2018.jpg?width=480',
  strada:             'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Strada_2013.jpg?width=480',
  toro:               'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Toro_2016.jpg?width=480',
  pulse:              'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Pulse_2022.jpg?width=480',
  doblo:              'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Doblo_2015.jpg?width=480',
  grand_siena:        'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Grand_Siena_2012.jpg?width=480',
  fastback:           'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Fastback_2022.jpg?width=480',
  palio:              'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Palio_2000.jpg?width=480',
  tempra:             'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Tempra_1992.jpg?width=480',
  tipo:               'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Tipo_1996.jpg?width=480',

  // ── CHEVROLET ────────────────────────────────────────────────────
  onix:               'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Onix_LT_2013.jpg?width=480',
  onix_plus:          'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Onix_Plus_2020.jpg?width=480',
  tracker:            'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Tracker_2020.jpg?width=480',
  montana:            'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Montana_2023.jpg?width=480',
  s10:                'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_S10_LTZ_2016.jpg?width=480',
  spin:               'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Spin_2014.jpg?width=480',
  cruze:              'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Cruze_2016.jpg?width=480',
  equinox:            'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Equinox_2022.jpg?width=480',
  chevette:           'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Chevette_1980.jpg?width=480',
  monza:              'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Monza_1992.jpg?width=480',
  kadett:             'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Kadett_1992.jpg?width=480',
  corvette_c8:        'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Corvette_C8_2020.jpg?width=480',
  corvette_c7_z06:    'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Corvette_Z06_C7.jpg?width=480',
  camaro_ss:          'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Camaro_SS_2016.jpg?width=480',
  camaro_zl1:         'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Camaro_ZL1_2017.jpg?width=480',

  // ── FORD ─────────────────────────────────────────────────────────
  ka:                 'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Ka_2016.jpg?width=480',
  ecosport:           'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_EcoSport_2014.jpg?width=480',
  ranger:             'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Ranger_2019.jpg?width=480',
  fiesta:             'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Fiesta_2015.jpg?width=480',
  focus:              'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Focus_2016.jpg?width=480',
  territory:          'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Territory_2021.jpg?width=480',
  maverick_ford:      'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Maverick_2022.jpg?width=480',
  bronco_sport:       'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Bronco_Sport_2021.jpg?width=480',
  escort:             'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Escort_1996.jpg?width=480',
  mustang:            'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Mustang_2024.jpg?width=480',
  shelby_gt500:       'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Shelby_GT500_2020.jpg?width=480',

  // ── TOYOTA ───────────────────────────────────────────────────────
  corolla:            'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Corolla_E210_2019.jpg?width=480',
  hilux:              'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Hilux_2016.jpg?width=480',
  yaris:              'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Yaris_2020.jpg?width=480',
  sw4:                'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Fortuner_2020.jpg?width=480',
  corolla_cross:      'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Corolla_Cross_2022.jpg?width=480',
  rav4:               'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_RAV4_2019.jpg?width=480',
  camry:              'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Camry_2021.jpg?width=480',
  land_cruiser_prado: 'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Land_Cruiser_Prado_2020.jpg?width=480',
  gr86:               'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_GR86_2022.jpg?width=480',

  // ── HONDA ────────────────────────────────────────────────────────
  civic:              'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_Civic_X_Sedan_2016.jpg?width=480',
  hrv:                'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_HR-V_2015.jpg?width=480',
  fit:                'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_Fit_2015.jpg?width=480',
  city:               'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_City_2014.jpg?width=480',
  wrv:                'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_WR-V_2017.jpg?width=480',
  accord:             'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_Accord_2018.jpg?width=480',
  civic_type_r:       'https://commons.wikimedia.org/wiki/Special:FilePath/Honda_Civic_Type_R_FL5.jpg?width=480',

  // ── HYUNDAI ──────────────────────────────────────────────────────
  hb20:               'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_HB20_2012.jpg?width=480',
  hb20s:              'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_HB20S_2013.jpg?width=480',
  creta:              'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_Creta_2017.jpg?width=480',
  tucson:             'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_Tucson_2020.jpg?width=480',
  i30:                'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_i30_2017.jpg?width=480',
  santa_fe:           'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_Santa_Fe_2021.jpg?width=480',
  i30n:               'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_i30_N_2021.jpg?width=480',

  // ── NISSAN ───────────────────────────────────────────────────────
  kicks:              'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Kicks_2016.jpg?width=480',
  versa:              'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Versa_2020.jpg?width=480',
  frontier:           'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Frontier_2016.jpg?width=480',
  sentra:             'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Sentra_2020.jpg?width=480',
  march:              'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_March_2016.jpg?width=480',
  nissan_gtr_r35:     'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_GT-R_R35_2009.jpg?width=480',
  nissan_gtr_r34:     'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Skyline_GT-R_R34.jpg?width=480',
  nissan_gtr_r33:     'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Skyline_GT-R_BCNR33.jpg?width=480',
  nissan_gtr_r32:     'https://commons.wikimedia.org/wiki/Special:FilePath/Nissan_Skyline_GT-R_BNR32.jpg?width=480',

  // ── RENAULT ──────────────────────────────────────────────────────
  kwid:               'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Kwid_2019.jpg?width=480',
  sandero:            'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Sandero_2014.jpg?width=480',
  duster:             'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Duster_2020.jpg?width=480',
  logan:              'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Logan_2014.jpg?width=480',
  captur:             'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Captur_2020.jpg?width=480',
  kardian:            'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Kardian_2023.jpg?width=480',
  oroch:              'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Oroch_2016.jpg?width=480',
  renault_megane_rs:  'https://commons.wikimedia.org/wiki/Special:FilePath/Renault_Megane_RS_2018.jpg?width=480',

  // ── KIA ──────────────────────────────────────────────────────────
  sportage:           'https://commons.wikimedia.org/wiki/Special:FilePath/Kia_Sportage_2022.jpg?width=480',
  cerato:             'https://commons.wikimedia.org/wiki/Special:FilePath/Kia_Cerato_2019.jpg?width=480',
  stonic:             'https://commons.wikimedia.org/wiki/Special:FilePath/Kia_Stonic_2020.jpg?width=480',

  // ── JEEP ─────────────────────────────────────────────────────────
  renegade:           'https://commons.wikimedia.org/wiki/Special:FilePath/Jeep_Renegade_2014.jpg?width=480',
  compass:            'https://commons.wikimedia.org/wiki/Special:FilePath/Jeep_Compass_2017.jpg?width=480',

  // ── PEUGEOT / CITROËN ────────────────────────────────────────────
  peugeot2008:        'https://commons.wikimedia.org/wiki/Special:FilePath/Peugeot_2008_2019.jpg?width=480',
  peugeot208:         'https://commons.wikimedia.org/wiki/Special:FilePath/Peugeot_208_2019.jpg?width=480',
  c3:                 'https://commons.wikimedia.org/wiki/Special:FilePath/Citroën_C3_2017.jpg?width=480',
  c4_cactus:          'https://commons.wikimedia.org/wiki/Special:FilePath/Citroën_C4_Cactus_2018.jpg?width=480',

  // ── MITSUBISHI ───────────────────────────────────────────────────
  l200:               'https://commons.wikimedia.org/wiki/Special:FilePath/Mitsubishi_L200_2019.jpg?width=480',
  eclipse_cross:      'https://commons.wikimedia.org/wiki/Special:FilePath/Mitsubishi_Eclipse_Cross_2018.jpg?width=480',

  // ── CHERY / BYD ──────────────────────────────────────────────────
  tiggo8:             'https://commons.wikimedia.org/wiki/Special:FilePath/Chery_Tiggo_8_2021.jpg?width=480',
  byd_dolphin:        'https://commons.wikimedia.org/wiki/Special:FilePath/BYD_Dolphin_2022.jpg?width=480',
  byd_king:           'https://commons.wikimedia.org/wiki/Special:FilePath/BYD_Seal_2022.jpg?width=480',

  // ── CLÁSSICOS ────────────────────────────────────────────────────
  chevette:           'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Chevette_1980.jpg?width=480',
  monza:              'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Monza_1992.jpg?width=480',
  kadett:             'https://commons.wikimedia.org/wiki/Special:FilePath/Chevrolet_Kadett_1992.jpg?width=480',
  gol_g1:             'https://commons.wikimedia.org/wiki/Special:FilePath/VW_Gol_1987.jpg?width=480',
  gol_g2:             'https://commons.wikimedia.org/wiki/Special:FilePath/VW_Gol_G2_1998.jpg?width=480',
  santana:            'https://commons.wikimedia.org/wiki/Special:FilePath/VW_Santana_1984.jpg?width=480',
  palio:              'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Palio_2000.jpg?width=480',
  tempra:             'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Tempra_1992.jpg?width=480',
  tipo:               'https://commons.wikimedia.org/wiki/Special:FilePath/Fiat_Tipo_1996.jpg?width=480',
  escort:             'https://commons.wikimedia.org/wiki/Special:FilePath/Ford_Escort_1996.jpg?width=480',
  passat_classic:     'https://commons.wikimedia.org/wiki/Special:FilePath/VW_Passat_1985.jpg?width=480',

  // ── LUXO / PREMIUM ───────────────────────────────────────────────
  bmw_320i:           'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_3_Series_F30.jpg?width=480',
  bmw_530i:           'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_5_Series_G30.jpg?width=480',
  bmw_x1:             'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_X1_2020.jpg?width=480',
  bmw_x3:             'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_X3_2019.jpg?width=480',
  bmw_m2:             'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_M2_G87_2023.jpg?width=480',
  bmw_m3:             'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_M3_G80_2021.jpg?width=480',
  bmw_m4:             'https://commons.wikimedia.org/wiki/Special:FilePath/BMW_M4_G82_2021.jpg?width=480',
  mercedes_c200:      'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz_C200_W205.jpg?width=480',
  mercedes_c300:      'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz_C300_4MATIC.jpg?width=480',
  mercedes_gla:       'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz_GLA_2020.jpg?width=480',
  mercedes_glc:       'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz_GLC_2019.jpg?width=480',
  mercedes_amg_a45:   'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-AMG_A45_S_2020.jpg?width=480',
  mercedes_amg_c63:   'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-AMG_C63_2022.jpg?width=480',
  mercedes_amg_gt:    'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-AMG_GT_S_2015.jpg?width=480',
  audi_a3:            'https://commons.wikimedia.org/wiki/Special:FilePath/Audi_A3_Sedan_2020.jpg?width=480',
  audi_q3:            'https://commons.wikimedia.org/wiki/Special:FilePath/Audi_Q3_2020.jpg?width=480',
  audi_q5:            'https://commons.wikimedia.org/wiki/Special:FilePath/Audi_Q5_2018.jpg?width=480',
  audi_rs3:           'https://commons.wikimedia.org/wiki/Special:FilePath/Audi_RS3_Sedan_2022.jpg?width=480',
  audi_rs6:           'https://commons.wikimedia.org/wiki/Special:FilePath/Audi_RS6_Avant_2020.jpg?width=480',
  lr_evoque:          'https://commons.wikimedia.org/wiki/Special:FilePath/Range_Rover_Evoque_2020.jpg?width=480',
  lr_discovery_sport: 'https://commons.wikimedia.org/wiki/Special:FilePath/Land_Rover_Discovery_Sport_2020.jpg?width=480',
  lr_defender:        'https://commons.wikimedia.org/wiki/Special:FilePath/Land_Rover_Defender_110_2020.jpg?width=480',
  volvo_xc40:         'https://commons.wikimedia.org/wiki/Special:FilePath/Volvo_XC40_2018.jpg?width=480',
  volvo_xc60:         'https://commons.wikimedia.org/wiki/Special:FilePath/Volvo_XC60_2017.jpg?width=480',
  porsche_macan:      'https://commons.wikimedia.org/wiki/Special:FilePath/Porsche_Macan_2014.jpg?width=480',
  alfa_giulia_qv:     'https://commons.wikimedia.org/wiki/Special:FilePath/Alfa_Romeo_Giulia_QV_2016.jpg?width=480',

  // ── MUSCLE / AMERICAN ────────────────────────────────────────────
  challenger_hellcat: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dodge_Challenger_Hellcat_2015.jpg?width=480',
  charger_srt:        'https://commons.wikimedia.org/wiki/Special:FilePath/Dodge_Charger_SRT_2016.jpg?width=480',

  // ── SUBARU ───────────────────────────────────────────────────────
  wrx_sti:            'https://commons.wikimedia.org/wiki/Special:FilePath/Subaru_WRX_STI_2018.jpg?width=480',
};
