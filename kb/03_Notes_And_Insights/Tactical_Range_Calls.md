# Tactical Range Calls and Intercept Maneuvers

**Last Reviewed:** 2026-08-13  
**Tags:** `#wd` `#braa` `#brevity`

## Range Call Definitions

Tactical range calls provide pilots with situational awareness relative to the intercept timeline. These calls trigger specific pilot actions.

---

### STERN
**Definition**: Intercept geometry will result in a pass or roll out **behind the target**.

**When to Use**: Desired geometry for visual ID or rear-quarter missile shot.

**WD Call**: `"STERN, 10 MILES"` (fighter is 10nm behind target's projected track)

---

### CUT
**Definition**: Specific intercept angle designed to reduce lateral separation.

**Variations**:
- **"ZERO CUT"**: Fighter's heading is directly toward target's future position (pure pursuit).
- **"20 CUT"**: Fighter's heading is 20° off from pure pursuit.

**WD Call**: `"20 CUT, 15 MILES"`

---

### BEAM
**Definition**: Contact is stabilized at **70-110° aspect** relative to the fighter.

**Significance**: Beam aspect maximizes Doppler shift for radar tracking but presents a difficult shot geometry.

**WD Call**: `"BEAM, 12 MILES, TRACK EAST"`

**Closure Rate**: Beam-fired missiles close at approximately **1 NM every 3 seconds** (critical for timing).

---

### CRANK
**Definition**: Directive to perform an **F-Pole maneuver** - illuminate target at radar gimbal limits while turning away.

**Purpose**: Increase distance enemy missile must travel while maintaining own radar lock.

**WD Call**: `"CRANK LEFT"` or `"CRANK RIGHT"`

**Pilot Action**: 
1. Turn 30-45° away from threat
2. Maintain radar lock at gimbal limit
3. Deploy chaff if missile detected

---

### SKOSH
**Definition**: Informative call indicating an active radar-guided missile (e.g., AIM-120) has reached its **"active" range**.

**Significance**: Missile no longer requires support from fighter's radar; pilot may maneuver defensively.

**WD Call**: `"SKOSH"` (no additional parameters)

**Pilot Action**: May turn cold, notch, or reengage based on tactical situation.

---

## Engagement Phase Calls

### FOX Calls (Missile Launch)
- **FOX 1**: Semi-active radar-guided missile (e.g., AIM-7 Sparrow)
- **FOX 2**: Infrared-guided missile (e.g., AIM-9 Sidewinder)
- **FOX 3**: Active radar-guided missile (e.g., AIM-120 AMRAAM)

**Example**: 
- Pilot: `"RAPTOR 1, FOX 3, BULLS 180/40"`
- WD: `"RAPTOR 1, ROPE"` (continue radar support)

---

### SPLASH
**Definition**: Confirmed kill on target.

**WD Observation**: Track fades from radar after missile impact.

**WD Call**: `"SPLASH, ONE GROUP REMAINING BULLS 175/38"`

---

### IN RANGE
**Definition**: Fighter has reached weapons employment zone for current missile type.

**WD Call**: `"IN RANGE, AIM-120"` (if WD has fighter's weapons load data)

---

### SORTED
**Definition**: Confirmation that multiple threats are being engaged by different flight members (no redundant targeting).

**WD Call**: `"SORTED, RAPTOR 1 NORTH GROUP, RAPTOR 2 SOUTH GROUP"`

---

## Defensive Calls

### THREAT
**Definition**: Directive call - hostile group within **pre-briefed range** (typically 5nm).

**Format**: `"THREAT, [CALLSIGN], [BRAA TO THREAT]"`

**Example**: `"THREAT, RAPTOR, BULLS 180/20, HIGH, TRACK HOT"`

---

### BREAK
**Definition**: Immediate directive to perform **maximum performance turn**.

**Format**: `"BREAK RIGHT"` or `"BREAK LEFT"`

**Pilot Action**: 6-9G turn, deploy chaff/flare.

---

### NOTCH
**Definition**: Directive to maneuver **perpendicular** to threat radar (70-110° aspect).

**Purpose**: Exploit Doppler notch filter, hide in ground clutter.

**WD Call**: `"NOTCH RIGHT, Bulls 090"`

---

*Source: Research Document - Tactical Range Calls and Intercept Maneuvers*
