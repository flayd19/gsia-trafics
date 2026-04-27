/**
 * Mapeamento de modelId → URL de imagem do carro.
 * Fontes: Wikimedia Commons (Special:FilePath redirect), Wikipedia thumbnail API.
 * Todos os links são públicos e gratuitos.
 *
 * Caso a imagem falhe no <img onError>, o componente exibe o icon emoji como fallback.
 */

const WC = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`;

export const CAR_IMAGES: Record<string, string> = {

  // ── VOLKSWAGEN ──────────────────────────────────────────────────
  gol:        WC('Volkswagen_Gol_G6_2013_(2).jpg'),
  polo:       WC('VW_Polo_VI_IMG_0386.jpg'),
  voyage:     WC('Volkswagen_Voyage_2011_02.jpg'),
  saveiro:    WC('Volkswagen_Saveiro_Cross_2015.jpg'),
  up:         WC('Volkswagen_up!_–_Frontansicht,_22._April_2012,_Düsseldorf.jpg'),
  tcross:     WC('Volkswagen_T-Cross_2019_01.jpg'),
  golf:       WC('Volkswagen_Golf_VII_Comfortline_BlueMotion_01.jpg'),
  jetta:      WC('Volkswagen_Jetta_Mk7.jpg'),
  amarok:     WC('Volkswagen_Amarok_Trendline_V6_2017.jpg'),
  virtus:     WC('Volkswagen_Virtus_Highline_2018.jpg'),
  nivus:      WC('VW_Nivus_2021.jpg'),
  taos:       WC('Volkswagen_Taos_2022.jpg'),
  tiguan:     WC('Volkswagen_Tiguan_2017_–_Frontansicht,_26._August_2017,_Düsseldorf.jpg'),

  // ── FIAT ────────────────────────────────────────────────────────
  uno:        WC('Fiat_Uno_Vivace_1.0_2015_(14849975737).jpg'),
  mobi:       WC('Fiat_Mobi_2016_02.jpg'),
  argo:       WC('Fiat_Argo_Drive_1.0_2017.jpg'),
  cronos:     WC('Fiat_Cronos_Drive_1.3_2018.jpg'),
  strada:     WC('Fiat_Strada_Endurance_2021.jpg'),
  toro:       WC('Fiat_Toro_Freedom_2.0_4x2_AT_2017.jpg'),
  pulse:      WC('Fiat_Pulse_2022.jpg'),
  doblo:      WC('Fiat_Doblò_Adventure_1.8_2013.jpg'),
  grand_siena: WC('Fiat_Grand_Siena_Attractive_1.4_2014.jpg'),
  fastback:   WC('Fiat_Fastback_Impetus_2023.jpg'),

  // ── CHEVROLET ────────────────────────────────────────────────────
  onix:       WC('Chevrolet_Onix_Plus_Premier_2_2020.jpg'),
  onix_plus:  WC('Chevrolet_Onix_Plus_LT_2022.jpg'),
  tracker:    WC('Chevrolet_Tracker_Premier_2021.jpg'),
  montana:    WC('Chevrolet_Montana_Premier_2023.jpg'),
  s10:        WC('Chevrolet_S10_High_Country_2021.jpg'),
  spin:       WC('Chevrolet_Spin_2013_Activ_7S.jpg'),
  cruze:      WC('Chevrolet_Cruze_LTZ_2017.jpg'),
  equinox:    WC('Chevrolet_Equinox_2018.jpg'),

  // ── FORD ────────────────────────────────────────────────────────
  ka:         WC('Ford_Ka_2018_Brasil_freestyle.jpg'),
  ecosport:   WC('Ford_EcoSport_2018_Titanium.jpg'),
  ranger:     WC('Ford_Ranger_XLT_2022.jpg'),
  fiesta:     WC('Ford_Fiesta_Sedan_SE_2016.jpg'),
  focus:      WC('Ford_Focus_Sedan_Titanium_2018.jpg'),
  territory:  WC('Ford_Territory_Titanium_2022.jpg'),
  maverick_ford: WC('Ford_Maverick_2022_XLT.jpg'),
  bronco_sport: WC('Ford_Bronco_Sport_Badlands_2021.jpg'),

  // ── TOYOTA ──────────────────────────────────────────────────────
  corolla:    WC('Toyota_Corolla_Altis_GR-Sport_2021_Brasil.jpg'),
  hilux:      WC('Toyota_Hilux_SRX_2021.jpg'),
  yaris:      WC('Toyota_Yaris_Sedan_XLS_2020.jpg'),
  sw4:        WC('Toyota_SW4_SRX_2022.jpg'),
  corolla_cross: WC('Toyota_Corolla_Cross_XRX_2022.jpg'),
  rav4:       WC('Toyota_RAV4_2019_Dynamic.jpg'),
  camry:      WC('Toyota_Camry_XSE_Hybrid_2022.jpg'),
  land_cruiser_prado: WC('Toyota_Land_Cruiser_Prado_2022.jpg'),

  // ── HONDA ────────────────────────────────────────────────────────
  civic:      WC('Honda_Civic_Touring_2022_Brasil.jpg'),
  hrv:        WC('Honda_HR-V_Touring_2022.jpg'),
  fit:        WC('Honda_Fit_EXL_2020.jpg'),
  city:       WC('Honda_City_EXL_2021.jpg'),
  wrv:        WC('Honda_WR-V_EXL_2023.jpg'),
  accord:     WC('Honda_Accord_Touring_2022.jpg'),

  // ── HYUNDAI ─────────────────────────────────────────────────────
  hb20:       WC('Hyundai_HB20_Diamond_Plus_2021.jpg'),
  hb20s:      WC('Hyundai_HB20S_2021.jpg'),
  creta:      WC('Hyundai_Creta_Platinum_2022.jpg'),
  tucson:     WC('Hyundai_Tucson_GLS_2022.jpg'),
  i30:        WC('Hyundai_i30_GLS_2021.jpg'),
  santa_fe:   WC('Hyundai_Santa_Fe_2021.jpg'),

  // ── NISSAN ──────────────────────────────────────────────────────
  kicks:      WC('Nissan_Kicks_Advance_2022.jpg'),
  versa:      WC('Nissan_Versa_Advance_2023.jpg'),
  frontier:   WC('Nissan_Frontier_LE_2022.jpg'),
  sentra:     WC('Nissan_Sentra_SL_2022.jpg'),
  march:      WC('Nissan_March_SL_2020.jpg'),

  // ── RENAULT ─────────────────────────────────────────────────────
  kwid:       WC('Renault_Kwid_Intense_2022.jpg'),
  sandero:    WC('Renault_Sandero_RS_2021.jpg'),
  duster:     WC('Renault_Duster_Iconic_2022.jpg'),
  logan:      WC('Renault_Logan_Iconic_2022.jpg'),
  captur:     WC('Renault_Captur_Intense_2021.jpg'),
  kardian:    WC('Renault_Kardian_2023.jpg'),
  oroch:      WC('Renault_Oroch_Dynamique_2022.jpg'),

  // ── KIA ─────────────────────────────────────────────────────────
  sportage:   WC('Kia_Sportage_2022_EX.jpg'),
  cerato:     WC('Kia_Cerato_SX_2021.jpg'),
  stonic:     WC('Kia_Stonic_2022.jpg'),

  // ── JEEP ────────────────────────────────────────────────────────
  renegade:   WC('Jeep_Renegade_Trailhawk_2022.jpg'),
  compass:    WC('Jeep_Compass_Trailhawk_2022.jpg'),

  // ── PEUGEOT / CITROËN ───────────────────────────────────────────
  peugeot2008: WC('Peugeot_2008_GT_2022.jpg'),
  peugeot208:  WC('Peugeot_208_GT_2021.jpg'),
  c3:          WC('Citroën_C3_Shine_2022.jpg'),
  c4_cactus:   WC('Citroën_C4_Cactus_Shine_2022.jpg'),

  // ── MITSUBISHI ──────────────────────────────────────────────────
  l200:           WC('Mitsubishi_L200_Triton_Sport_2022.jpg'),
  eclipse_cross:  WC('Mitsubishi_Eclipse_Cross_HPE-S_2022.jpg'),

  // ── CAOA CHERY / BYD ────────────────────────────────────────────
  tiggo8:      WC('Caoa_Chery_Tiggo_8_Pro_2022.jpg'),
  byd_dolphin: WC('BYD_Dolphin_2023.jpg'),
  byd_king:    WC('BYD_Sea_Lion_6_2024.jpg'),

  // ── CLÁSSICOS BRASILEIROS ───────────────────────────────────────
  chevette:      WC('Chevrolet_Chevette_1992.jpg'),
  monza:         WC('Chevrolet_Monza_Classic_SE_1995.jpg'),
  kadett:        WC('Chevrolet_Kadett_GSi_1998.jpg'),
  gol_g1:        WC('VW_Gol_G1_1994.jpg'),
  gol_g2:        WC('Volkswagen_Gol_G2_GTI_1998.jpg'),
  santana:       WC('Volkswagen_Santana_GLS_1995.jpg'),
  palio:         WC('Fiat_Palio_ELX_2001.jpg'),
  uno_mille:     WC('Fiat_Uno_Mille_Fire_2002.jpg'),
  tempra:        WC('Fiat_Tempra_Turbo_1996.jpg'),
  tipo:          WC('Fiat_Tipo_2.0_16V_1996.jpg'),
  escort:        WC('Ford_Escort_XR3_1996.jpg'),
  passat_classic: WC('Volkswagen_Passat_GLS_1996.jpg'),

  // ── LUXO ────────────────────────────────────────────────────────
  bmw_320i:    WC('BMW_320i_M-Sport_G20_2022.jpg'),
  bmw_530i:    WC('BMW_530i_M-Sport_2021.jpg'),
  bmw_x1:      WC('BMW_X1_sDrive20i_2022.jpg'),
  bmw_x3:      WC('BMW_X3_xDrive30i_2022.jpg'),
  mercedes_c200: WC('Mercedes-Benz_C200_W206_2022.jpg'),
  mercedes_c300: WC('Mercedes-Benz_C300_4Matic_2022.jpg'),
  mercedes_gla:  WC('Mercedes-Benz_GLA_200_2021.jpg'),
  mercedes_glc:  WC('Mercedes-Benz_GLC_300_2023.jpg'),
  audi_a3:     WC('Audi_A3_Sedan_2022.jpg'),
  audi_q3:     WC('Audi_Q3_2020.jpg'),
  audi_q5:     WC('Audi_Q5_2021.jpg'),
  lr_evoque:   WC('Range_Rover_Evoque_P200_2021.jpg'),
  lr_discovery_sport: WC('Land_Rover_Discovery_Sport_P200_2022.jpg'),
  lr_defender: WC('Land_Rover_Defender_110_2022.jpg'),
  volvo_xc40:  WC('Volvo_XC40_B5_2021.jpg'),
  volvo_xc60:  WC('Volvo_XC60_B5_2022.jpg'),
  porsche_macan: WC('Porsche_Macan_S_2022.jpg'),

  // ── ESPORTIVOS ──────────────────────────────────────────────────
  mustang:       WC('Ford_Mustang_GT_2023.jpg'),
  gr86:          WC('Toyota_GR86_2022.jpg'),
  civic_type_r:  WC('Honda_Civic_Type_R_FL5_2023.jpg'),
  golf_gti:      WC('Volkswagen_Golf_GTI_Mk8_2022.jpg'),
  wrx_sti:       WC('Subaru_WRX_STI_2018.jpg'),
  i30n:          WC('Hyundai_i30_N_Performance_2022.jpg'),
  corvette_c8:   WC('2020_Chevrolet_Corvette_Stingray_3LT.jpg'),
  corvette_c7_z06: WC('2019_Chevrolet_Corvette_Z06.jpg'),
  camaro_ss:     WC('2023_Chevrolet_Camaro_SS.jpg'),
  camaro_zl1:    WC('2022_Chevrolet_Camaro_ZL1.jpg'),
  challenger_hellcat: WC('2023_Dodge_Challenger_SRT_Hellcat_Redeye_Widebody.jpg'),
  charger_srt:   WC('2022_Dodge_Charger_SRT_392.jpg'),
  shelby_gt500:  WC('2020_Ford_Shelby_GT500.jpg'),
  bmw_m2:        WC('BMW_M2_G87_2023.jpg'),
  bmw_m3:        WC('BMW_M3_Competition_G80_2022.jpg'),
  bmw_m4:        WC('BMW_M4_Competition_G82_2022.jpg'),
  mercedes_amg_a45:  WC('Mercedes-AMG_A45_S_2022.jpg'),
  mercedes_amg_c63:  WC('Mercedes-AMG_C63_S_E_Performance_2023.jpg'),
  mercedes_amg_gt:   WC('Mercedes-AMG_GT_S_2022.jpg'),
  audi_rs3:      WC('Audi_RS3_Sportback_8Y_2022.jpg'),
  audi_rs6:      WC('Audi_RS6_Avant_C8_2022.jpg'),
  alfa_giulia_qv: WC('Alfa_Romeo_Giulia_Quadrifoglio_2022.jpg'),
  renault_megane_rs: WC('Renault_Megane_RS_Trophy-R_2022.jpg'),

  // ── JDM ─────────────────────────────────────────────────────────
  nissan_gtr_r35:    WC('Nissan_GT-R_R35_Premium_2023.jpg'),
  nissan_gtr_r34:    WC('Nissan_Skyline_GT-R_R34_V-Spec.jpg'),
  nissan_gtr_r33:    WC('Nissan_Skyline_GT-R_R33_V-Spec.jpg'),
  nissan_gtr_r32:    WC('Nissan_Skyline_GT-R_R32.jpg'),
  toyota_supra_mk4:  WC('Toyota_Supra_MK4_1998.jpg'),
  toyota_supra_mk5:  WC('Toyota_GR_Supra_A90_2022.jpg'),
  mazda_rx7_fd:      WC('Mazda_RX-7_FD_Spirit_R_2002.jpg'),
  mazda_rx7_fc:      WC('Mazda_RX-7_FC3S_Turbo_II.jpg'),
  mazda_rx8:         WC('Mazda_RX-8_Spirit_R_2011.jpg'),
  honda_s2000:       WC('Honda_S2000_AP2_2006.jpg'),
  honda_nsx_na1:     WC('Honda_NSX_NA1_Type_R_1999.jpg'),
  mitsubishi_evo9:   WC('Mitsubishi_Lancer_Evolution_IX_MR.jpg'),
  mitsubishi_evo10:  WC('Mitsubishi_Lancer_Evo_X_Final_Edition.jpg'),
  mitsubishi_evo8:   WC('Mitsubishi_Lancer_Evolution_VIII_MR.jpg'),
  nissan_350z:       WC('Nissan_350Z_NISMO_2008.jpg'),
  nissan_370z:       WC('Nissan_370Z_NISMO_2019.jpg'),
  nissan_z_rz34:     WC('Nissan_Z_Proto_2023.jpg'),
  nissan_silvia_s15: WC('Nissan_Silvia_S15_Spec-R.jpg'),
  nissan_180sx:      WC('Nissan_180SX_Type_X.jpg'),
  honda_integra_type_r: WC('Honda_Integra_Type_R_DC5_2004.jpg'),
  ae86:              WC('Toyota_AE86_Trueno_1986.jpg'),
  celica_gt4:        WC('Toyota_Celica_GT-Four_ST205.jpg'),
  subaru_brz:        WC('Subaru_BRZ_tS_2023.jpg'),
  mazda_mx5:         WC('Mazda_MX-5_ND_RF_2022.jpg'),
  mitsubishi_eclipse_gsx: WC('Mitsubishi_Eclipse_GSX_2G.jpg'),
  toyota_gr_yaris:   WC('Toyota_GR_Yaris_2021.jpg'),
  toyota_gr_corolla: WC('Toyota_GR_Corolla_2023.jpg'),
  hyundai_elantra_n: WC('Hyundai_Elantra_N_2022.jpg'),
  kia_stinger_gt:    WC('Kia_Stinger_GT_2022.jpg'),

  // ── SUPERCAR ─────────────────────────────────────────────────────
  lamborghini_huracan:   WC('Lamborghini_Huracan_EVO_2022.jpg'),
  lamborghini_aventador: WC('Lamborghini_Aventador_SVJ_2022.jpg'),
  ferrari_488:     WC('Ferrari_488_GTB_Pista_2019.jpg'),
  ferrari_f8:      WC('Ferrari_F8_Tributo_2022.jpg'),
  ferrari_296:     WC('Ferrari_296_GTB_2022.jpg'),
  mclaren_720s:    WC('McLaren_720S_Spider_2022.jpg'),
  mclaren_570s:    WC('McLaren_570S_2019.jpg'),
  porsche_911_gt3: WC('Porsche_911_GT3_RS_992_2022.jpg'),
  porsche_911_turbo_s: WC('Porsche_911_Turbo_S_992_2022.jpg'),
  porsche_cayman_gt4:  WC('Porsche_718_Cayman_GT4_RS_2023.jpg'),
  audi_r8:         WC('Audi_R8_V10_Performance_2022.jpg'),
  honda_nsx_type_s: WC('Honda_NSX_Type_S_2022.jpg'),
  ford_gt_mk4:     WC('Ford_GT_MkIV_2022.jpg'),
};
