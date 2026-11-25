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
- `.github/workflows/deploy.yml` runs that script every 30 minutes on weekdays from 12:05 to
  22:35 UTC (the U.S. release window), once a day on weekends, on every push to `main` and on
  demand. Each run starts from the data the live site is serving. Scheduled runs publish to
  GitHub Pages only when the data changed. If a download fails, the live data stays as it is.

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

GitHub turns off scheduled workflows after 60 days with no repository activity. If the data
stops updating, re-enable the workflow from the Actions tab.
