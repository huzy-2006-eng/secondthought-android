"""Export the SecondThought detection engine (rules, models, lists) for on-device use.

Run with the SERVER repo's Python environment:
    python tools/export_engine.py /path/to/secondthought

Writes public/engine/* which src/engine/*.js loads in the app (and in tools/parity.mjs).
The Python code in the server repo stays the single source of truth; this only converts it.
"""
from __future__ import annotations

import gzip
import json
import shutil
import struct
import sys
import unicodedata
from pathlib import Path

import numpy as np

SERVER = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parents[1] / "public" / "engine"
sys.path.insert(0, str(SERVER / "backend"))

import joblib  # noqa: E402
from app.detect import rules as R  # noqa: E402
from app.detect import taxonomy as T  # noqa: E402
from app.detect import urls as U  # noqa: E402
from app.detect import ml  # noqa: E402

W = r"\p{L}\p{N}_"   # Python's Unicode \w (alphanumeric or underscore)
BOUND = rf"(?:(?<=[{W}])(?![{W}])|(?<![{W}])(?=[{W}]))"


def py2js(p: str) -> str:
    """Translate a Python `re` pattern into an equivalent JavaScript (u-flag) pattern."""
    out, i, in_class = [], 0, False
    while i < len(p):
        c = p[i]
        if c == "\\" and i + 1 < len(p):
            n = p[i + 1]
            if n == "b" and not in_class:
                out.append(BOUND)
            elif n == "w":
                out.append(W if in_class else f"[{W}]")
            elif n == "W":
                if in_class:
                    raise ValueError(f"\\W inside a class is not supported: {p}")
                out.append(f"[^{W}]")
            elif n == "-" and not in_class:
                out.append("-")
            elif n in "'\"" :
                out.append(n)
            else:
                out.append(c + n)
            i += 2
            continue
        if c == "[" and not in_class:
            in_class = True
        elif c == "]" and in_class:
            in_class = False
        out.append(c)
        i += 1
    return "".join(out)


def rx(pattern) -> str:
    return py2js(unicodedata.normalize("NFKC", pattern.pattern if hasattr(pattern, "pattern") else pattern))


def export_rules():
    rules = [{
        "id": r.id, "tactic": r.tactic, "strength": r.strength, "pattern": rx(r.pattern), "hint": r.hint,
        "negatable": r.negatable,
        "exclude_after": rx(r.exclude_after) if r.exclude_after else None,
        "exclude_before": rx(r.exclude_before) if r.exclude_before else None,
    } for r in R.RULES]
    helpers = {k: rx(getattr(R, k)) for k in ("_NEGATION_BEFORE", "_REQUEST_TO_SPEAKER", "_CRED_WORDS", "_PROTECTIVE")}
    (OUT / "rules.json").write_text(json.dumps({"rules": rules, "helpers": helpers}, ensure_ascii=False), encoding="utf-8")
    tax = {"tactics": T.TACTICS, "combos": [[a, b, v] for (a, b), v in T.COMBOS.items()], "scam_types": T.SCAM_TYPES}
    (OUT / "taxonomy.json").write_text(json.dumps(tax, ensure_ascii=False), encoding="utf-8")
    print(f"rules: {len(rules)}")


