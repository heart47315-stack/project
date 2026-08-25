# Navigation Audit

Current navigation is a manual `screen` state in `App.js`.

| Route state | Entry path | Notes |
| --- | --- | --- |
| splash/onboard1-3 | app start | Splash is normally superseded by auth-session initialization. |
| login/register | no session | Email auth works; Google is intentionally unavailable. |
| home | authenticated session | Profile loaded best-effort. |
| chat, drugs, drugDetail, route, profile | home/bottom navigation | Drug detail depends on selected search result. |

Missing routes include notifications, history, saved, settings, scan, compare, report-risk, answer/source views, and all admin views. A navigation library and route guards are required before those features can be treated as complete.
