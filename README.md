# Advising Portal
Local: `npm install && npm run dev` -> http://localhost:3000
Courses: edit data/cmp.json and data/coe.json.

## Deploy to GitHub Pages
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo Settings -> Pages -> Source: **GitHub Actions**.
3. The push triggers .github/workflows/deploy.yml; when it finishes the site is at
   https://<username>.github.io/<repo-name>/
