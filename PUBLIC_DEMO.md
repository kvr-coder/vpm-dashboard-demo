# Northstar Operations Control · V2

This branch is a public-safe demonstration of a visual performance management board.

- All people, events, projects, line names, dates, and numerical values are synthetic.
- Live charts are rendered in the browser with Chart.js and remain editable through Data Studio.
- The demo state is deterministic and can be rebuilt with `python scripts/build-public-demo.py`.
- The first V2 load clears only legacy `vpm-*` browser storage before importing the public demo state.
- The original V1 remains preserved in the separate private source repository; this public repository contains only the sanitized V2 demo.

Run locally from the repository root:

```text
python -m http.server 8766
```
