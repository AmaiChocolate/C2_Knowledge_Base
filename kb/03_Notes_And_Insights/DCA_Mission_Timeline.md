# DCA Mission Timeline for Weapons Directors

**Last Reviewed:** 2026-08-14  
**Tags:** `#wd` `#dca` `#timeline`  
**Related:** [[../02_Training_And_Checklists/WD_Positional_Checklist|WD checklist]] · sim `sc-01-single-commit`

## Standard sim overlay (training)
North-threat DCA used by the BC3 Scope Trainer (unclassified geometry):
- CAP NORTH-L **350/100**, CAP NORTH-R **010/100**
- **MLL 130nm** (drawn); fighter **MELD 70 / COMMIT 50** from that fighter (**logic only — not drawn**; BVR DCA proxy so commit precedes HVAA/DAL threat)
- DAL **180/5**; tanker SHELL **180/55** racetrack with **SLIDE 25 / SCRAM 15** around HVAA
- Optional/debug off by default: bulls meld/commit/retro rings, EMCON, BMA
- Red air spawns **north of MLL (~170–180)**, track SOUTH

Case studies: [[../04_Scenarios_And_CaseStudies/sc-01-single-commit|sc-01]] · [[../04_Scenarios_And_CaseStudies/sc-02-wall-ladder|sc-02]] · [[../04_Scenarios_And_CaseStudies/sc-03-degraded-radar|sc-03]]

## Pre-Mission (H-2:00 to H-1:00)

### Mission Planning & Review
1. **Review SPINS** (Special Instructions)
   - ROE (Rules of Engagement)
   - Frequencies (primary/secondary nets)
   - Safe passages and restricted areas
   - ID Matrix criteria

2. **Study Mission Overlay**
   - Battle Management Area (BMA) boundaries
   - Kill boxes and Fire Support Coordination Lines (FSCL)
   - Defended assets/High Value Targets
   - Tanker tracks and divert airfields

3. **Review Contracts** (with MCC and other WDs)
   - Lane assignments (if multi-lane DCA)
   - Commit authority delegation
   - Handover procedures
   - Emergency protocols

