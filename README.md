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
