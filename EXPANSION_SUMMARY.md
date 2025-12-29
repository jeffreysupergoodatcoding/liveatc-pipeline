# LiveATC Pipeline Expansion - Summary

## Changes Made

### 1. Expanded Feed Configuration (`scripts/liveatc-recorder.js`)

**Before:** 5 feeds from 3 airports (KJFK, KSFO, KORD)

**After:** 31 feeds from 7 airports

#### New Airports Added:
1. **KHOU** - Houston Hobby Airport (1 feed)
   - Combined Ground/Tower/Approach

2. **KIAH** - Houston George Bush Intercontinental (5 feeds)
   - Tower
   - Ground North (Runways 8/26LR)
   - Ground South (Runway 9/27)
   - Ground West (Runways 15/33LR)
   - Approach

3. **KAUS** - Austin-Bergstrom International (3 feeds)
   - Ground
   - Tower
   - Combined Approach/Departure

4. **KEWR** - Newark Liberty International (4 feeds)
   - Ground (Primary)
   - Tower
   - Approach (Final)
   - Departure

5. **KLGA** - LaGuardia Airport (4 feeds)
   - Ground
   - Tower
   - New York Approach (HAARP)
   - New York Departure

#### Existing Airports Enhanced:
- **KJFK** - Kept existing 3 feeds (Ground, Tower, Tower2)
- **KSFO** - Expanded from 1 to 4 feeds:
  - Ground
  - Tower
  - Combined Ground/Tower
  - Departure (120.9/127.0)

**Removed:** KORD (Chicago O'Hare) - can be re-added if needed

### 2. Updated Facility Abbreviation Logic

Added support for new facility types:
- `approach` → `app`
- `departure` → `dep`
- `gnd_twr` → `gnd_twr`
- `gnd_twr_app` → `gnd_twr_app`
- `app_dep` → `app_dep`
- `app_final` → `app_final`
- `gnd_north` → `gnd_n`
- `gnd_south` → `gnd_s`
- `gnd_west` → `gnd_w`

### 3. Created New Documentation

#### `FEEDS.md`
- Comprehensive list of all 31 available feeds
- Organized by airport
- Includes usage examples
- Documents radio types covered

### 4. Updated README.md

- Added reference to `FEEDS.md`
- Updated examples to show multiple airports
- Expanded script reference section
- Added airport coverage summary

## Radio Types Covered

The expanded configuration now covers all major ATC radio types:

1. **Ground Control** - Aircraft taxiing on the ground
2. **Tower** - Takeoff and landing clearances
3. **Approach** - Incoming aircraft guidance
4. **Departure** - Outgoing aircraft guidance
5. **Combined Feeds** - Multiple frequencies monitored simultaneously

## Geographic Coverage

### Regions:
- **New York Area**: JFK, Newark, LaGuardia
- **Texas**: Houston (Hobby & Bush), Austin
- **California**: San Francisco

### Airport Types:
- Major international hubs (JFK, SFO, IAH, EWR)
- Regional airports (HOU, AUS, LGA)

## Usage Examples

### Record from different airports:
```bash
# New York - JFK Ground
node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 600

# Texas - Houston Bush Tower
node scripts/liveatc-recorder.js --feed kiah_twr --duration 600

# California - San Francisco Departure
node scripts/liveatc-recorder.js --feed ksfo_dep1 --duration 600

# New York - Newark Approach
node scripts/liveatc-recorder.js --feed kewr_app_final --duration 600
```

### List all available feeds:
```bash
node scripts/liveatc-recorder.js
# This will show an error with the list of all available feeds
```

## Testing Recommendations

1. **Start with a single feed** to verify connectivity:
   ```bash
   node scripts/liveatc-recorder.js --feed ksfo_gnd --duration 60
   ```

2. **Test different radio types**:
   - Ground: `ksfo_gnd`
   - Tower: `kaus_twr`
   - Approach: `kewr_app_final`
   - Departure: `klga_ny_dep`

3. **Test combined feeds**:
   - `khou_gnd_twr_app` (Houston Hobby - all in one)
   - `ksfo_gnd_twr` (SFO Ground + Tower)

## Environment Variable Configuration

To use multiple feeds in the scheduled pipeline, update `.env`:

```bash
LIVEATC_FEEDS='[
  {"airport": "KJFK", "facility": "ground", "url": "http://d.liveatc.net/kjfk_gnd"},
  {"airport": "KSFO", "facility": "tower", "url": "http://d.liveatc.net/ksfo_twr"},
  {"airport": "KIAH", "facility": "gnd_north", "url": "http://d.liveatc.net/kiah2_gnd_n"},
  {"airport": "KAUS", "facility": "approach", "url": "http://d.liveatc.net/kaus3_app_dep"},
  {"airport": "KEWR", "facility": "tower", "url": "http://d.liveatc.net/kewr_twr"},
  {"airport": "KLGA", "facility": "ground", "url": "http://d.liveatc.net/klga_gnd"}
]'
```

## Files Modified

1. `/scripts/liveatc-recorder.js` - Added 26 new feed configurations
2. `/README.md` - Updated documentation and examples
3. `/FEEDS.md` - New comprehensive feed reference (created)

## Next Steps

1. Test a few feeds to verify they're working
2. Choose which feeds to include in your scheduled pipeline
3. Update `.env` with your selected feeds
4. Run a test with `--once` flag before scheduling

## Notes

- All feed URLs follow the pattern: `http://d.liveatc.net/[feed_code]`
- Feed availability depends on LiveATC.net and volunteer feed providers
- Some feeds may be offline temporarily - this is normal
- Combined feeds are more efficient if you want multiple radio types from the same airport