def export_text_model(src: str, name: str, eps: float):
    m = joblib.load(ml.ARTIFACTS / src)
    p = m["pipeline"]
    if hasattr(p, "encoder"):
        enc, clfs, labels = p.encoder, [p.classifiers[t] for t in p.labels], list(p.labels)
    else:
        enc, clfs, labels = p.named_steps["enc"], [p.named_steps["clf"]], ["scam"]
    terms, idf, parts = [], [], []
    for part_name, v in enc.transformer_list:
        prm = v.get_params()
        assert prm["lowercase"] and prm["norm"] == "l2" and prm["sublinear_tf"] and prm["strip_accents"] is None
        vocab = sorted(v.vocabulary_.items(), key=lambda kv: kv[1])
        assert [i for _, i in vocab] == list(range(len(vocab)))
        assert all("\n" not in t for t, _ in vocab)
        parts.append({"name": part_name, "analyzer": prm["analyzer"], "ngram": list(prm["ngram_range"]),
                      "token_pattern": prm.get("token_pattern"), "offset": len(terms), "n": len(vocab)})
        terms += [t for t, _ in vocab]
        idf += list(v.idf_)
    (OUT / f"{name}.terms.txt").write_text("\n".join(terms), encoding="utf-8")
    np.asarray(idf, dtype="<f4").tofile(OUT / f"{name}.idf.f32")
    intercepts, kept = {}, 0
    with open(OUT / f"{name}.coef.bin", "wb") as f:
        for lab, c in zip(labels, clfs):
            w = c.coef_[0]
            idx = np.nonzero(np.abs(w) >= eps)[0].astype("<i4")
            f.write(struct.pack("<I", len(idx)))
            f.write(idx.tobytes())
            f.write(w[idx].astype("<f4").tobytes())
            intercepts[lab] = float(c.intercept_[0])
            kept += len(idx)
    meta = {"labels": labels, "parts": parts, "intercepts": intercepts, "eps": eps, "n_features": len(terms),
            "threshold": m.get("threshold"), "source": src}
    (OUT / f"{name}.json").write_text(json.dumps(meta), encoding="utf-8")
    print(f"{name}: {len(terms)} features, {kept} weights kept (|w| >= {eps})")


def export_urls():
    booster = json.loads((ml.ARTIFACTS / "url_model.json").read_text())
    meta = json.loads((ml.ARTIFACTS / "url_model.meta.json").read_text())
    learner = booster["learner"]
    trees = learner["gradient_booster"]["model"]["trees"]
    base = float(str(learner["learner_model_param"]["base_score"]).strip("[]"))
    compact = []
    for t in trees:
        compact.append([t["left_children"], t["right_children"], t["split_indices"],
                        [float(x) for x in t["split_conditions"]], [int(x) for x in t["default_left"]]])
    obj = {"base_score": base, "objective": learner["objective"]["name"], "threshold": meta["threshold"],
           "best_iteration": int(learner["attributes"].get("best_iteration", len(trees) - 1)), "n_trees": len(trees),
           "feature_names": U.FEATURE_NAMES, "trees": compact,
           "lists": {"multi_suffixes": sorted(U.MULTI_SUFFIXES), "suspicious_tlds": sorted(U.SUSPICIOUS_TLDS),
                     "common_tlds": sorted(U.COMMON_TLDS), "shorteners": sorted(U.SHORTENERS), "free_hosts": sorted(U.FREE_HOSTS),
                     "brands": U.BRANDS, "suspicious_words": U.SUSPICIOUS_WORDS, "risky_extensions": sorted(U.RISKY_EXTENSIONS)}}
    (OUT / "url_model.json").write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    shutil.copy(ml.ARTIFACTS / "top_domains.txt", OUT / "top_domains.txt")
    with gzip.open(SERVER / "ml" / "data" / "phishing_domains.txt.gz", "rt", encoding="utf-8", errors="ignore") as f:
        doms = sorted({l.strip().lower() for l in f if l.strip() and not l.startswith("#")})
    (OUT / "phishing_domains.txt").write_text("\n".join(doms), encoding="utf-8")
    print(f"url model: {len(trees)} trees (best_iteration {obj['best_iteration']}), base_score {base}; blocklist {len(doms)}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    export_rules()
    export_text_model("tactic_model.joblib", "tactic_call", eps=0.0)
    export_text_model("tactic_model_messages.joblib", "tactic_msg", eps=0.05)
    export_text_model("message_model.joblib", "message", eps=0.02)
    export_urls()
    shutil.copy(SERVER / "demo" / "scenarios.json", OUT / "scenarios.json")
    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"total {total / 1e6:.1f} MB in {OUT}")
