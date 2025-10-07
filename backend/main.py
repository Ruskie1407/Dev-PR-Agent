import os, requests, datetime as dt

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
import io, csv
from collections import defaultdict, Counter

app = FastAPI()

@app.get("/", response_class=HTMLResponse)
def home():
    return """
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:600px;margin:24px auto;padding:16px">
      <h1>BrightScheduler (Demo)</h1>
      <p>Upload roster → See shifts → Coverage RAG cards</p>
      <form action="/upload" method="post" enctype="multipart/form-data" style="margin:12px 0">
        <input type="file" name="file" accept=".csv" required>
        <button type="submit">Upload roster CSV</button>
      </form>
      <p><a href="/shifts">View shifts</a></p>
    </div>
    """

SHIFTS = []  # rows of [name, date, shift, status, role, site]

REQUIRED_COLUMNS = ["name","date","shift","status","role","site"]
ALLOWED_SHIFT = {"Day","Evening","Night"}
ALLOWED_STATUS = {"ok","late","sick","absent"}

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    cols = [c.strip() for c in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_COLUMNS if c not in cols]
    extra = [c for c in cols if c not in REQUIRED_COLUMNS]

    errors = []
    if missing:
        errors.append(f"Missing columns: {', '.join(missing)}")
    if extra:
        errors.append(f"Ignoring extra columns: {', '.join(extra)}")

    rows, n = [], 0
    for i, row in enumerate(reader, start=2):
        n += 1
        r = {k: (row.get(k,"") or "").strip() for k in REQUIRED_COLUMNS}
        if r["shift"] not in ALLOWED_SHIFT:
            errors.append(f"Line {i}: shift must be one of {sorted(ALLOWED_SHIFT)}")
        if r["status"].lower() not in ALLOWED_STATUS:
            errors.append(f"Line {i}: status must be one of {sorted(ALLOWED_STATUS)}")
        rows.append([r["name"], r["date"], r["shift"], r["status"].lower(), r["role"], r["site"]])

    if missing or (len(errors) and n == 0):
        return JSONResponse({"ok": False, "errors": errors}, status_code=400)

    global SHIFTS
    SHIFTS = rows
    return {"ok": True, "rows": n, "warnings": [e for e in errors if e.startswith("Ignoring")]}

REQUIRED = {
    ("Day","RN"): 2, ("Day","HCA"): 4,
    ("Evening","RN"): 1, ("Evening","HCA"): 3,
    ("Night","RN"): 1, ("Night","HCA"): 2,
}

def compute_coverage(rows):
    bucket = defaultdict(list)
    for n,d,s,st,r,site in rows:
        bucket[(d, site, s)].append({"name": n, "status": st, "role": r})
    out = {}
    for key, members in bucket.items():
        d, site, s = key
        present = Counter(m["role"] for m in members if m["status"] not in {"absent","sick"})
        need_rn = REQUIRED.get((s,"RN"), 0)
        need_hca = REQUIRED.get((s,"HCA"), 0)
        have_rn = present.get("RN", 0)
        have_hca = present.get("HCA", 0)
        worst = min(have_rn - need_rn, have_hca - need_hca)
        rag = "green" if worst >= 0 else ("amber" if worst == -1 else "red")
        out[key] = {"need":{"RN":need_rn,"HCA":need_hca},"have":{"RN":have_rn,"HCA":have_hca},"rag":rag}
    return out

@app.get("/shifts", response_class=HTMLResponse)
def shifts():
    if not SHIFTS:
        return """
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <div style="font-family:system-ui;max-width:860px;margin:24px auto;padding:16px">
          <a href="/">← Back</a>
          <h2>Shifts</h2><p>No roster uploaded yet.</p>
        </div>"""
    cov = compute_coverage(SHIFTS)
    cards = []
    for (d, site, s), c in sorted(cov.items()):
        color = {"green":"#1f6f43","amber":"#b88715","red":"#9b1c1c"}[c["rag"]]
        txt = f"{d} • {site} • {s} — RN {c['have']['RN']}/{c['need']['RN']}, HCA {c['have']['HCA']}/{c['need']['HCA']} → {c['rag'].upper()}"
        cards.append(f"<div style='background:{color};color:white;padding:8px 10px;border-radius:8px;margin:6px 0'>{txt}</div>")
    rows = "".join(
        f"<tr><td>{n}</td><td>{d}</td><td>{s}</td>"
        f"<td style='color:{'red' if st in ['sick','absent'] else 'inherit'}'>{st}</td>"
        f"<td>{r}</td><td>{site}</td></tr>"
        for n,d,s,st,r,site in SHIFTS
    )
    return f"""
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:860px;margin:24px auto;padding:16px">
      <a href="/">← Back</a>
      <h2>Shift Coverage</h2>
      {''.join(cards)}
      <h3 style="margin-top:18px">Roster Detail</h3>
      <table border=1 cellpadding=6>
        <tr><th>Name</th><th>Date</th><th>Shift</th><th>Status</th><th>Role</th><th>Site</th></tr>
        {rows}
      </table>
    </div>
    """
def _format_rag_html(cov: dict) -> str:
    cards = []
    for (d, site, s), c in sorted(cov.items()):
        color = {"green":"#1f6f43","amber":"#b88715","red":"#9b1c1c"}[c["rag"]]
        txt = f"{d} • {site} • {s} — RN {c['have']['RN']}/{c['need']['RN']}, HCA {c['have']['HCA']}/{c['need']['HCA']} → {c['rag'].upper()}"
        cards.append(f"<div style='background:{color};color:white;padding:8px 10px;border-radius:8px;margin:6px 0;border-radius:6px'>{txt}</div>")
    if not cards:
        return "<p>No roster uploaded yet.</p>"
    return "".join(cards)

def _send_email_resend(to_addr: str, subject: str, html: str):
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return {"ok": False, "error": "RESEND_API_KEY missing"}
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type":"application/json"},
        json={
            "from": "BrightScheduler <noreply@yourdomain.com>",
            "to": [to_addr],
            "subject": subject,
            "html": html
        },
        timeout=20
    )
    try:
        r.raise_for_status()
        return {"ok": True, "id": r.json().get("id")}
    except Exception as e:
        return {"ok": False, "error": str(e), "status": r.status_code, "body": r.text}

@app.get("/cron/daily-rag")
def daily_rag():
    # Build coverage from current SHIFTS
    cov = compute_coverage(SHIFTS) if SHIFTS else {}
    today_ph = dt.datetime.utcnow() + dt.timedelta(hours=8)  # simple PH time (UTC+8)
    subject = f"BrightScheduler RAG — {today_ph.strftime('%Y-%m-%d')} (PH)"
    html = f"""
    <div style="font-family:system-ui;max-width:700px;margin:16px auto">
      <h2 style="margin:0 0 8px">Daily Coverage Summary</h2>
      <div style="opacity:.7;margin:0 0 12px">{subject}</div>
      {_format_rag_html(cov)}
      <p style="opacity:.7;margin-top:16px">Automated mail from BrightScheduler.</p>
    </div>
    """
    to_addr = os.environ.get("RAG_TO_EMAIL", "")
    if not to_addr:
        return {"ok": False, "error": "RAG_TO_EMAIL not set", "preview_html": html}
    res = _send_email_resend(to_addr, subject, html)
    return {"to": to_addr, **res}


@app.get("/health")
def health():
    return {"ok": True}
