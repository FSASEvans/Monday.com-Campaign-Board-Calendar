# Monday.com Campaign Board Calendar

Static dashboard (GitHub Pages) that converts a Monday.com board export into a CMO-ready filterable campaign calendar.

## Manual Refresh

1. Export Monday board to Excel.
2. Save as `data/latest-export.xlsx`.
3. Commit + push to `main`.
4. GitHub Pages automatically serves the updated data.

## GitHub Pages

Set Pages source to deploy from branch `main`, folder `/ (root)`.

## Filters in v1

- Brand
- Offer Type
- Audience
- Campaign name search

## Optional Auto-Sync

- Workflow: `.github/workflows/monday-sync.yml`
- Script: `scripts/monday-sync.mjs`
- Output JSON: `data/latest.json`
