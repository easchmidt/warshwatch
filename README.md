# Fed Watch

An unofficial dashboard of the economic indicators Fed Chair Kevin Warsh named in his
[Aug 28, 2026 Jackson Hole speech](https://www.federalreserve.gov/newsevents/speech/warsh20260828a.htm)
and his April 2026 confirmation hearing. [METRICS.md](METRICS.md) lists each metric and its data source.

It is a static site: `index.html`, `assets/` and `data/data.js`. It has no build step and no
dependencies. A free FRED API key (see below) enables the scheduled refresh on GitHub and the release calendar.

## How it works

- `scripts/fetch-data.ps1` downloads the data and writes `data/data.js`. Sources:
  - About 30 FRED series
  - Cleveland Fed median PCE
  - BEA's detailed PCE price table, used to compute the "breadth" metric: the share of PCE components with inflation above 3%
  - FRED's release calendar, for the "Upcoming data releases" table and each chart's next-update date (needs the API key; a local run without one keeps the calendar already in `data.js`)
  - The Finviz Elite economic calendar export, for the "Recent high-impact readings" table (actual, expected and prior values). Needs a Finviz Elite API token; without one the readings already in `data.js` are kept, and the table stays hidden if there are none
- `.github/workflows/deploy.yml` runs that script and publishes the site to GitHub Pages. It runs:
  - every 15 minutes on weekdays, 8:00 AM-6:45 PM ET, started by an outside scheduler (see
    [Refresh trigger](#refresh-trigger)), because GitHub's own scheduler can start runs hours late
  - hourly on weekdays and once a day on weekends from GitHub's scheduler, as a backup
  - on every push to `main`, and on demand from the Actions tab

  Each run starts from the data the live site is serving. Timed runs publish only when the data
  changed. If a download fails, the live data stays as it is.

## Run locally (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-data.ps1   # refresh data
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1        # http://localhost:8080
```

## Deploy to GitHub Pages

1. Create a new empty repository on GitHub.
2. Push this folder to its `main` branch.
3. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Get a free FRED API key at https://fred.stlouisfed.org/docs/api/api_key.html. Add it under
   **Settings → Secrets and variables → Actions → New repository secret**, named `FRED_API_KEY`.
   FRED's public CSV endpoint stalls requests from GitHub's servers, so the scheduled refresh needs the key.
   Without it, the workflow redeploys the committed `data/data.js` unchanged.
5. Optional: for the high-impact readings table, add your Finviz Elite API token (shown at
   https://elite.finviz.com/apis/calendar/economic) as a second secret named `FINVIZ_API_TOKEN`.
6. The workflow runs on the push. The site appears at `https://<user>.github.io/<repo>/`.

GitHub turns off scheduled workflows after 60 days with no repository activity. That only
affects the backup schedule; the outside trigger below keeps working.

## Refresh trigger

[cron-job.org](https://cron-job.org) (free) starts the workflow through GitHub's API, so new
data reaches the site within about 15 minutes of a release.

1. **Create a GitHub token.** GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories** → this repository.
   - Permissions → Repository permissions → **Actions: Read and write**. Nothing else.
   - Expiration: up to a year. Note the date; the refresh stops when the token expires.
2. **Create the cron job** at cron-job.org (**Create cronjob**):
   - URL: `https://api.github.com/repos/<user>/<repo>/actions/workflows/deploy.yml/dispatches`
   - Schedule: custom. Minutes `0,15,30,45`; hours `8-18`; days of week Monday-Friday.
     Time zone **America/New_York** (it handles daylight saving time).
   - Advanced → Request method **POST**. Request body: `{"ref":"main"}`
   - Advanced → Headers:
     - `Accept`: `application/vnd.github+json`
     - `Authorization`: `Bearer <your token>`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - Notifications: turn on failure emails, so an expired token gets noticed.
3. Use **Test run**. GitHub answers **204 No Content**, and a run appears in the Actions tab
   with the trigger "workflow_dispatch".

A run takes about 2-3 minutes. Runs that find no new data stop before deploying.
