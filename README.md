# Student Attendance (Rural School) Dashboard

A resilient offline-first attendance system, with predictive analytics using UCI Student Performance data.

## Features

- Attendance interface with Present/Absent/Late toggles
- Offline storage via IndexedDB (when offline, records are cached locally)
- Service Worker (`sw.js`) for PWA caching + offline page support
- Background sync (SyncManager) that pushes pending attendance records when online
- Predictive scoring using UCI dataset (`student-mat.csv`, `student-por.csv`)
- Risk estimation by absences (`risk-data.json` mapping)
- Live analytics CPU/graphs using Chart.js
- Tabbed UI: `Attendance` and `Live Analytics`
- CSV loader script to generate `app/mock-data.json` with 649 records

## Install / Run

1. Generate mock data:
   ```bash
   python3 scripts/import_uci_data.py
   ```

2. Start local web server from app folder:
   ```bash
   cd app
   python3 -m http.server 8000 --bind 0.0.0.0
   ```

3. Open in browser:
   - http://127.0.0.1:8000
   - or local host forwarding URL in Codespaces (port `8000`)

## Data mapping

- `absences` and `traveltime` from UCI dataset are mapped to app model.
- `G3` grade is used for predictive grading / risk scoring.

## Files

- `app/index.html` - app UI
- `app/styles.css` - app styling
- `app/app.js` - business logic (attendance, offline sync, RF predictor, charts)
- `app/db.js` - IndexedDB helper
- `app/sw.js` - service worker
- `app/mock-data.json` - seed student data
- `app/risk-data.json` - risk-level mapping by absences
- `scripts/import_uci_data.py` - loads UCI dataset into app JSON

## Predictive model

- Random forest-style ensemble implemented in JS in `app.js`.
- Train on UCI records (abscences/traveltime -> G3).
- Inference populates predicted G3 in UI and dropout risk categories (`LOW/MEDIUM/HIGH`).

## Notes

- If browser shows directory listing or refuses connection, ensure server is started in `/app` and check forwarding URL (Codespaces may require the forwarded URL or a different port).