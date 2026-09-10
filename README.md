# WVAS OJT Attendance System — OT Only Update

This version keeps the existing frontend layout and design unchanged and adds only the overtime backend logic.

## Overtime rules
- Regular schedule: Monday–Saturday, 10:00 AM–6:00 PM.
- Lunch and listed breaks remain included in the scheduled 8 hours.
- Regular credited hours are capped at 8 hours.
- Overtime starts after 6:00 PM.
- Maximum overtime credited per day: 1 hour.
- The `Overtime` value is stored separately in the Attendance sheet.
- Credited Hours = regular credited hours + credited overtime.
- If an intern clocks out after 7:00 PM, the `Overtime` field still caps at 1.00 hour. The actual Time Out remains the real server timestamp.

## Files
- `Code.gs` — updated backend
- `index.html`, `styles.css`, `app.js` — unchanged frontend files
- `netlify.toml` — unchanged
- `assets/wvas-logo.jpg` — existing logo asset
