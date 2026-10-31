# Weather panel

Both launcher and dashboard load weather.js and weather.css. Default: Nantwich town centre / CW5 area (53.067, -2.524), not a household sensor.

Sources: UK Met Office UKV/global models for seven-day weather; ECMWF IFS 0.25° for the independent model comparison and ensemble precipitation probability; CAMS for UV, EU AQI and pollen concentrations; NOAA GEFS 0.5° (31 ensemble members) for a 30-day outlook. All are delivered by Open-Meteo, so this is an independent-model comparison, not independent delivery infrastructure or a verification guarantee. Model-derived hourly values can be interpolated, and UKMO open-data delivery has a delay compared with the direct Met Office service.

Today shows current/remaining hours; week selects a date with all future-day hours. Times use the forecast location timezone. Weather-change text is a deterministic summary of rain transitions, gust thresholds and temperature drops; it is not an official severe-weather warning. Long-range icons indicate broad wet/cloud signals, not exact daily weather. Ensemble temperature range is the 10th–90th percentile across members of daily mean temperature, not daily minima/maxima or calibrated confidence bounds.

Pollen is the largest available concentration among grass, birch, alder, mugwort and ragweed in grains/m³, not a clinical allergy-risk score. Partial coverage and nulls remain explicit. UV/pollen/AQI may be unavailable before the end of the seven-day window.

No API keys, HA authentication or geolocation permissions are required. Requests omit credentials. Favourites and selected location are stored locally per browser/app. Forecast responses cache 30 minutes, air data one hour, outlook six hours; failed requests can use clearly labelled saved data up to six hours old. API calls run only while the launcher is open; automatic refresh skips hidden pages. The long-range forecast loads on demand.

Tests: node --test tests/weather.test.cjs. Browser verification: both summary entry points; remaining today; 24 hourly cards for future dates; 30 ensemble days; search, save, reload and remove favourite; alternate location returns to Nantwich. Existing DEV camera regressions also passed.

Rollback: remove the weather.css link and weather.js script from index.html and dev/index.html. No HA or camera configuration changes are involved.

The 90-day view shares the 30-day GEFS rows for days 1–30 and uses seasonal rows for days 31–90, matched by local calendar date. Missing dates remain unavailable rather than shifting later dates forward or silently substituting another model. Both click and scroll update the active period. Refresh bypasses both outlook caches; old location requests cannot replace the current location's outlook. Seasonal forecasts are broad area trends, not validated daily accuracy claims (https://open-meteo.com/en/docs/seasonal-forecast-api).

Only saved locations are restored on startup. Searching an unsaved location is temporary; closing weather or removing the active favourite returns to Nantwich. Existing orphaned selected locations are repaired on startup.
