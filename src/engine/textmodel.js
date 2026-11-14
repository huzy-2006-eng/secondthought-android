// TF-IDF (char_wb 2-5 + word 1-2, sublinear tf, l2 per part) + logistic regression, as in scikit-learn.
// Weights exported from the server's trained models by tools/export_engine.py.

export class TextModel {
  constructor(meta, termsText, idfBuf, coefBuf) {
    this.meta = meta;
    this.labels = meta.labels;
    const terms = termsText.split("\n");
    // one index per part: a char n-gram like "abc" and the word "abc" are different features
    this.index = meta.parts.map((part) => {
      const m = new Map();
      for (let i = part.offset; i < part.offset + part.n; i++) m.set(terms[i], i);
      return m;
    });
    this.idf = new Float32Array(idfBuf);
    const n = meta.n_features;
    this.weights = [];
    const view = new DataView(coefBuf);
    let off = 0;
    for (let k = 0; k < this.labels.length; k++) {
      const cnt = view.getUint32(off, true); off += 4;
      const w = new Float32Array(n);
      const idx = new Int32Array(coefBuf.slice(off, off + 4 * cnt)); off += 4 * cnt;
      const val = new Float32Array(coefBuf.slice(off, off + 4 * cnt)); off += 4 * cnt;
      for (let j = 0; j < cnt; j++) w[idx[j]] = val[j];
      this.weights.push(w);
    }
  }

  static charWb(doc, lo, hi) {
    const grams = [];
    for (const word of doc.replace(/\s\s+/gu, " ").split(/\s+/u)) {
      if (!word) continue;
      const w = Array.from(" " + word + " ");
      for (let n = lo; n <= hi; n++) {
        let off = 0;
        grams.push(w.slice(off, off + n).join(""));
        while (off + n < w.length) { off += 1; grams.push(w.slice(off, off + n).join("")); }
        if (off === 0) break;
      }
    }
    return grams;
  }

  static wordNgrams(doc, lo, hi) {
    const toks = doc.match(/[\p{L}\p{N}_]+/gu) || [];
    const out = [];
    for (let n = lo; n <= Math.min(hi, toks.length); n++) {
      for (let i = 0; i + n <= toks.length; i++) out.push(toks.slice(i, i + n).join(" "));
    }
    return out;
  }

  /** Sparse feature vector [[index, value], ...]. */
  vectorize(text) {
    const doc = text.toLowerCase();
    const feats = [];
    this.meta.parts.forEach((part, pi) => {
      const grams = part.analyzer === "char_wb" ? TextModel.charWb(doc, part.ngram[0], part.ngram[1]) : TextModel.wordNgrams(doc, part.ngram[0], part.ngram[1]);
      const counts = new Map();
      for (const g of grams) {
        const i = this.index[pi].get(g);
        if (i !== undefined) counts.set(i, (counts.get(i) || 0) + 1);
      }
      const vals = [];
      let norm = 0;
      for (const [i, c] of counts) { const v = (1 + Math.log(c)) * this.idf[i]; vals.push([i, v]); norm += v * v; }
      norm = Math.sqrt(norm);
      if (norm > 0) for (const p of vals) feats.push([p[0], p[1] / norm]);
    });
    return feats;
  }

  predict(text) {
    const x = this.vectorize(text);
    const out = {};
    this.labels.forEach((lab, k) => {
      const w = this.weights[k];
      let z = this.meta.intercepts[lab];
      for (const [i, v] of x) z += w[i] * v;
      out[lab] = 1 / (1 + Math.exp(-z));
    });
    return out;
  }
}
