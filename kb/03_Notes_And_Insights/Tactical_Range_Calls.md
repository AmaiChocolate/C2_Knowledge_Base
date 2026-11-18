# Tactical Range Calls and Intercept Maneuvers

**Last Reviewed:** 2026-11-18: items that conflict with ALSSA ACC, ATP 3-52.4 (09 OCT 2024) are corrected and marked **(ALSSA ACC)**. Everything else here comes from an unverified "Research Document" and is not covered by ACC (brevity terms such as CUT, CRANK, NOTCH, BREAK belong to the multi-Service brevity publication, ATP 1-02.1): **treat it as unverified**. See [[../05_Tools_And_CrossReferences/ALSSA_ACC_2024_Review|ALSSA_ACC_2024_Review]].  
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
**Definition** (ALSSA ACC IV.6.c, figure 1): an aspect band, **71–120° target aspect** (HOT 0–30°, FLANK 31–70°, BEAM 71–120°, DRAG 121–180°). With a BRAA call it is voiced with a cardinal: `BEAM NORTH`. It is an aspect, not a range call.

**Significance**: Beam aspect maximizes Doppler shift for radar tracking but presents a difficult shot geometry.

**ACC usage**: `"EAGLE 11, NORTH GROUP BRAA 2-1-0/28, THIRTY-EIGHT THOUSAND, BEAM NORTH, HOSTILE"`. A BRAA call uses aspect, never TRACK.

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
- Pilot (ALSSA ACC V.8): `"RAPTOR 1, FOX 3 LEAD GROUP BULLSEYE 1-2-5/27, TWENTY-NINE THOUSAND, HOSTILE"`. BULLSEYE is never shortened to BULLS.
- WD: `"RAPTOR 1, ROPE"` (continue radar support)

---

### SPLASH
**Definition**: Confirmed kill on target.

**WD Observation**: Track fades from radar after missile impact.

**WD Call**: (unverified) never shorten BULLSEYE: `BULLSEYE 175/38`.

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
**Definition** (ALSSA ACC V.17): made when a fighter will pierce the THREAT range to an UNTARGETED group, completed no later than threat range. THREAT criteria are briefed; the default is **35 nm, independent of aspect**. Cancelled once the fighter calls TARGETED.

**Format**: fighter call sign, group name, THREAT, BRAA (bearing, range), altitude, aspect, declaration, fill-ins. An undetected or unreported group is a THREAT GROUP. BULLSEYE (right after THREAT) when the fighter's position is unknown or several fighters are threatened; within 5 nm, cardinal direction and range.

**Examples**: `"HEAT 31, ADDITIONAL GROUP THREAT, BRAA 1-2-5/35, THIRTY-FIVE THOUSAND, HOT, HOSTILE"` · `"RAMBO 2, THREAT GROUP BRAA 2-7-0/13, ONE THOUSAND, HOT, HOSTILE"` · `"BOLT 1, THREAT NORTH THREE, TEN THOUSAND, TRACK SOUTH, HOSTILE"`

---

### BREAK
**Definition**: Immediate directive to perform **maximum performance turn**.

**Format**: `"BREAK RIGHT"` or `"BREAK LEFT"`

**Pilot Action**: 6-9G turn, deploy chaff/flare.

---

### NOTCH
**Definition** (unverified): directive to maneuver **perpendicular** to the threat radar (about BEAM aspect, which ACC defines as 71–120° target aspect).

**Purpose**: Exploit Doppler notch filter, hide in ground clutter.

**WD Call**: `"NOTCH RIGHT, Bulls 090"`

---

*Source: Research Document - Tactical Range Calls and Intercept Maneuvers*
