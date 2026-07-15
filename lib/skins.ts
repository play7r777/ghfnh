export type Skin = {
  id: string
  weapon: string
  name: string
  condition: string
  price: number
  rarity: "covert" | "classified" | "restricted" | "mil-spec" | "rare"
  image: string
}

const imageRoot = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/images/econ/default_generated"

const rows: Array<[string, string, string, number, Skin["rarity"], string]> = [
  ["AK-47", "Wild Lotus", "Factory New", 17094.97, "covert", "weapon_ak47_cu_ak_island_floral_light_png.png"],
  ["M4A4", "Howl", "Factory New", 12514.36, "covert", "weapon_m4a1_cu_m4a1_howling_light_png.png"],
  ["AWP", "Gungnir", "Factory New", 11847.28, "covert", "weapon_awp_gs_awp_gungnir_light_png.png"],
  ["AWP", "Dragon Lore", "Minimal Wear", 10559.79, "covert", "weapon_awp_cu_medieval_dragon_awp_light_png.png"],
  ["M4A4", "The Emperor", "Factory New", 314.45, "covert", "weapon_m4a1_gs_m4a4_emperor_light_png.png"],
  ["M4A1-S", "Printstream", "Factory New", 610.23, "covert", "weapon_m4a1_silencer_cu_m4a1s_printstream_light_png.png"],
  ["M4A1-S", "Hyper Beast", "Minimal Wear", 138.42, "covert", "weapon_m4a1_silencer_cu_m4a1_hyper_beast_light_png.png"],
  ["AK-47", "Vulcan", "Minimal Wear", 692.31, "covert", "weapon_ak47_cu_ak47_rubber_light_png.png"],
  ["AK-47", "Fuel Injector", "Factory New", 487.62, "covert", "weapon_ak47_gs_ak47_supercharged_light_png.png"],
  ["AK-47", "Neon Rider", "Factory New", 243.89, "covert", "weapon_ak47_cu_ak_neon_rider_light_png.png"],
  ["AK-47", "Asiimov", "Field-Tested", 82.18, "covert", "weapon_ak47_cu_ak47_asiimov_light_png.png"],
  ["AK-47", "Bloodsport", "Minimal Wear", 148.77, "covert", "weapon_ak47_gs_ak47_bloodsport_light_png.png"],
  ["AWP", "Asiimov", "Field-Tested", 118.64, "covert", "weapon_awp_cu_awp_asimov_light_png.png"],
  ["AWP", "Containment Breach", "Minimal Wear", 211.48, "covert", "weapon_awp_cu_awp_virus_light_png.png"],
  ["AWP", "Hyper Beast", "Factory New", 109.93, "covert", "weapon_awp_cu_awp_hyper_beast_light_png.png"],
  ["AWP", "Neo-Noir", "Factory New", 61.76, "covert", "weapon_awp_cu_awp_neonoir_light_png.png"],
  ["Desert Eagle", "Printstream", "Factory New", 112.35, "covert", "weapon_deagle_cu_deag_printstream_light_png.png"],
  ["Desert Eagle", "Ocean Drive", "Factory New", 128.51, "covert", "weapon_deagle_cu_deag_ocean_drive_light_png.png"],
  ["USP-S", "Kill Confirmed", "Minimal Wear", 89.51, "covert", "weapon_usp_silencer_cu_usp_progressiv_light_png.png"],
  ["USP-S", "Printstream", "Factory New", 142.44, "covert", "weapon_usp_silencer_cu_usp_printstream_light_png.png"],
  ["Glock-18", "Fade", "Factory New", 1478.12, "restricted", "weapon_glock_aa_fade_light_png.png"],
  ["Glock-18", "Gamma Doppler", "Factory New", 624.82, "classified", "weapon_glock_am_gamma_doppler_phase4_glock_light_png.png"],
  ["FAMAS", "Commemoration", "Factory New", 18.72, "covert", "weapon_famas_cu_famas_tribute_light_png.png"],
  ["Galil AR", "Sugar Rush", "Factory New", 74.26, "classified", "weapon_galilar_cu_galil_candychaos_light_png.png"],
  ["SSG 08", "Dragonfire", "Factory New", 24.53, "covert", "weapon_ssg08_cu_ssg08_dragonfire_scope_light_png.png"],
  ["P90", "Asiimov", "Minimal Wear", 32.18, "covert", "weapon_p90_cu_p90_asimov_light_png.png"],
  ["MP9", "Starlight Protector", "Factory New", 31.44, "covert", "weapon_mp9_gs_mp9_starlight_light_png.png"],
  ["MAC-10", "Disco Tech", "Factory New", 15.86, "classified", "weapon_mac10_cu_mac10_nacre_light_png.png"],
  ["Five-SeveN", "Angry Mob", "Factory New", 12.92, "covert", "weapon_fiveseven_cu_fiveseven_gsg9_light_png.png"],
  ["P250", "See Ya Later", "Factory New", 17.38, "covert", "weapon_p250_cu_p250_cybercroc_light_png.png"],
  ["Nova", "Hyper Beast", "Factory New", 42.81, "classified", "weapon_nova_cu_nova_hyperbeast_light_png.png"],
  ["AUG", "Akihabara Accept", "Field-Tested", 597.38, "covert", "weapon_aug_cu_anime_aug_light_png.png"],
  ["SG 553", "Integrale", "Factory New", 168.51, "classified", "weapon_sg556_gs_sg553_rusty_light_png.png"],
  ["Tec-9", "Decimator", "Factory New", 41.24, "classified", "weapon_tec9_cu_tec9_decimator_light_png.png"],
  ["CZ75-Auto", "Victoria", "Factory New", 31.75, "covert", "weapon_cz75a_aq_etched_cz75_light_png.png"],
  ["Dual Berettas", "Cobra Strike", "Factory New", 58.67, "classified", "weapon_elite_gs_dualberettas_cobra_light_png.png"],
]

export const SKINS: Skin[] = rows.map(([weapon, name, condition, price, rarity, file], index) => ({
  id: `skin-${index + 1}`,
  weapon,
  name,
  condition,
  price,
  rarity,
  image: `${imageRoot}/${file}`,
}))

export const STARTER_IDS = ["skin-11", "skin-19", "skin-24", "skin-27"]
