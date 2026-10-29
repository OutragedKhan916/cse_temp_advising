# Advising Portal

Degree-plan flowcharts for AUS CSE students (BS Computer Science, BS Computer Engineering). Shows each course's status, imports a transcript, plans the next semester and highlights critical pathways.

## Run locally
    npm install
    npm run dev        # http://localhost:3000

(If you get a 404 locally, clear the variable: PowerShell `Remove-Item Env:BASE_PATH`.)

## Transcripts you can upload (PDF or Word .docx)
- Unofficial transcript (PDF)
- Registrar transcript (PDF)
- Degree evaluation record (PDF or Word .docx)

The file is read inside the browser and is never uploaded anywhere. Courses are sorted into the catalog, natural science, major electives, GER categories and free electives; anything unplaced is listed as extra.

## Data (edit these)
- data/catalogs/CSE/<major>/<year>/catalog.json: courses (`pre`, `co`, `any`, `minCr`; optional `priority` 0-10 and `terms` ["fall","spring","summer"])
- data/ger.json: GER lists (same for everyone)
- data/catalogs/CSE/<major>/mje.json: major electives

## Deploy (GitHub Pages)
Settings -> Pages -> Source: GitHub Actions. Every push to `main` builds and deploys.

## Analytics (optional)
Cloudflare Web Analytics: Settings -> Secrets and variables -> Actions -> Variables -> add `CF_BEACON_TOKEN` with your beacon token. Without it, no script is added.

## Branch workflow
    git checkout -b feature/planner
    git push -u origin feature/planner     # Actions builds it
Merge into `main` to go live, or Actions -> "Build and deploy" -> Run workflow to preview a branch (allow the branch under Settings -> Environments -> github-pages).

## Feedback
b00107694@aus.edu
