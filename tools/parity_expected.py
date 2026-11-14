"""Produce the server's (Python) answers for the on-device parity test.

    python tools/parity_expected.py /path/to/secondthought      (server repo's Python env)
Writes tools/parity/expected.json.gz, then run:  node tools/parity.mjs
"""
from __future__ import annotations

import csv
import gzip
import json
import random
import sys
from pathlib import Path

SERVER = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(SERVER / "backend"))
OUT = Path(__file__).resolve().parent / "parity" / "expected.json.gz"

from app.detect import ml  # noqa: E402
from app.detect.checker import check_text  # noqa: E402
from app.detect.fusion import ConversationRisk  # noqa: E402
from app.detect.normalize import normalize  # noqa: E402
from app.detect.rules import match_rules  # noqa: E402
from app.detect.urls import check_url, model_probability  # noqa: E402
from app.extract import extract, redact  # noqa: E402

D = SERVER / "ml" / "data"


def jl(p):
    op = gzip.open if str(p).endswith(".gz") else open
    with op(p, "rt", encoding="utf-8", newline="\n") as f:
        return [json.loads(l) for l in f if l.strip()]


def msg_case(text, source):
    r = check_text(text)
    return {"source": source, "text": text, "verdict": r["verdict"], "score": r["score"], "parts": r["parts"],
            "tactics": sorted(t["tactic"] for t in r["tactics"]), "scam_type": r["scam_type"],
            "rules": sorted(h.rule_id for h in match_rules(normalize(text))),
            "entities": [[e.kind, e.value] for e in extract(text)], "redacted": redact(text),
            "msg_p": r["message_probability"]}


cases = {"messages": [], "conversations": [], "urls": []}
for r in jl(D / "external" / "scamshield_test.jsonl.gz"):
    cases["messages"].append(msg_case(r["text"], "scamshield_test"))
for name in ("heldout/messages.jsonl", "dev/messages.jsonl"):
    for r in jl(D / name):
        cases["messages"].append(msg_case(r["text"], name))
print("messages", len(cases["messages"]))

convs = []
for name in ("heldout/conversations.json", "heldout/conversations_v2.json"):
    convs += [(name, c) for c in json.loads((D / name).read_text(encoding="utf-8"))]
convs += [("demo/scenarios.json", c) for c in json.loads((SERVER / "demo" / "scenarios.json").read_text(encoding="utf-8"))]
for src, c in convs:
    conv = ConversationRisk()
    turns = []
    for t in c["turns"]:
        s = conv.add_utterance(t["text"], speaker=t["speaker"], ml_scores=ml.tactic_scores(t["text"]))
        turns.append({"score": s["score"], "intervene": s["intervene"], "tactics": sorted(x["tactic"] for x in s["tactics"])})
    cases["conversations"].append({"source": src, "id": c.get("id"), "turns": [{"speaker": t["speaker"], "text": t["text"]} for t in c["turns"]],
                                   "expected": turns, "scam_type": conv.snapshot([], [])["scam_type"]})
print("conversations", len(cases["conversations"]))

rng = random.Random(7)
urls = []
with open(D / "raw" / "urls_faizann24.csv", encoding="utf-8", errors="ignore") as f:
    rows = list(csv.DictReader(f))
urls += [r["url"] for r in rng.sample(rows, 3000)]
with open(D / "raw" / "urls_phishtank.csv", encoding="utf-8", errors="ignore") as f:
    rows = list(csv.DictReader(f))
urls += [r["url"] for r in rng.sample(rows, 1000)]
lines = (D / "raw" / "urls_benign_iscx.csv").read_text(encoding="utf-8", errors="ignore").splitlines()
urls += rng.sample([l for l in lines if l.strip()], 1000)
urls += [e.value for m in cases["messages"] for e in extract(m["text"]) if e.kind == "url"][:2000]
for u in urls:
    r = check_url(u)
    cases["urls"].append({"url": u, "p_model": model_probability(u), "probability": r["probability"], "verdict": r["verdict"], "source": r["source"]})
print("urls", len(cases["urls"]))
OUT.parent.mkdir(exist_ok=True)
with gzip.open(OUT, "wt", encoding="utf-8") as f:
    json.dump(cases, f, ensure_ascii=False)
print("wrote", OUT)
