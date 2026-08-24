# 2D Tactical Scope Simulator - Technical Architecture

**Last Reviewed:** 2026-08-13 — **framing update**  
Product identity: **BC3 tactical scope** trainer. Heritage notes mentioned AN/TYQ-23 OM/TDF; do not treat that as the user-facing product name. **AN/TPS-75** is modeled as the **radar track feed** only (no radar console panels).

## Overview
Build a 2D training simulator replicating a **BC3-style** tactical scope used by ABMs and WDs, fed by a logic-only TPS-75 radar model.

---

## 1. Tactical Display Stack

### Symbology Engine
**Library**: `milsymbol` (JavaScript)
- Renders MIL-STD-2525D/E icons
- Pure JavaScript, no external dependencies
- Renders 1,000+ tactical symbols in <20ms
- Output: SVG or Canvas elements

**Symbols Needed**:
- Fighters (Friendly/Hostile)
- SAMs
- Tankers
- ISR platforms

---

### Rendering Layer
**Technology**: HTML5 Canvas

**Features**:
- **Motion Trails**: Store previous coordinates in array, render as fading line/dots
- **Data Blocks**: Overlay showing altitude, speed, callsign
- **Interactive Tracks**: `isPointInPath()` for click-to-select

**Rendering Loop**:
```javascript
// Pseudo-code
function renderScope() {
  clearCanvas();
  drawOverlays(); // BMA, Safe Passages, CAP points
  drawTracks(); // All radar contacts
  drawMotionTrails(); // Historical positions
  drawDataBlocks(); // Selected track info
  requestAnimationFrame(renderScope);
}
```

---

## 2. Scenario Data Ingestion

### ATO Parsing
**Tool**: Python + `TextFSM`
- Parse USMTF (US Message Text Format) ATO
- Convert to structured JSON

**Output Schema**:
```json
{
  "missions": [
    {
      "callsign": "RAPTOR11",
      "type": "DCA",
      "cap_location": "BULLS 090/40",
      "vul_time": "0600Z-0800Z"
    }
  ]
}
```

---

### Overlay Generation
**Data Sources**: ACO (Airspace Control Order) + SPINS

**Geometries**:
- **Safe Passage Corridors**: Polygon zones
- **CAP Points**: Circles/orbits
- **Tanker Tracks (Anchors)**: Fixed lines
- **BMA**: Battle Management Area boundaries

**Rendering**: Static overlays on Canvas layer

---

## 3. Simulation Logic Engine

### Spatial Calculations
**Required Math**:
- **Bullseye**: Range/bearing from fixed reference point
- **BRAA**: Bearing, Range, Altitude, Aspect (relative to fighter)

**Update Frequency**: 1-2 Hz (real-time radar update rate)

---

### Picture Label Logic
**Auto-Detection**:
```python
def calculate_formation(groups):
    lateral_sep = max(group.azimuth) - min(group.azimuth)
    range_sep = max(group.range) - min(group.range)
    
    if lateral_sep > range_sep:
        return "WALL"
    elif range_sep > lateral_sep:
        return "LADDER"
    # ... more logic for CHAMPAGNE, VIC, BOX
```

---

### Manual Tracking Mode (Degraded Ops)
**Scenario**: Primary radar/Link-16 offline

**Implementation**:
1. Hide automated tracks
2. Provide mouse-based "plot marker" tool
3. Trainee manually plots based on simulated voice reports
4. Calculate position accuracy vs. ground truth

---

## 4. Communication & AI Integration

### Automated Speech Recognition (ASR)
**Options**:
- **CASPER** (military-specific)
- **ATVoice**
- **OpenAI Whisper** (local implementation for security)

**Trigger Words**:
- "Bogey Dope"
- "Declare"
- "Alpha Check"
- "Picture"
- "Commit"

---

### Response Generation
**Logic Flow**:
1. ASR detects brevity call
2. Query simulation state (track positions, ROE)
3. Calculate response (e.g., BRAA for Bogey Dope)
4. Generate TTS response

**Example**:
- Pilot (ASR): *"RAPTOR 11, Bogey Dope"*
- Simulator (Logic): Calculates nearest hostile = BULLS 180/45
- Simulator (TTS): *"RAPTOR 11, BULLS 180/45, HIGH, HOT"*

---

## 5. Instructor Evaluation

### AF Form 4146 Digitization
**Purpose**: Save/Load mechanism + Report Card

**Data Captured**:
- Every Picture call (timestamp, content)
- Every Commit decision
- Response time metrics
- Errors (missed threats, incorrect ROE)

---

### Forensic Reconstruction
**Feature**: "Rewind" the scope to replay mission

**Use Cases**:
- Show trainee where flanking group was missed
- Demonstrate commit delay impact
- Review communication flow

**Storage**: JSON timeline of all events

---

## Recommended Tech Stack

| Component | Technology |
|-----------|-----------|
| **Front-end UI** | React or Vue.js |
| **Tactical Scope** | HTML5 Canvas + milsymbol |
| **Back-end/Math** | Node.js or Python (FastAPI) |
| **Voice AI** | Web Speech API or OpenAI Whisper |
| **Data Storage** | PostgreSQL (mission logs, AF Form 4146) |

---

## Implementation Phases

### Phase 1: Basic Scope
- [ ] Canvas rendering with static overlays
- [ ] Manual track placement
- [ ] Bullseye/BRAA calculations

### Phase 2: Scenario Engine
- [ ] ATO parser
- [ ] Automated track generation
- [ ] Picture label detection

### Phase 3: AI Integration
- [ ] ASR for brevity calls
- [ ] TTS responses
- [ ] Simulated pilot behavior

### Phase 4: Evaluation System
- [ ] AF Form 4146 logging
- [ ] Forensic playback
- [ ] Instructor dashboard

---

*Source: User-provided Technical Architecture for 2D Training Simulator*
