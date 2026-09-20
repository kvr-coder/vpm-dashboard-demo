import json
import math
import random
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "state" / "vpm-state.json"
CHART_SPECS_PATH = ROOT / "data" / "demo-chart-specs.json"
SEED = 20260920
DEMO_VERSION = "northstar-v2.1"
LINE_NAMES = [
    "Atlas 01", "Atlas 02", "Beacon 01", "Beacon 02", "Cobalt 01",
    "Cobalt 02", "Delta 01", "Delta 02", "Ember 01", "Forge 01",
    "Forge 02", "Helix 01", "Ion 01", "Juniper 01",
]
PEOPLE = ["Alex Morgan", "Jordan Lee", "Sam Rivera", "Taylor Quinn", "Casey Rowan"]
TABS = [
    "overview", "safety", "people", "quality", "production", "supplychain",
    "cost", "maintenance", "engineering", "ci", "recognitions", "actions", "feedback",
]
PALETTE = {
    "primary": "#167d86",
    "secondary": "#e59a2f",
    "positive": "#2e8b57",
    "negative": "#d95d39",
    "neutral": "#6e7c87",
}


def series(length, center, spread, trend=0.0, seed_offset=0, decimals=0, maximum=None):
    rng = random.Random(SEED + seed_offset)
    values = []
    for index in range(length):
        wave = math.sin((index + seed_offset) / 2.6) * spread * 0.45
        noise = rng.uniform(-spread, spread)
        value = max(0, center + trend * index + wave + noise)
        if maximum is not None:
            value = min(value, maximum)
        values.append(round(value, decimals))
    return values


def labels(length):
    if length <= 12:
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][:length]
    start = date(2026, 9, 1)
    return [(start + timedelta(days=index)).strftime("%d %b") for index in range(length)]


def table_content(chart_id):
    if "overdue" in chart_id:
        return [
            {"Department": "Assembly", "Open": 3, "Overdue": 1, "Owner": PEOPLE[0]},
            {"Department": "Packaging", "Open": 5, "Overdue": 2, "Owner": PEOPLE[1]},
            {"Department": "Warehouse", "Open": 2, "Overdue": 0, "Owner": PEOPLE[2]},
        ]
    if "incident" in chart_id:
        return [
            {"Date": "18 Sep", "Area": "Packaging", "Type": "Near miss", "Status": "Closed", "Summary": "Guard alignment corrected during planned stop"},
            {"Date": "12 Sep", "Area": "Warehouse", "Type": "Observation", "Status": "Monitoring", "Summary": "Pedestrian route visibility improved"},
        ]
    if "backorders" in chart_id:
        return [
            {"Line": "Atlas 02", "Orders": 4, "Units": 1260, "Recovery": "21 Sep"},
            {"Line": "Forge 01", "Orders": 2, "Units": 540, "Recovery": "20 Sep"},
            {"Line": "Helix 01", "Orders": 1, "Units": 220, "Recovery": "20 Sep"},
        ]
    if "projects" in chart_id:
        return [
            {"Project": "Vision inspection upgrade", "Owner": PEOPLE[3], "Stage": "Execution", "Progress": "72%"},
            {"Project": "Compressed air optimization", "Owner": PEOPLE[4], "Stage": "Validation", "Progress": "88%"},
            {"Project": "Changeover cart standard", "Owner": PEOPLE[1], "Stage": "Pilot", "Progress": "45%"},
        ]
    return [
        {"Date": "19 Sep", "Area": "Assembly", "Issue": "Sensor drift", "Impact": "Low", "Status": "In progress"},
        {"Date": "17 Sep", "Area": "Packaging", "Issue": "Label feed variation", "Impact": "Medium", "Status": "Countermeasure set"},
    ]


def sanitize_chart(chart, index):
    chart = json.loads(json.dumps(chart))
    chart["canvasId"] = f"demo-chart-{index + 1}"
    options = chart.setdefault("opts", {})
    chart_type = options.get("type")

    if chart.get("templateType") == "image-board":
        return None
    if chart.get("templateType") == "data-table" or chart_type in {"data-table", "table"}:
        rows = table_content(chart.get("id", ""))
        options["tableRows"] = rows
        options["columns"] = [{"key": key, "label": key} for key in rows[0].keys()]
        return chart
    if chart_type == "calendar":
        options["storageKey"] = f"vpm-demo-calendar-{index + 1}"
        return chart

    original = options.get("input", [])
    length = max(len(original), 10) if isinstance(original, list) else 14
    length = min(length, 31)
    unit = options.get("unit", "")
    is_percent = unit == "%" or " %" in chart["title"] or "Rate" in chart["title"] or "OEE" in chart["title"]
    is_currency = unit in {"EUR", "€"} or "EUR" in chart["title"]
    if is_percent:
        center, spread, decimals = 84, 4, 1
    elif is_currency:
        center, spread, decimals = 18500, 2600, 0
    else:
        center, spread, decimals = 820, 120, 0

    options["labels"] = labels(length)
    maximum = 99 if is_percent else None
    trend = 0.12 if is_percent else 0.7
    options["input"] = series(length, center, spread, trend=trend, seed_offset=index * 3, decimals=decimals, maximum=maximum)
    if "input2" in options:
        options["input2"] = series(length, center * 0.96, spread * 0.7, trend=trend * 0.75, seed_offset=index * 3 + 1, decimals=decimals, maximum=maximum)
    target = round(center * (0.94 if "Waste" not in chart["title"] else 0.82), decimals)
    for key in ("red", "green", "aop"):
        if key in options:
            options[key] = [target for _ in range(length)]
    options["color"] = PALETTE["primary"]
    if "input2Color" in options:
        options["input2Color"] = PALETTE["secondary"]
    if "redLabel" in options:
        options["redLabel"] = "Target"
    if "greenLabel" in options:
        options["greenLabel"] = "Stretch"
    return chart


