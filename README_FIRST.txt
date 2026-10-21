WVAS WEEKLY DTR — COMPLETE FILES

This pack contains complete replacement source files, not snippets:
- Code.gs
- index.html
- app.js
- styles.css

IMPORTANT
- Keep your existing assets/wvas-logo.jpg.
- Keep your existing Netlify attendance proxy/redirect configuration that currently serves /api/attendance. The frontend still uses API_URL = "/api/attendance".
- Do not share Code.gs publicly because it contains supervisor/intern PIN configuration.

INSTALLATION

A. Update Apps Script backend
1. Open the Google Sheet connected to your attendance system.
2. Extensions > Apps Script.
3. Open Code.gs, select all, and replace it with the complete Code.gs from this pack.
4. Save.
5. Deploy > Manage deployments > click Edit (pencil) on your existing Web app deployment.
6. Choose New version, then Deploy. Keep the same Web app deployment/access settings.

B. Update frontend
1. In your existing website project, replace index.html, app.js, and styles.css with the complete files in this pack.
2. Keep the existing assets folder/logo and your existing Netlify /api/attendance connection files/configuration.
3. Deploy the frontend to the same Netlify site using your usual method.

C. Test
1. Open the website and hard-refresh (Ctrl+Shift+R).
2. Sign in to Supervisor View.
3. Choose an intern and a start/end date, then click Preview DTR.
4. Download JPG or Excel (.xlsx).

The frontend adds a read-only weeklyReport request to the existing /api/attendance route. The Apps Script must be redeployed after updating Code.gs, or the backend will still respond "Unknown action" for weeklyReport.

FILENAME
The sample baseline is October 12–17, 2026 = Week 6. Filename example: W6_Baldorado.jpg / W6_Baldorado.xlsx. The default date selection is the most recently completed Monday–Saturday work week. If your official week numbers follow another baseline, update REPORT_WEEK_ANCHOR_DATE and REPORT_WEEK_ANCHOR_NUMBER near the top of app.js.

TESTING NOTE
JavaScript and Apps Script syntax were checked. This pack has not been connected to your live Netlify site or tested against your live Google Sheet from this environment; after deployment, verify with one intern/date range before using every weekly report.
