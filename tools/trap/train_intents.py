"""Train the ScammerTrap intent model (what is the scammer doing in this message?) and export it for the app.

    python tools/trap/train_intents.py /path/to/secondthought      (server repo's Python env, for the text normaliser)
"""
from __future__ import annotations

import json
import random
import re
import struct
import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import FeatureUnion

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / "backend"))
from intents_data import DATA, SLOTS  # noqa: E402
from intents_test import TEST  # noqa: E402
from app.detect.normalize import normalize  # noqa: E402  (same preprocessing as the app)

OUT = HERE.parents[1] / "public" / "engine"
rng = random.Random(13)
PREFIX = ["", "", "", "sir ", "madam ", "dear customer ", "hello, ", "ji ", "listen, ", "ok "]
SUFFIX = ["", "", "", " please", " now", " ok", " madam", " sir", "!", ".", " pls", " ji"]


def fill(t: str) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: rng.choice(SLOTS[m.group(1)]), t)


def expand():
    X, y, g = [], [], []
    for gi, (intent, temps) in enumerate(DATA.items()):
        for ti, t in enumerate(temps):
            for _ in range(8):
                s = fill(t)
                if intent not in ("greeting", "confirm") and rng.random() < 0.6:
                    s = rng.choice(PREFIX) + s + rng.choice(SUFFIX)
                if rng.random() < 0.3:
                    s = s.upper() if rng.random() < 0.2 else s.capitalize()
                X.append(s); y.append(intent); g.append(f"{intent}:{ti}")
    return X, y, g


def prep(t):
    return normalize(t).deleet


def encoder():
    return FeatureUnion([
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=1, sublinear_tf=True, max_features=60000)),
        ("word", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True, token_pattern=r"(?u)\b\w+\b", max_features=20000)),
    ])


def fit(X, y, labels):
    enc = encoder()
    M = enc.fit_transform([prep(x) for x in X])
    yy = np.array(y)
    clfs = {}
    for lab in labels:
        clfs[lab] = LogisticRegression(C=6.0, class_weight="balanced", max_iter=3000).fit(M, (yy == lab).astype(int))
    return enc, clfs


def predict(enc, clfs, labels, texts):
    M = enc.transform([prep(t) for t in texts])
    P = np.column_stack([clfs[l].predict_proba(M)[:, 1] for l in labels])
    return [labels[i] for i in P.argmax(1)], P


X, y, groups = expand()
labels = list(DATA.keys())
print(f"training examples: {len(X)} from {sum(len(v) for v in DATA.values())} templates, {len(labels)} intents")

# generalisation to unseen templates (whole templates held out per fold)
gkf = GroupKFold(n_splits=5)
correct = 0
for tr, te in gkf.split(X, y, groups):
    enc, clfs = fit([X[i] for i in tr], [y[i] for i in tr], labels)
    pred, _ = predict(enc, clfs, labels, [X[i] for i in te])
    correct += sum(p == y[i] for p, i in zip(pred, te))
cv = correct / len(X)
print(f"unseen-template cross-validation accuracy: {cv:.3f}")

enc, clfs = fit(X, y, labels)
tp, P = predict(enc, clfs, labels, [t for t, _ in TEST])
ok = [p == lab for p, (_, lab) in zip(tp, TEST)]
print(f"held-out test accuracy: {sum(ok)}/{len(TEST)} = {sum(ok) / len(TEST):.3f}")
for (t, lab), p, good in zip(TEST, tp, ok):
    if not good:
        print(f"  MISS  {t!r}: expected {lab}, got {p}")

# export in the same format as the other on-device models (src/engine/textmodel.js)
terms, idf, parts = [], [], []
for name, v in enc.transformer_list:
    vocab = sorted(v.vocabulary_.items(), key=lambda kv: kv[1])
    parts.append({"name": name, "analyzer": v.analyzer, "ngram": list(v.ngram_range), "offset": len(terms), "n": len(vocab)})
    terms += [t for t, _ in vocab]
    idf += list(v.idf_)
(OUT / "trap_intent.terms.txt").write_text("\n".join(terms), encoding="utf-8")
np.asarray(idf, dtype="<f4").tofile(OUT / "trap_intent.idf.f32")
with open(OUT / "trap_intent.coef.bin", "wb") as f:
    for lab in labels:
        w = clfs[lab].coef_[0]
        idx = np.nonzero(np.abs(w) >= 0.01)[0].astype("<i4")
        f.write(struct.pack("<I", len(idx))); f.write(idx.tobytes()); f.write(w[idx].astype("<f4").tobytes())
meta = {"labels": labels, "parts": parts, "intercepts": {l: float(clfs[l].intercept_[0]) for l in labels}, "n_features": len(terms),
        "eval": {"cv_unseen_templates": round(cv, 3), "heldout": f"{sum(ok)}/{len(TEST)}", "n_train": len(X)}}
(OUT / "trap_intent.json").write_text(json.dumps(meta), encoding="utf-8")
# expected outputs for the JS parity check
(HERE / "expected.json").write_text(json.dumps([{"text": t, "pred": p} for (t, _), p in zip(TEST, tp)], ensure_ascii=False), encoding="utf-8")
print("exported", OUT / "trap_intent.json")
