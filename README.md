# Advising Portal

An advising tool for BS Computer Science (CMP) and BS Computer Engineering (COE). It draws the degree plan as a flowchart,
shows what you can register for, and fills in your courses from an unofficial transcript.
Built with Next.js 14, React 18 and TypeScript. It runs entirely in the browser: nothing you upload leaves your computer.

## Run it locally

```
npm install
npm run dev
```

Open http://localhost:3000. If a build ever serves the site under a sub-path, make sure `BASE_PATH` is not set in your terminal.

## Features

- Flowchart of each plan with prerequisite arrows (solid) and prerequisite/concurrent arrows (dashed).
- Colors: pink = completed, orange = enrolled, yellow = can register, grey = locked (prerequisite or credits), green = planned.
- Click a course to mark it. Locked courses cannot be selected. Enrolled courses unlock the next ones; green planned courses unlock nothing.
- Transcript import (PDF): fills completed and in-progress courses, GER categories, major electives and free electives. A table under the chart shows what fills each elective box.
- Next-semester tab: ranked recommendations with a 0-10 priority and a credit-load check (15-17 normal, 12-14 and 18-19 warn, below 12 or above 19 not allowed).
- Critical pathways: reverses the arrows, shows in red what is still needed, and estimates how far each course can slip before graduation is delayed.
- Light and dark mode. Progress is saved in your browser.

## Data files

Everything the app knows lives in `data/`:

| File | Content |
|---|---|
| `cmp.json`, `coe.json` | Courses: `id`, `name`, `cr`, `cat`, `col`/`row` (position), `pre`, `co`, `minCr` |
| `ger.json` | Course codes allowed in each GER category |
| `mje.json` | Course codes allowed as major electives (per program) |

Optional course fields: `any` (a list where one is enough, e.g. COE221 needs CMP120 or PHY102), `priority` (0-10), `terms` (`["fall","spring","summer"]`).
A wrong prerequisite id is ignored and logged in the browser console instead of crashing the page.

## Deploy to GitHub Pages

1. Push the project to a GitHub repository, branch `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Each push to `main` builds and publishes the site at `https://<username>.github.io/<repo-name>/`.

The workflow in `.github/workflows/deploy.yml` also builds `feature/**` branches and pull requests (build only).
To publish a branch by hand: **Actions → Build and deploy → Run workflow**, choose the branch
(it must be allowed under Settings → Environments → github-pages → Deployment branches).

## Visitor counter (optional)

The site can report visits to Cloudflare Web Analytics.

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site** (hostname `<username>.github.io`, manual snippet) and copy the token.
2. GitHub repo → **Settings → Secrets and variables → Actions → Variables** → new variable `CF_BEACON_TOKEN` with that token.
3. Push. Visits and page views appear in Cloudflare. Without the variable nothing is added to the page.

## Project layout

```
app/          page.tsx (main screen), layout.tsx, globals.css
components/   Flowchart, Welcome (start screen and upload), Planner, Tracker
lib/          status (locking rules), plan (priorities), load (credit rules), critical, transcript (PDF reader), route (arrows)
data/         catalogs and course lists
public/       static files
```

## Transcript formats

Two layouts are supported: the unofficial transcript (Institution Credit / In Progress sections) and the registrar Academic History.
The Degree evaluation record layout is not supported yet.

## Contact

Suggestions and feedback: b00107694@aus.edu. Built by [@OutragedKhan916](https://github.com/outragedkhan916).
