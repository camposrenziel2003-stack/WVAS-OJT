<<<<<<< HEAD
# WVAS OJT Attendance — Weekly DTR Generator

This package updates the Supervisor View with a weekly DTR generator and keeps the existing intern login and time-in/time-out flow.

## What changed

- Select an intern and choose a start and end date.
- Preview the selected intern's records in a spreadsheet-style table before download.
- Download the preview as a JPG image or a real `.xlsx` Excel workbook.
- The filename is automatic, for example `W6_Surname.jpg` and `W6_Surname.xlsx`.
- The export columns match the supplied DTR samples: Date, Time In, Time Out, Actual Hours, Credited Hours, Status, Remarks, Last Updated, and Overtime.
- The weekly report API validates the supervisor PIN, reads from the master `Attendance` sheet, filters the selected intern and date range, and does not edit attendance records.
- Keeps the previous Supervisor View search/status filter, 600-hour progress view, last-refreshed indicator, and Export All feature.

## Week number reference

The supplied examples identify **October 12–17, 2026 as W6**. The frontend uses that as the week-number anchor. If the official schedule uses a different numbering scheme, update `REPORT_WEEK_ANCHOR_DATE` and `REPORT_WEEK_ANCHOR_NUMBER` near the top of `app.js`. Week numbers are calculated from the Monday of the selected start date's week.

## Apply the frontend

1. Back up the currently deployed `index.html`, `app.js`, `styles.css`, and `netlify.toml`.
2. Replace them with the files in this folder. Keep your existing `assets/wvas-logo.jpg` and any current Netlify API proxy/function files.
3. The JPG and XLSX export libraries are loaded from jsDelivr when the page opens, so users need internet access for those two export actions.

## Apply the Apps Script backend change

The `Code.gs` in this folder includes a new `weeklyReport` action. It is based on the `Code.gs` you uploaded and keeps the current `SPREADSHEET_ID`, schedule, PIN configuration, and existing routes intact.

1. Open the existing Google Apps Script project attached to the attendance spreadsheet.
2. Back up the existing script, then replace its contents with this package's `Code.gs` and save.
3. Go to **Deploy → Manage deployments**, edit the existing Web App deployment, choose **New version**, and deploy it. Keep the same deployment/access settings your current attendance site uses.
4. Test an intern login, time-in/time-out flow, Supervisor View refresh, and the new weekly report before relying on it for submissions.

The existing frontend uses `API_URL = "/api/attendance"`; keep your existing Netlify proxy/routing to Apps Script. This package does not invent or replace that deployment route.

## Important notes

- The uploaded `Code.gs` contains an admin PIN and intern PINs. Keep the Apps Script source private and do not publish those values in a public repository.
- The weekly report uses the date values in the master `Attendance` sheet and includes only records that exist for the selected intern/date range. It does not synthesize absent/no-record days.
- `Actual Hours` is exported as a numeric value, `Credited Hours` and `Overtime` remain numeric, and the JPG preview formats the same columns for easy reading.
=======
# WVAS OJT Attendance System

A web-based attendance and OJT hour management system developed to streamline intern time tracking, attendance monitoring, hour computation, and attendance report generation.

## Features

- Intern authentication using name selection and PIN
- Daily time-in and time-out tracking
- Attendance status monitoring
- Daily credited hours calculation
- Total and remaining OJT hour tracking
- Supervisor dashboard
- Team attendance overview
- Individual intern attendance reports
- Consolidated attendance report export
- CSV report generation
- API integration
- Overtime tracking

## System Overview

The system provides two main views:

### Intern View

Interns can log in using their assigned name and PIN, record their daily time-in and time-out, and monitor their attendance progress and completed OJT hours.

### Supervisor View

Supervisors can monitor team attendance, view individual attendance records, track total credited hours, and generate attendance reports.

## Tech Stack

- HTML5
- CSS3
- JavaScript
- Google Apps Script
- Google Sheets
- Netlify
- API Integration

## Key Functionalities

### Attendance Tracking

The system allows interns to record their daily time-in and time-out while displaying their attendance status and credited hours.

### OJT Hour Monitoring

Interns can view their total completed hours, attendance days, and remaining hours required to complete their OJT.

### Supervisor Dashboard

The supervisor dashboard provides an overview of team attendance, including time-in, time-out, daily hours, total hours, remaining hours, and attendance status.

### Reporting

The system supports consolidated and individual attendance reports and allows reports to be exported as CSV files.

### Overtime Tracking

The system includes overtime handling in the attendance calculation, with overtime tracked separately from regular credited hours.

## Project Structure

```text
WVAS-OJT/
├── assets/
│   └── wvas-logo.jpg
├── app.js
├── index.html
├── styles.css
├── netlify.toml
├── README.md
└── .gitignore
>>>>>>> d9f8ed55c23f37901afc55f549c8bf62f63f1947
