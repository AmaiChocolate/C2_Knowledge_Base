# C2 Knowledge Base + BC3 Scope Trainer

Personal mastery vault and browser training platform for **C2BMO / ABM / WD / MSO** duties.

## Layout

| Path | Purpose |
|------|---------|
| [`kb/`](kb/) | Obsidian knowledge vault (doctrine, checklists, systems, scenarios) |
| [`simulator/`](simulator/) | Browser BC3 tactical scope trainer (TPS-75 modeled as radar track feed) |
| [`picture_trainer/`](picture_trainer/) | ALSSA picture call drill (Parrot Sour-style animated formations) |

## Live demo (Picture Trainer)

After GitHub Pages is enabled, open:

**https://\<your-github-username\>.github.io/C2_Knowledge_Base/**

(Pushes to `main` that touch `picture_trainer/` auto-deploy via `.github/workflows/pages.yml`.)

Prior work archived at `C:\Users\Renla\ABM_Knowledge_System` — do not delete until you confirm this merge.

## Knowledge base (Obsidian)

1. Open Obsidian → **Open folder as vault** → select `D:\C2_Knowledge_Base\kb`
2. Start at [[00_Home/Mastery_Map|Mastery Map]] (`kb/00_Home/Mastery_Map.md`)

Source PDFs live outside the repo at `D:\ACC Refs` (kept out of git). Extracted text under `kb/05_Tools_And_CrossReferences/sources/` is gitignored when large.

## Simulator (BC3 scope)

1. Open `simulator/index.html` in Chrome / Edge / Firefox (double-click or drag into browser).
2. The display is a **BC3-style tactical scope**. The AN/TPS-75 is modeled as the **radar data source** that feeds tracks (no separate radar console UI).

MQF closed-book study remains at `D:\MQF_dev` (link from vault; verified facts promoted into `kb/06` and `kb/07`).

## Content policy

- Unclassified training / paraphrased doctrine only.
- Review stamps on promoted notes; do not treat imported stubs as verified truth.
- Simulator scenarios share IDs with `kb/04_Scenarios_And_CaseStudies`.
