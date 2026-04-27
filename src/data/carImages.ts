/**
 * Mapeamento de modelId → URL de thumbnail do Wikimedia Commons.
 * URLs diretas via CDN (upload.wikimedia.org/commons/thumb) — sem redirect,
 * sem API key, sem CORS. Calculadas via MD5 do nome do arquivo.
 *
 * Se a imagem falhar no <img onError>, o componente mostra o emoji como fallback.
 */

export const CAR_IMAGES: Record<string, string> = {

  // ── VOLKSWAGEN ───────────────────────────────────────────────────
  gol:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Volkswagen_Gol_G6_2013_01.jpg/480px-Volkswagen_Gol_G6_2013_01.jpg',
  polo:                'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/VW_Polo_VI_IMG_0386.jpg/480px-VW_Polo_VI_IMG_0386.jpg',
  voyage:              'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Volkswagen_Voyage_2011_02.jpg/480px-Volkswagen_Voyage_2011_02.jpg',
  saveiro:             'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Volkswagen_Saveiro_Cross_CE_2017.jpg/480px-Volkswagen_Saveiro_Cross_CE_2017.jpg',
  up:                  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Volkswagen_up!_Pepper_2.jpg/480px-Volkswagen_up!_Pepper_2.jpg',
  tcross:              'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/VW_T-Cross_2021.jpg/480px-VW_T-Cross_2021.jpg',
  golf:                'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Volkswagen_Golf_VII_Comfortline_BlueMotion_01.jpg/480px-Volkswagen_Golf_VII_Comfortline_BlueMotion_01.jpg',
  jetta:               'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Volkswagen_Jetta_VII_2019.jpg/480px-Volkswagen_Jetta_VII_2019.jpg',
  amarok:              'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/VW_Amarok_2.0_TDI_Highline_2012.jpg/480px-VW_Amarok_2.0_TDI_Highline_2012.jpg',
  virtus:              'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Volkswagen_Virtus_Highline_2018.jpg/480px-Volkswagen_Virtus_Highline_2018.jpg',
  nivus:               'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/VW_Nivus_Highline_2020.jpg/480px-VW_Nivus_Highline_2020.jpg',
  taos:                'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Volkswagen_Taos_2022.jpg/480px-Volkswagen_Taos_2022.jpg',
  tiguan:              'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Volkswagen_Tiguan_II_20TSI_Comfortline_2016.jpg/480px-Volkswagen_Tiguan_II_20TSI_Comfortline_2016.jpg',

  // ── FIAT ─────────────────────────────────────────────────────────
  uno:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Fiat_Uno_Vivace_1.0_2015_(14849975737).jpg/480px-Fiat_Uno_Vivace_1.0_2015_(14849975737).jpg',
  mobi:                'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Fiat_Mobi_1.0_Like_2017.jpg/480px-Fiat_Mobi_1.0_Like_2017.jpg',
  argo:                'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Fiat_Argo_Drive_1.0_2018.jpg/480px-Fiat_Argo_Drive_1.0_2018.jpg',
  cronos:              'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Fiat_Cronos_2018.jpg/480px-Fiat_Cronos_2018.jpg',
  strada:              'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Fiat_Strada_Endurance_2021.jpg/480px-Fiat_Strada_Endurance_2021.jpg',
  toro:                'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Fiat_Toro_Ranch_diesel_2020.jpg/480px-Fiat_Toro_Ranch_diesel_2020.jpg',
  pulse:               'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Fiat_Pulse_Abarth_2022.jpg/480px-Fiat_Pulse_Abarth_2022.jpg',
  doblo:               'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Fiat_Doblo_Adventure_2015.jpg/480px-Fiat_Doblo_Adventure_2015.jpg',
  grand_siena:         'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Fiat_Grand_Siena_Attractive_2014.jpg/480px-Fiat_Grand_Siena_Attractive_2014.jpg',
  fastback:            'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Fiat_Fastback_2023.jpg/480px-Fiat_Fastback_2023.jpg',

  // ── CHEVROLET ────────────────────────────────────────────────────
  onix:                'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Chevrolet_Onix_Plus_Premier_2_2020.jpg/480px-Chevrolet_Onix_Plus_Premier_2_2020.jpg',
  onix_plus:           'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Chevrolet_Onix_Plus_LTZ_2022.jpg/480px-Chevrolet_Onix_Plus_LTZ_2022.jpg',
  tracker:             'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Chevrolet_Tracker_Premier_2022.jpg/480px-Chevrolet_Tracker_Premier_2022.jpg',
  montana:             'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Chevrolet_Montana_Midnight_2023.jpg/480px-Chevrolet_Montana_Midnight_2023.jpg',
  s10:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Chevrolet_S10_High_Country_2.8_4x4_2020.jpg/480px-Chevrolet_S10_High_Country_2.8_4x4_2020.jpg',
  spin:                'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Chevrolet_Spin_2018.jpg/480px-Chevrolet_Spin_2018.jpg',
  cruze:               'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Chevrolet_Cruze_2017_LTZ.jpg/480px-Chevrolet_Cruze_2017_LTZ.jpg',
  equinox:             'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Chevrolet_Equinox_2018_facelift.jpg/480px-Chevrolet_Equinox_2018_facelift.jpg',

  // ── FORD ─────────────────────────────────────────────────────────
  ka:                  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Ford_Ka+_Sedan_SE_2018.jpg/480px-Ford_Ka+_Sedan_SE_2018.jpg',
  ecosport:            'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Ford_EcoSport_2018_01.jpg/480px-Ford_EcoSport_2018_01.jpg',
  ranger:              'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Ford_Ranger_XLS_2023.jpg/480px-Ford_Ranger_XLS_2023.jpg',
  fiesta:              'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Ford_Fiesta_Sedan_2015.jpg/480px-Ford_Fiesta_Sedan_2015.jpg',
  focus:               'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Ford_Focus_Sedan_Titanium_2018.jpg/480px-Ford_Focus_Sedan_Titanium_2018.jpg',
  territory:           'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_Territory_2022.jpg/480px-Ford_Territory_2022.jpg',
  maverick_ford:       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Ford_Maverick_pickup_truck_2022.jpg/480px-Ford_Maverick_pickup_truck_2022.jpg',
  bronco_sport:        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Ford_Bronco_Sport_2021_Big_Bend.jpg/480px-Ford_Bronco_Sport_2021_Big_Bend.jpg',

  // ── TOYOTA ───────────────────────────────────────────────────────
  corolla:             'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Toyota_Corolla_Altis_GR-Sport_2022.jpg/480px-Toyota_Corolla_Altis_GR-Sport_2022.jpg',
  hilux:               'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Toyota_Hilux_SRX_4x4_Diesel_2022.jpg/480px-Toyota_Hilux_SRX_4x4_Diesel_2022.jpg',
  yaris:               'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Toyota_Yaris_Sedan_XLS_2019.jpg/480px-Toyota_Yaris_Sedan_XLS_2019.jpg',
  sw4:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Toyota_Hilux_SW4_SRX_2022.jpg/480px-Toyota_Hilux_SW4_SRX_2022.jpg',
  corolla_cross:       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Toyota_Corolla_Cross_XRX_2022.jpg/480px-Toyota_Corolla_Cross_XRX_2022.jpg',
  rav4:                'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Toyota_RAV4_XSE_2019_(48367814247).jpg/480px-Toyota_RAV4_XSE_2019_(48367814247).jpg',
  camry:               'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Toyota_Camry_XV70_Hybrid_2021.jpg/480px-Toyota_Camry_XV70_Hybrid_2021.jpg',
  land_cruiser_prado:  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Toyota_Land_Cruiser_Prado_2022.jpg/480px-Toyota_Land_Cruiser_Prado_2022.jpg',

  // ── HONDA ────────────────────────────────────────────────────────
  civic:               'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Honda_Civic_Touring_2022.jpg/480px-Honda_Civic_Touring_2022.jpg',
  hrv:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Honda_HR-V_EX_2022.jpg/480px-Honda_HR-V_EX_2022.jpg',
  fit:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Honda_Fit_EX-L_2020.jpg/480px-Honda_Fit_EX-L_2020.jpg',
  city:                'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Honda_City_EXL_2021.jpg/480px-Honda_City_EXL_2021.jpg',
  wrv:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Honda_WR-V_2023.jpg/480px-Honda_WR-V_2023.jpg',
  accord:              'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Honda_Accord_Touring_2022.jpg/480px-Honda_Accord_Touring_2022.jpg',

  // ── HYUNDAI ──────────────────────────────────────────────────────
  hb20:                'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Hyundai_HB20_Diamond_Plus_2021.jpg/480px-Hyundai_HB20_Diamond_Plus_2021.jpg',
  hb20s:               'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Hyundai_HB20S_Diamond_2021.jpg/480px-Hyundai_HB20S_Diamond_2021.jpg',
  creta:               'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Hyundai_Creta_Platinum_2022.jpg/480px-Hyundai_Creta_Platinum_2022.jpg',
  tucson:              'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Hyundai_Tucson_NX4_2022.jpg/480px-Hyundai_Tucson_NX4_2022.jpg',
  i30:                 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Hyundai_i30_III_facelift_2020.jpg/480px-Hyundai_i30_III_facelift_2020.jpg',
  santa_fe:            'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Hyundai_Santa_Fe_2021_TM.jpg/480px-Hyundai_Santa_Fe_2021_TM.jpg',

  // ── NISSAN ───────────────────────────────────────────────────────
  kicks:               'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Nissan_Kicks_2021.jpg/480px-Nissan_Kicks_2021.jpg',
  versa:               'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Nissan_Versa_2020_Advance.jpg/480px-Nissan_Versa_2020_Advance.jpg',
  frontier:            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Nissan_Frontier_2022_LE.jpg/480px-Nissan_Frontier_2022_LE.jpg',
  sentra:              'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Nissan_Sentra_SL_2021.jpg/480px-Nissan_Sentra_SL_2021.jpg',
  march:               'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Nissan_March_SL_2020.jpg/480px-Nissan_March_SL_2020.jpg',

  // ── RENAULT ──────────────────────────────────────────────────────
  kwid:                'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Renault_Kwid_2022.jpg/480px-Renault_Kwid_2022.jpg',
  sandero:             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Renault_Sandero_RS_2.0_2020.jpg/480px-Renault_Sandero_RS_2.0_2020.jpg',
  duster:              'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Dacia_Duster_2018_01.jpg/480px-Dacia_Duster_2018_01.jpg',
  logan:               'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Renault_Logan_2022.jpg/480px-Renault_Logan_2022.jpg',
  captur:              'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Renault_Captur_2020.jpg/480px-Renault_Captur_2020.jpg',
  kardian:             'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Renault_Kardian_2023.jpg/480px-Renault_Kardian_2023.jpg',
  oroch:               'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Renault_Oroch_2022.jpg/480px-Renault_Oroch_2022.jpg',

  // ── KIA ──────────────────────────────────────────────────────────
  sportage:            'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Kia_Sportage_NQ5_2022.jpg/480px-Kia_Sportage_NQ5_2022.jpg',
  cerato:              'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Kia_Cerato_2019.jpg/480px-Kia_Cerato_2019.jpg',
  stonic:              'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Kia_Stonic_facelift_2021.jpg/480px-Kia_Stonic_facelift_2021.jpg',

  // ── JEEP ─────────────────────────────────────────────────────────
  renegade:            'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Jeep_Renegade_Trailhawk_2022.jpg/480px-Jeep_Renegade_Trailhawk_2022.jpg',
  compass:             'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Jeep_Compass_Trailhawk_2022.jpg/480px-Jeep_Compass_Trailhawk_2022.jpg',

  // ── PEUGEOT / CITROËN ────────────────────────────────────────────
  peugeot2008:         'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Peugeot_2008_II_2020.jpg/480px-Peugeot_2008_II_2020.jpg',
  peugeot208:          'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Peugeot_208_II_GT_2020.jpg/480px-Peugeot_208_II_GT_2020.jpg',
  c3:                  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Citroën_C3_III_2017.jpg/480px-Citroën_C3_III_2017.jpg',
  c4_cactus:           'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Citroën_C4_Cactus_2018.jpg/480px-Citroën_C4_Cactus_2018.jpg',

  // ── MITSUBISHI ───────────────────────────────────────────────────
  l200:                'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Mitsubishi_L200_Triton_Sport_HPE_2022.jpg/480px-Mitsubishi_L200_Triton_Sport_HPE_2022.jpg',
  eclipse_cross:       'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Mitsubishi_Eclipse_Cross_2020.jpg/480px-Mitsubishi_Eclipse_Cross_2020.jpg',

  // ── CAOA CHERY / BYD ─────────────────────────────────────────────
  tiggo8:              'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Chery_Tiggo_8_Pro_2022.jpg/480px-Chery_Tiggo_8_Pro_2022.jpg',
  byd_dolphin:         'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/BYD_Dolphin_2022.jpg/480px-BYD_Dolphin_2022.jpg',
  byd_king:            'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/BYD_Sea_Lion_6_2024.jpg/480px-BYD_Sea_Lion_6_2024.jpg',

  // ── CLÁSSICOS BRASILEIROS ────────────────────────────────────────
  chevette:            'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Chevrolet_Chevette_1.6_1992.jpg/480px-Chevrolet_Chevette_1.6_1992.jpg',
  monza:               'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Chevrolet_Monza_Classic_SE_1994.jpg/480px-Chevrolet_Monza_Classic_SE_1994.jpg',
  kadett:              'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/GM_Kadett_GLS_1998.jpg/480px-GM_Kadett_GLS_1998.jpg',
  gol_g1:              'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Volkswagen_Gol_1.6_CL_1991.jpg/480px-Volkswagen_Gol_1.6_CL_1991.jpg',
  gol_g2:              'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Volkswagen_Gol_GTi_16V_G2_1998.jpg/480px-Volkswagen_Gol_GTi_16V_G2_1998.jpg',
  santana:             'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Volkswagen_Santana_GL_1993.jpg/480px-Volkswagen_Santana_GL_1993.jpg',
  palio:               'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Fiat_Palio_Weekend_1.8_Adventure_2001.jpg/480px-Fiat_Palio_Weekend_1.8_Adventure_2001.jpg',
  uno_mille:           'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Fiat_Uno_Mille_Fire_Economy_2010.jpg/480px-Fiat_Uno_Mille_Fire_Economy_2010.jpg',
  tempra:              'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Fiat_Tempra_Turbo_1996.jpg/480px-Fiat_Tempra_Turbo_1996.jpg',
  tipo:                'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Fiat_Tipo_2.0_16V_SLX_1996.jpg/480px-Fiat_Tipo_2.0_16V_SLX_1996.jpg',
  escort:              'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Ford_Escort_XR3i_1993.jpg/480px-Ford_Escort_XR3i_1993.jpg',
  passat_classic:      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Volkswagen_Passat_GL_1996.jpg/480px-Volkswagen_Passat_GL_1996.jpg',

  // ── LUXO ─────────────────────────────────────────────────────────
  bmw_320i:            'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/BMW_320i_G20_2021.jpg/480px-BMW_320i_G20_2021.jpg',
  bmw_530i:            'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/BMW_530i_G30_2021.jpg/480px-BMW_530i_G30_2021.jpg',
  bmw_x1:              'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/BMW_X1_xDrive20i_2022.jpg/480px-BMW_X1_xDrive20i_2022.jpg',
  bmw_x3:              'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/BMW_X3_G01_2021.jpg/480px-BMW_X3_G01_2021.jpg',
  mercedes_c200:       'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Mercedes-Benz_C200_W206_2021.jpg/480px-Mercedes-Benz_C200_W206_2021.jpg',
  mercedes_c300:       'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Mercedes-Benz_C300_4MATIC_W206_2022.jpg/480px-Mercedes-Benz_C300_4MATIC_W206_2022.jpg',
  mercedes_gla:        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Mercedes-Benz_GLA_200_H247_2020.jpg/480px-Mercedes-Benz_GLA_200_H247_2020.jpg',
  mercedes_glc:        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Mercedes-Benz_GLC_300_X254_2023.jpg/480px-Mercedes-Benz_GLC_300_X254_2023.jpg',
  audi_a3:             'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Audi_A3_Sedan_8Y_2020.jpg/480px-Audi_A3_Sedan_8Y_2020.jpg',
  audi_q3:             'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Audi_Q3_F3_2019.jpg/480px-Audi_Q3_F3_2019.jpg',
  audi_q5:             'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Audi_Q5_FY_2020.jpg/480px-Audi_Q5_FY_2020.jpg',
  lr_evoque:           'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Range_Rover_Evoque_2019.jpg/480px-Range_Rover_Evoque_2019.jpg',
  lr_discovery_sport:  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Land_Rover_Discovery_Sport_2020.jpg/480px-Land_Rover_Discovery_Sport_2020.jpg',
  lr_defender:         'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Land_Rover_Defender_110_2020.jpg/480px-Land_Rover_Defender_110_2020.jpg',
  volvo_xc40:          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Volvo_XC40_2019.jpg/480px-Volvo_XC40_2019.jpg',
  volvo_xc60:          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Volvo_XC60_II_2017.jpg/480px-Volvo_XC60_II_2017.jpg',
  porsche_macan:       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Porsche_Macan_2019.jpg/480px-Porsche_Macan_2019.jpg',

  // ── ESPORTIVOS ───────────────────────────────────────────────────
  mustang:             'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/2024_Ford_Mustang_GT_Fastback_(facelift,_black).jpg/480px-2024_Ford_Mustang_GT_Fastback_(facelift,_black).jpg',
  gr86:                'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Toyota_GR86_2022.jpg/480px-Toyota_GR86_2022.jpg',
  civic_type_r:        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Honda_Civic_Type_R_FL5_2023.jpg/480px-Honda_Civic_Type_R_FL5_2023.jpg',
  golf_gti:            'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Volkswagen_Golf_GTI_Mk8_2021.jpg/480px-Volkswagen_Golf_GTI_Mk8_2021.jpg',
  wrx_sti:             'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/2018_Subaru_WRX_STI.jpg/480px-2018_Subaru_WRX_STI.jpg',
  i30n:                'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Hyundai_i30_N_Performance_2022.jpg/480px-Hyundai_i30_N_Performance_2022.jpg',
  corvette_c8:         'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/2020_Chevrolet_Corvette_Stingray_3LT.jpg/480px-2020_Chevrolet_Corvette_Stingray_3LT.jpg',
  corvette_c7_z06:     'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/2016_Chevrolet_Corvette_Z06_2LZ.jpg/480px-2016_Chevrolet_Corvette_Z06_2LZ.jpg',
  camaro_ss:           'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/2023_Chevrolet_Camaro_SS.jpg/480px-2023_Chevrolet_Camaro_SS.jpg',
  camaro_zl1:          'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/2022_Chevrolet_Camaro_ZL1.jpg/480px-2022_Chevrolet_Camaro_ZL1.jpg',
  challenger_hellcat:  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/2023_Dodge_Challenger_SRT_Hellcat_Redeye.jpg/480px-2023_Dodge_Challenger_SRT_Hellcat_Redeye.jpg',
  charger_srt:         'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/2022_Dodge_Charger_SRT_392.jpg/480px-2022_Dodge_Charger_SRT_392.jpg',
  shelby_gt500:        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/2020_Ford_Shelby_GT500.jpg/480px-2020_Ford_Shelby_GT500.jpg',
  bmw_m2:              'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/BMW_M2_G87_2023.jpg/480px-BMW_M2_G87_2023.jpg',
  bmw_m3:              'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/BMW_M3_Competition_G80_2021.jpg/480px-BMW_M3_Competition_G80_2021.jpg',
  bmw_m4:              'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/BMW_M4_Competition_G82_2021.jpg/480px-BMW_M4_Competition_G82_2021.jpg',
  mercedes_amg_a45:    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Mercedes-AMG_A_45_S_W177_2019.jpg/480px-Mercedes-AMG_A_45_S_W177_2019.jpg',
  mercedes_amg_c63:    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Mercedes-AMG_C63_S_E_Performance_2023.jpg/480px-Mercedes-AMG_C63_S_E_Performance_2023.jpg',
  mercedes_amg_gt:     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Mercedes-AMG_GT_C190_2020.jpg/480px-Mercedes-AMG_GT_C190_2020.jpg',
  audi_rs3:            'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Audi_RS3_8Y_Sportback_2021.jpg/480px-Audi_RS3_8Y_Sportback_2021.jpg',
  audi_rs6:            'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Audi_RS6_Avant_C8_2020.jpg/480px-Audi_RS6_Avant_C8_2020.jpg',
  alfa_giulia_qv:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Alfa_Romeo_Giulia_Quadrifoglio_2019.jpg/480px-Alfa_Romeo_Giulia_Quadrifoglio_2019.jpg',
  renault_megane_rs:   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Renault_Megane_RS_Trophy-R_2020.jpg/480px-Renault_Megane_RS_Trophy-R_2020.jpg',

  // ── JDM ──────────────────────────────────────────────────────────
  nissan_gtr_r35:      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Nissan_GT-R_(R35)_–_Frontansicht.jpg/480px-Nissan_GT-R_(R35)_–_Frontansicht.jpg',
  nissan_gtr_r34:      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Nissan_Skyline_R34_GTR_V-spec.jpg/480px-Nissan_Skyline_R34_GTR_V-spec.jpg',
  nissan_gtr_r33:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Nissan_Skyline_R33_GTST.jpg/480px-Nissan_Skyline_R33_GTST.jpg',
  nissan_gtr_r32:      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Nissan_Skyline_R32_GT-R_front.jpg/480px-Nissan_Skyline_R32_GT-R_front.jpg',
  toyota_supra_mk4:    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Toyota_Supra_A80.jpg/480px-Toyota_Supra_A80.jpg',
  toyota_supra_mk5:    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Toyota_GR_Supra_A90_red.jpg/480px-Toyota_GR_Supra_A90_red.jpg',
  mazda_rx7_fd:        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Mazda_RX-7_(FD)_-_Frontansicht_(2).jpg/480px-Mazda_RX-7_(FD)_-_Frontansicht_(2).jpg',
  mazda_rx7_fc:        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Mazda_RX-7_FC3S.jpg/480px-Mazda_RX-7_FC3S.jpg',
  mazda_rx8:           'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Mazda_RX-8_Spirit_R_2011.jpg/480px-Mazda_RX-8_Spirit_R_2011.jpg',
  honda_s2000:         'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Honda_S2000_AP2_(black).jpg/480px-Honda_S2000_AP2_(black).jpg',
  honda_nsx_na1:       'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Honda_NSX_1991_(14370837956).jpg/480px-Honda_NSX_1991_(14370837956).jpg',
  mitsubishi_evo9:     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Mitsubishi_Lancer_Evolution_IX.jpg/480px-Mitsubishi_Lancer_Evolution_IX.jpg',
  mitsubishi_evo10:    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Mitsubishi_Lancer_Evolution_X_Final_Edition.jpg/480px-Mitsubishi_Lancer_Evolution_X_Final_Edition.jpg',
  mitsubishi_evo8:     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Mitsubishi_Lancer_Evolution_VIII_MR.jpg/480px-Mitsubishi_Lancer_Evolution_VIII_MR.jpg',
  nissan_350z:         'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Nissan_350Z_2006.jpg/480px-Nissan_350Z_2006.jpg',
  nissan_370z:         'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Nissan_370Z_NISMO_2019.jpg/480px-Nissan_370Z_NISMO_2019.jpg',
  nissan_z_rz34:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Nissan_Z_Proto_Concept.jpg/480px-Nissan_Z_Proto_Concept.jpg',
  nissan_silvia_s15:   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Nissan_Silvia_S15.jpg/480px-Nissan_Silvia_S15.jpg',
  nissan_180sx:        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Nissan_180SX.jpg/480px-Nissan_180SX.jpg',
  honda_integra_type_r: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Honda_Integra_Type-R_DC5.jpg/480px-Honda_Integra_Type-R_DC5.jpg',
  ae86:                'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Toyota_Sprinter_Trueno_AE86.jpg/480px-Toyota_Sprinter_Trueno_AE86.jpg',
  celica_gt4:          'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Toyota_Celica_GT-Four_ST205_1993.jpg/480px-Toyota_Celica_GT-Four_ST205_1993.jpg',
  subaru_brz:          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Subaru_BRZ_tS_2023.jpg/480px-Subaru_BRZ_tS_2023.jpg',
  mazda_mx5:           'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Mazda_MX-5_(ND)_–_Frontansicht_(2).jpg/480px-Mazda_MX-5_(ND)_–_Frontansicht_(2).jpg',
  mitsubishi_eclipse_gsx: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Mitsubishi_Eclipse_GS-X_1G.jpg/480px-Mitsubishi_Eclipse_GS-X_1G.jpg',
  toyota_gr_yaris:     'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Toyota_GR_Yaris_Circuit_Pack_2020.jpg/480px-Toyota_GR_Yaris_Circuit_Pack_2020.jpg',
  toyota_gr_corolla:   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Toyota_GR_Corolla_Circuit_Edition_2023.jpg/480px-Toyota_GR_Corolla_Circuit_Edition_2023.jpg',
  hyundai_elantra_n:   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Hyundai_Elantra_N_2021.jpg/480px-Hyundai_Elantra_N_2021.jpg',
  kia_stinger_gt:      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Kia_Stinger_GT_2018.jpg/480px-Kia_Stinger_GT_2018.jpg',

  // ── SUPERCAR ─────────────────────────────────────────────────────
  lamborghini_huracan: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Lamborghini_Huracán_EVO_Spyder_2019.jpg/480px-Lamborghini_Huracán_EVO_Spyder_2019.jpg',
  lamborghini_aventador: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Lamborghini_Aventador_S_2018.jpg/480px-Lamborghini_Aventador_S_2018.jpg',
  ferrari_488:         'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Ferrari_488_GTB_2016.jpg/480px-Ferrari_488_GTB_2016.jpg',
  ferrari_f8:          'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Ferrari_F8_Tributo_2019.jpg/480px-Ferrari_F8_Tributo_2019.jpg',
  ferrari_296:         'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Ferrari_296_GTB_2022.jpg/480px-Ferrari_296_GTB_2022.jpg',
  mclaren_720s:        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/McLaren_720S_Spider_2018.jpg/480px-McLaren_720S_Spider_2018.jpg',
  mclaren_570s:        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/McLaren_570S_2015.jpg/480px-McLaren_570S_2015.jpg',
  porsche_911_gt3:     'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Porsche_911_GT3_RS_992_2022.jpg/480px-Porsche_911_GT3_RS_992_2022.jpg',
  porsche_911_turbo_s: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Porsche_911_Turbo_S_992_2021.jpg/480px-Porsche_911_Turbo_S_992_2021.jpg',
  porsche_cayman_gt4:  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Porsche_718_Cayman_GT4_RS_2021.jpg/480px-Porsche_718_Cayman_GT4_RS_2021.jpg',
  audi_r8:             'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Audi_R8_V10_Plus_2016.jpg/480px-Audi_R8_V10_Plus_2016.jpg',
  honda_nsx_type_s:    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Honda_NSX_NC1_2020.jpg/480px-Honda_NSX_NC1_2020.jpg',
  ford_gt_mk4:         'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Ford_GT_2005.jpg/480px-Ford_GT_2005.jpg',

};
