# Advising Portal
Local: `npm install && npm run dev` -> http://localhost:3000

Data (edit these): data/cmp.json, data/coe.json (courses), data/ger.json (GER lists), data/mje.json (major electives).
Optional per-course fields: `priority` (0-10) and `terms` (["fall","spring","summer"]).

## Branch workflow
git checkout -b feature/planner      # work here
git push -u origin feature/planner   # GitHub Actions builds it
# when happy: merge into main -> auto-deploys to GitHub Pages
# to preview a branch live: Actions tab -> "Build and deploy" -> Run workflow -> pick the branch
#   (needs Settings -> Environments -> github-pages -> Deployment branches -> allow that branch)
