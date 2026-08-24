# Technical Review: Phase 1 Tactical Scope

## Strengths Identified

### ✅ Visual Fidelity
- Deep near-black blue background (#0a0e1a) + vibrant terminal green (#00ff00)
- High-contrast environment for long-duration operator focus
- Mirrors AN/TYQ-23 Operations Module aesthetic

### ✅ Information Architecture
- Grid layout separating primary scope from info-panel sidebar
- Mirrors Tactical Display Framework (TDF) structure
- Visual display secondary to dense data blocks

### ✅ Interaction Design
- Monospaced font usage
- Crosshair cursor for targeting
- Technical depth maintained throughout

---

## Recommended Revisions (Priority Order)

### 1. Symbology Integration
**Status**: milsymbol CDN loaded, not yet integrated

**Required**:
- Replace current circle-based track rendering with MIL-STD-2525D/E icons
- Render standard symbols for:
  - Hostile aircraft
  - Friendly aircraft
  - Neutral/Unknown contacts
  - SAM sites
  - ISR platforms
  - Tankers

**Implementation**:
```javascript
// symbology.js enhancement needed
function renderTrackSymbol(track) {
    const symbol = new ms.Symbol(track.sidc, {
        size: 20,
        fill: track.hostile ? '#ff0000' : '#00ff00'
    });
    // Draw to canvas at track position
}
```

---

### 2. Spatial Calculation Engine (Back-End Logic)
**Status**: Basic Bullseye/BRAA implemented in `scope_engine.js`

**Required Enhancements**:
- **Bullseye Calculations**: ✅ Implemented (bearing/range from fixed point)
- **BRAA Calculations**: ⚠️ Currently only from Bullseye, needs fighter-relative BRAA
- **Aspect Calculation**: ❌ Not implemented (HOT/COLD/BEAM determination)
- **Closure Rate**: ❌ Not implemented (requires track velocity)

**Next Steps**:
1. Add velocity vectors to tracks
2. Calculate aspect angles (track heading vs. fighter bearing)
3. Implement HOT (0-30°), BEAM (60-120°), COLD (150-180°) logic
4. Display in info-panel

---

### 3. Picture Labeling Logic (Auto-Detection)
**Status**: Basic WALL/LADDER detection in `app.js`

**Current Implementation**:
- Detects WALL (lateral separation > range separation)
- Detects LADDER (range separation > lateral separation)

**Required Additions**:
- **CHAMPAGNE** (2 lead, 1 trail)
- **VIC** (1 lead, 2 trail)
- **BOX** (2x2 formation)
- **WAVES** (depth-separated formations)
- **HEAVY** descriptor (weight distribution)

**Algorithm Enhancement**:
```javascript
function analyzeFormation(tracks) {
    // 1. Calculate centroid
    // 2. Measure lateral/range spreads
    // 3. Identify sub-groups
    // 4. Apply formation taxonomy
    // 5. Generate suggested picture call
}
```

---

### 4. Degraded Operations Mode
**Purpose**: Train for "Buzzer" (Electronic Attack) environments

**Implementation Plan**:

#### Visual Degradation Effects
```css
/* CSS filter for jamming */
.scope-jammed {
    filter: contrast(300%) brightness(150%);
    animation: strobeEffect 0.2s infinite;
}

@keyframes strobeEffect {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}
```

#### Canvas Noise Injection
```javascript
function injectNoise(ctx, intensity) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (Math.random() < intensity) {
            imageData.data[i] = 255; // R
            imageData.data[i+1] = 255; // G
            imageData.data[i+2] = 0; // B (yellow static)
        }
    }
    ctx.putImageData(imageData, 0, 0);
}
```

#### Manual Tracking Procedure
- Hide automated tracks
- Use mouse to place "plot markers" based on voice reports
- Calculate position accuracy vs. ground truth
- Score trainee on manual tracking precision

---

### 5. AF Form 4146 Digitalization (Pre-Mission Brief Module)
**Reference**: AFMAN 13-1CRCV3

**Required Before Simulation**:

#### Step Brief Checklist
```
[ ] Equipment Status (Radar, Radios, Link 16)
[ ] Intelligence Context (EOB, Threat Levels)
[ ] Weather Conditions
[ ] Risk Management Score (1-5)
[ ] Special Interest Items (SII)
[ ] FCIF Review (Flight Crew Info Files)
[ ] Crew Position Signatures
```

**Implementation**:
1. Create `brief_module.html` as pre-sim screen
2. Require all checklist items before enabling "Start Mission"
3. Log brief data with timestamp
4. Display during debrief for forensic review

---

## Next Phase Priority Ranking

1. **Symbology Integration** (Immediate - visual fidelity jump)
2. **Picture Labeling** (High - core WD skill)
3. **Aspect/BRAA Enhancement** (High - tactical communication)
4. **AF Form 4146** (Medium - training realism)
5. **Degraded Ops** (Medium - advanced training)

---

## Technical Debt Notes

- Current BRAA calculation only from Bullseye (not fighter-relative)
- Formation detection is heuristic-based (needs clustering algorithm)
- No track velocity or motion prediction
- milsymbol loaded but not integrated

---

*Review Date: 2026-02-01*
*Reviewer: User (Technical Architecture SME)*
