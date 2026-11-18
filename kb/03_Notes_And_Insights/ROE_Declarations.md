# ROE Declarations and Identification Criteria

**Last Reviewed:** 2026-11-18: call formats corrected to ALSSA ACC, ATP 3-52.4 (09 OCT 2024) and marked **(ALSSA ACC)**. ACC lists the voice declarations (BOGEY, FRIENDLY, NEUTRAL, BANDIT, HOSTILE) and DECLARE responses (also FURBALL, UNABLE, CLEAN, VANISHED) but does not define them; the definitions below come from an unverified "Research Document" and should be checked against the brevity publication (ATP 1-02.1) and your theater ROE / SPINS. See [[../05_Tools_And_CrossReferences/ALSSA_ACC_2024_Review|ALSSA_ACC_2024_Review]].  
**Tags:** `#roe` `#abm` `#wd`

## Declaration Types

### HOSTILE
**Definition**: Identified as enemy IAW theater ROE; clearance to fire is authorized.

**WD Requirements**:
- Track meets Positive Identification (PID) criteria
- Must cross-reference:
  - IFF/SIF codes (negative response or wrong code)
  - NCTR (Non-Cooperative Target Recognition)
  - POO (Point of Origin) - launched from known enemy territory
  - Visual ID (if available)

**Request** (ALSSA ACC V.7): `"DARKSTAR, VIPER 1, DECLARE BULLSEYE 2-3-0/12, TWELVE THOUSAND"`, or by name once the picture is labeled: `"CHALICE, HORNET 1, DECLARE EAST GROUP"`.
**Response** (ALSSA ACC V.7.d): always BULLSEYE, altitude, track direction, declaration and fill-ins: `"DARKSTAR, NORTH GROUP BULLSEYE 2-3-0/12, TWELVE THOUSAND, TRACK EAST, HOSTILE"`.

---

### BANDIT
**Definition**: Positively identified as enemy aircraft, but clearance to fire is **not yet authorized**.

**WD Requirements**:
- Identification verified (same criteria as Hostile)
- ROE constraints prevent weapons release (e.g., outside designated engagement zone)

**Usage**: Track is enemy, but waiting for ROE clearance or geometry update.

---

### BOGEY
**Definition**: A radar or visual contact whose identity is **unknown**.

**WD Requirements**:
- Initial track detection without IFF response
- No visual ID
- Does not meet hostile criteria yet

**Example** (ALSSA ACC V.7.d): `"CHALICE, EAST GROUP BULLSEYE 2-7-3/27, TWENTY-TWO THOUSAND, TRACK EAST, BOGEY SPADES"`. Altitude is always a number, never HIGH (HIGH is only a fill-in above 40,000 ft).

---

### OUTLAW
**Definition**: Contact has passed a **Point of Origin (POO)** and is following a profile consistent with enemy tactics.

**WD Requirements**:
- Track history correlates with known adversary launch profiles
- Originated from hostile territory
- Aspect/altitude consistent with threat profile

**Usage**: Used when POO is the primary ID criterion (e.g., missile launch detected from enemy SAM site).

---

### FRIENDLY
**Definition**: Positively identified as friendly aircraft.

**WD Requirements**:
- Correct IFF/SIF Mode 4 response
- Correlated with flight plan or ATO
- Visual ID confirms friendly type

---

### UNABLE
**Definition**: Cannot provide a declaration due to insufficient data.

**Example**: `"DARKSTAR, RAPTOR 1, DECLARE BULLSEYE 2-0-0/30, TWENTY THOUSAND"` → `"DARKSTAR, UNABLE"` (UNABLE is a listed DECLARE response, ALSSA ACC V.7.d(2); any follow-on recommendation is unverified).

---

## ID Matrix Integration

The **ID Matrix** (defined in SPINS) provides the hierarchy of identification methods:

1. **IFF/SIF Mode 4** (most reliable)
2. **NCTR** (radar signature analysis)
3. **POO** (geographic origin)
4. **Visual ID** (if within range)
5. **Correlation with ATO** (expected friendly positions)

WDs must **verify at least two criteria** before declaring "Hostile" in most ROE scenarios.

---

*Source: Research Document - Technical Architecture for High-Fidelity Tactical C2 Simulation*