def main():
    charts = json.loads(CHART_SPECS_PATH.read_text(encoding="utf-8"))
    clean_charts = [item for index, chart in enumerate(charts) if (item := sanitize_chart(chart, index))]
    tiers = [
        {"id": 1, "label": "T1 · Line", "role": "Daily team", "accent": PALETTE["primary"], "accentHover": "#0d646c", "tabs": TABS, "level": 1, "parentId": 2},
        {"id": 2, "label": "T2 · Area", "role": "Area review", "accent": PALETTE["secondary"], "accentHover": "#c97d16", "tabs": TABS, "level": 2, "parentId": 3},
        {"id": 3, "label": "T3 · Plant", "role": "Plant leadership", "accent": PALETTE["primary"], "accentHover": "#0d646c", "tabs": TABS, "level": 3, "parentId": 4},
        {"id": 4, "label": "T4 · Network", "role": "Network review", "accent": PALETTE["neutral"], "accentHover": "#52616d", "tabs": TABS, "level": 4, "parentId": None},
    ]
    state = {
        "vpm-demo-version": DEMO_VERSION,
        "vpm-theme": "light",
        "vpm-current-tier": "3",
        "vpm-tiers-v2": json.dumps(tiers, ensure_ascii=False),
        "vpm-custom-charts": json.dumps(clean_charts, ensure_ascii=False),
        "vpm-action-items": json.dumps([
            {"id": "demo-a1", "title": "Stabilize Atlas 02 changeover", "description": "Validate the new centreline and confirm three consecutive runs.", "assignedTo": PEOPLE[0], "category": "Production", "status": "in-progress", "dueDate": "2026-09-23", "createdDate": "2026-09-17", "createdBy": PEOPLE[2], "priority": "high", "tier": 3, "updates": []},
            {"id": "demo-a2", "title": "Close warehouse route observation", "description": "Complete floor marking audit and team briefing.", "assignedTo": PEOPLE[1], "category": "Safety", "status": "new", "dueDate": "2026-09-22", "createdDate": "2026-09-18", "createdBy": PEOPLE[3], "priority": "medium", "tier": 3, "updates": []},
            {"id": "demo-a3", "title": "Confirm inspection capability", "description": "Review pilot results and release the validation summary.", "assignedTo": PEOPLE[4], "category": "Quality", "status": "done", "dueDate": "2026-09-25", "createdDate": "2026-09-16", "createdBy": PEOPLE[0], "priority": "medium", "tier": 3, "updates": []},
        ]),
        "vpm-recognitions": json.dumps([
            {"id": "demo-r1", "date": "2026-09-18", "by": PEOPLE[0], "culturalBelief": "Own the outcome", "detail": "Recovered the weekly plan through structured problem solving and clear shift handovers.", "toWhom": "Atlas team", "how": "Team huddle", "newsletter": False, "iconnect": False},
            {"id": "demo-r2", "date": "2026-09-15", "by": PEOPLE[3], "culturalBelief": "Improve every day", "detail": "Reduced inspection setup time while strengthening the verification step.", "toWhom": "Quality cell", "how": "Plant review", "newsletter": True, "iconnect": False},
        ]),
        "vpm-feedback": json.dumps([]),
        "vpm-escalation-messages": json.dumps([
            {"id": "demo-m1", "tier": 4, "reportsTo": None, "cascade": True, "text": "Keep recovery plans focused on the constraint and verify impact at the next review.", "metric": "Execution", "severity": "info", "author": PEOPLE[3], "timestamp": "2026-09-20T06:45:00.000Z", "status": "submitted", "targetTab": "overview", "boardType": "cascade"},
            {"id": "demo-m2", "tier": 2, "reportsTo": 3, "cascade": False, "escalatedToTier": 3, "escalatedThrough": [3], "text": "North Region service recovered to plan after dispatch sequencing was adjusted.", "metric": "Service", "severity": "info", "author": PEOPLE[2], "timestamp": "2026-09-20T05:55:00.000Z", "status": "escalated", "targetTab": "overview", "boardType": "escalation", "dismissedBy": []},
        ]),
        "vpm-ext-messages": "[]",
        "vpm-boards-v1": "[]",
        "_savedAt": "2026-09-20T07:00:00.000Z",
    }
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "state" / "vpm-state.js").write_text(
        "window.__VPM_STATE__ = " + json.dumps(state, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Generated {len(clean_charts)} sanitized live chart definitions.")


if __name__ == "__main__":
    main()