4. **Attend Pre-Mission Brief** (P-1 Briefing Guide)
   - Weather (clouds, winds affecting CAP stations)
   - Intel update on threat aircraft/capabilities
   - Timing (start/end of Vul window, tanker schedules)
   - Confirm force accountability (who's checking in, when)

## Scope Setup (H-0:30 to H-Hour)

5. **Equipment Check**
   - Log into primary/secondary radio nets
   - Verify radar feeds (J-Series Link 16 connectivity)
   - Test intercom with crew positions

6. **Configure Scope Display**
   - Load BMA overlay
   - Set symbology (track numbers, altitude bands)
   - Configure radar filters (clutter rejection, altitude gates)
   - Establish bullseye reference

7. **Pre-Coordination**
   - Check in with adjacent sectors/AWACs
   - Verify ATC handoff procedures
   - Confirm tanker net frequencies

## Mission Execution: The Vulnerability Period (H-Hour to H+Duration)

### Check-In Phase (First 5-10 min)

8. **Fighter Check-In**
   - Receive callsign, number, and mission type
   - Perform **Alpha Check** (verify position via bullseye)
   - Log aircraft on Force Accountability board

9. **Establish Control**
   - Assign CAP station or holding area
   - Provide initial picture ("CLEAN" or threat summary)
   - Set expectations for commit criteria

### Picture Development (Continuous)

10. **Radar Surveillance**
    - Monitor radar feeds for new tracks
    - Correlate tracks with Link 16 symbology (J12.5 Target/Track Correlation)
    - ID unknown tracks using ID Matrix

11. **Build Air Picture**
    - Group formation (2+ tracks within proximity/similar parameters)
    - Determine: **Altitude, Aspect, Range from Bullseye**
    - Classify hostility: **HOSTILE / SUSPECT / UNKNOWN / FRIENDLY**

12. **Broadcast Picture Call**
    - Format: `"CALLSIGN, [# GROUPS], GROUP [BRAA], [ALTITUDE], TRACK [DIRECTION], [HOSTILITY]"`
    - Example: `"TANGO, TEN GROUPS, GROUP ROCK 250/45, THIRTY-FIVE THOUSAND, TRACK EAST, HOSTILE"`
    - Update as picture changes (new groups, splits, merges)

### Commit Decision (Critical Decision Point)

13. **Evaluate Commit Criteria** (ALSSA ACC Standards)
    - **Range**: Is threat within commit range for friendly weapons?
    - **Hostility**: Confirmed hostile via ID Matrix or intel?
    - **Intent**: Threat axis indicates attack on defended asset?
    - **Fighter Status**: Are CAP assets in position with fuel/weapons?

14. **Issue COMMIT** (Two-Way Communication Required)
    - Controller-directed: `"RAPTOR COMMIT"`
    - Fighter-acknowledged: `"RAPTOR 1"`
    - **OR** Fighter-requested: Fighter calls `"RAPTOR COMMIT"`, controller transitions to tactical control

15. **Transition to Tactical Control**
    - Shift from picture calls to **Leading Edge Picture** (priority threats first)
    - Provide **BRAA** (Bearing, Range, Altitude, Aspect) to priority group
    - Example: `"NORTH GROUP ROCK 300/15, THIRTY-FIVE THOUSAND, HOSTILE"`

### Engagement Phase (Fighter-on-Track)

16. **Provide Control Updates**
    - **Maneuver instructions** (if requested): `"TURN LEFT/RIGHT HEADING XXX"`
    - **Aspect updates**: `"TRACK COLD"` (moving away) or `"TRACK HOT"` (inbound)
    - **Range/Altitude changes**: `"GROUP NOW 280/40, DESCENDING"`

17. **Monitor Kill Chain**
    - Track fighter-to-target closure
    - Call **"IN RANGE"** when fighter reaches weapons employment zone
    - Provide **"SORTED"** confirmation if multiple threats being engaged

18. **Weapons Tracking**
    - Monitor for **"FOX 3"** (active radar missile launch) calls from fighters
    - Track missile impacts or misses
    - Issue **"SPLASH"** (confirmed kill) or guide for re-attack

19. **Threat Response**
    - If new threats appear during engagement: **Prioritize** (closer/higher threat first)
    - Call **"NEW GROUP"** with updated BRAA
    - Manage multi-group scenarios (avoid commit delay – see WD Techniques)

### Tanker Coordination (As Needed)

20. **Monitor Fuel State**
    - Track fighter fuel levels via check-ins
    - Pre-coordinate tanker availability

21. **Handoff to Tanker**
    - Provide tanker location (bullseye or track ID)
    - Pass control to tanker controller or AAR net
    - Log time off-station

22. **Recovery to CAP**
    - Re-establish control after refuel
    - Update picture (may have changed during absence)
    - Resume mission

### Defensive Actions (If Friendly Aircraft Under Threat)

23. **Declare THREAT** (Immediate Call)
    - Format: `"THREAT, [CALLSIGN], [BRAA TO THREAT]"`
    - Example: `"THREAT, RAPTOR, BULLS 180/20, HIGH, TRACK HOT"`

24. **Provide Defensive Maneuver** (if ROE permits)
    - `"BREAK RIGHT/LEFT"` (immediate hard turn)
    - `"NOTCH"` (perpendicular to threat radar)
    - Coordinate chaff/flare employment if applicable

## Mission Termination & Handover (End of Vul)

25. **RTB Coordination**
    - Clear fighters to exit BMA
    - Provide safe passage routing
    - Handoff to approach/tower frequencies

26. **Positional Handover** (if continuous ops)
    - Use **Handover Checklist** (Crew Aid, Table A4.5)
    - Brief: WORDS (airspace control status), PUC/TUC (picture), ongoing engagements
    - Transfer active tracks and fighter status

27. **Data Collection for Debrief**
    - Mark **Debrief Focus Point (DFP)** times on tape
    - Note: Communication errors, commit delays, ID issues
    - Log Lessons Learned (LL)

## Post-Mission Debrief (H+1:00 to H+2:00)

28. **Mass Debrief**
    - Review DFPs using recorded audio/radar tapes
    - Identify error types:
      - **Briefed** (instructional error)
      - **Understood** (perception error)
      - **Executed** (execution error)
      - **Valid** (planning error)

29. **Document Improvements**
    - Update SOPs if procedural issue found
    - Create training scenarios for identified weaknesses
    - Submit trends to higher HQ (Crew Aid Item 22: SII)

---

## Key WD Actions Summary
- **Before**: Plan, Brief, Configure
- **During**: Picture → Commit → Control → Engage → Repeat
- **After**: Handover → Debrief → Improve

*Sources: ALSSA ACC 2024, AFTTP 3-3.CRC, CRC Crew Aid (01 Mar 24), WD Techniques*
