# LiveATC Feed Configuration

This document lists all configured LiveATC audio feeds available in the pipeline.

## Available Airports

### 1. JFK - John F. Kennedy International Airport (KJFK)
- **kjfk_gnd** - Ground Control
- **kjfk_twr** - Tower
- **kjfk_twr2** - Tower 2

### 2. Houston Hobby Airport (KHOU)
- **khou_gnd_twr_app** - Combined Ground/Tower/Approach

### 3. Houston George Bush Intercontinental Airport (KIAH)
- **kiah_gnd_n** - Ground Control (North/Runways 8/26LR)
- **kiah_gnd_s** - Ground Control (South/Runway 9/27)
- **kiah_gnd_w** - Ground Control (West/Runways 15/33LR)
- **kiah_twr** - Tower
- **kiah_app** - Approach

### 4. San Francisco International Airport (KSFO)
- **ksfo_gnd** - Ground Control
- **ksfo_twr** - Tower
- **ksfo_gnd_twr** - Combined Ground/Tower
- **ksfo_dep1** - Departure (120.9/127.0)

### 5. Austin-Bergstrom International Airport (KAUS)
- **kaus_gnd** - Ground Control
- **kaus_twr** - Tower
- **kaus_app_dep** - Combined Approach/Departure

### 6. Newark Liberty International Airport (KEWR)
- **kewr_gnd** - Ground Control (Primary)
- **kewr_twr** - Tower
- **kewr_app_final** - Approach (Final)
- **kewr_dep** - Departure

### 7. LaGuardia Airport (KLGA)
- **klga_gnd** - Ground Control
- **klga_twr** - Tower
- **klga_ny_app** - New York Approach (HAARP)
- **klga_ny_dep** - New York Departure

## Total Coverage
- **7 airports**
- **31 individual feeds**
- Coverage of all major radio types:
  - Ground Control
  - Tower
  - Approach
  - Departure
  - Combined feeds

## Usage Examples

### Record from a specific feed:
```bash
# Record 10 minutes from KSFO Ground
node scripts/liveatc-recorder.js --feed ksfo_gnd --duration 600

# Record 5 minutes from Newark Tower
node scripts/liveatc-recorder.js --feed kewr_twr --duration 300

# Record from Houston Bush Ground (North)
node scripts/liveatc-recorder.js --feed kiah_gnd_n --duration 600
```

### List all available feeds:
```bash
node scripts/liveatc-recorder.js
```

## Feed URL Pattern
All feeds use the LiveATC stream URL pattern:
```
http://d.liveatc.net/[feed_code]
```

## Notes
- Some airports have multiple ground control frequencies for different runway areas
- Combined feeds (e.g., gnd_twr_app) monitor multiple frequencies simultaneously
- All feeds are live streams from LiveATC.net
- Feed availability depends on LiveATC.net uptime and volunteer feed providers
