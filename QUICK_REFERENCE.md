# Quick Reference - LiveATC Feeds

## Quick Test Commands

```bash
# Test different airports (5 second recordings)
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 5      # JFK Ground
node scripts/liveatc-recorder.js --feed ksfo_twr --duration 5      # SFO Tower
node scripts/liveatc-recorder.js --feed kiah_app --duration 5      # Houston Bush Approach
node scripts/liveatc-recorder.js --feed kaus_gnd --duration 5      # Austin Ground
node scripts/liveatc-recorder.js --feed kewr_twr --duration 5      # Newark Tower
node scripts/liveatc-recorder.js --feed klga_ny_dep --duration 5   # LaGuardia Departure
```

## Feed Codes by Airport

### KJFK (3 feeds)
- `kjfk_gnd` - Ground
- `kjfk_twr` - Tower
- `kjfk_twr2` - Tower 2

### KHOU (1 feed)
- `khou_gnd_twr_app` - Ground/Tower/Approach

### KIAH (5 feeds)
- `kiah_gnd_n` - Ground North
- `kiah_gnd_s` - Ground South
- `kiah_gnd_w` - Ground West
- `kiah_twr` - Tower
- `kiah_app` - Approach

### KSFO (4 feeds)
- `ksfo_gnd` - Ground
- `ksfo_twr` - Tower
- `ksfo_gnd_twr` - Ground/Tower
- `ksfo_dep1` - Departure

### KAUS (3 feeds)
- `kaus_gnd` - Ground
- `kaus_twr` - Tower
- `kaus_app_dep` - Approach/Departure

### KEWR (4 feeds)
- `kewr_gnd` - Ground
- `kewr_twr` - Tower
- `kewr_app_final` - Approach Final
- `kewr_dep` - Departure

### KLGA (4 feeds)
- `klga_gnd` - Ground
- `klga_twr` - Tower
- `klga_ny_app` - NY Approach
- `klga_ny_dep` - NY Departure

## Recommended Starter Feeds

For diverse coverage, start with:
```bash
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"},
  {"airport": "KSFO", "facility": "tower", "url": "http://d.liveatc.net/ksfo_twr"},
  {"airport": "KIAH", "facility": "approach", "url": "http://d.liveatc.net/kiah1_2"},
  {"airport": "KEWR", "facility": "ground", "url": "http://d.liveatc.net/kewr_gnd_pri"}
]'
```

## Radio Type Coverage

- **Ground**: kjfk_gnd, ksfo_gnd, kiah_gnd_n, kaus_gnd, kewr_gnd, klga_gnd
- **Tower**: kjfk_twr, ksfo_twr, kiah_twr, kaus_twr, kewr_twr, klga_twr
- **Approach**: kiah_app, klga_ny_app, kewr_app_final
- **Departure**: ksfo_dep1, kewr_dep, klga_ny_dep
- **Combined**: khou_gnd_twr_app, ksfo_gnd_twr, kaus_app_dep

## List All Available Feeds

```bash
node scripts/liveatc-recorder.js
```

## Full Documentation

See `FEEDS.md` for complete details on all feeds.
