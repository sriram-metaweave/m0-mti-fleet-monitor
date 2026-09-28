/* PROVISION — weather along the track. Empty on purpose: fill it with scripts/pull-weather.py (Open-Meteo ERA5 + marine,
   verified reachable 23-Sep-2026) or from a weather.track_point table once one exists (see WEATHER-SOURCES.md).
   Row shape: [date 'YYYY-MM-DD', lat, lon, wind_dir_deg_from, wind_speed_kn, wave_height_m, wave_dir_deg, swell_height_m, source]
   The globe draws rows for the selected date as arrows (UI.globe `weather` prop); the noon-report hover shows them too. */
const WEATHER = [];
