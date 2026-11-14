# On-device detection

Since INNOVEX day 1, every scam check runs **inside the app**. The rules, the three trained text models and
the phishing-link model are the same ones the server uses, exported by `tools/export_engine.py` and run by
`src/engine/` (plain JavaScript, no native code).

| | Before | Now |
|---|---|---|
| Where the message is analysed | SecondThought server | **On the phone** |
| Works in airplane mode | No | **Yes**: message check, simulated call, typed call, Stop screen, payment pause, Help |
| Time per message check | network round trip (50+ s when the free server is asleep) | **about 2 ms** (desktop; a few ms on a phone) |
| What leaves the phone during a check | the whole message | **nothing**; only UPI IDs / numbers / links are looked up in the scam-report network, when online |
| Server cost per check | one request | **zero** |

The server is still used, only when a feature needs it:
- **Family live alert:** the conversation is shared only once the phone itself has found a scam, and only if a family member is linked.
- **Honeypot** and **complaint report:** when you choose them.
- **Scam-report network:** identifier lookups (never message text).

## Parity with the server (the proof)

`tools/parity_expected.py` runs the server's Python code on every test set, `tools/parity.mjs` runs the app's
JavaScript on the same inputs and compares. Latest run:

| Test set | Items | Same verdict | Notes |
|---|---|---|---|
| Real messages (Kaggle ScamShield test split, never trained on) | 7,275 | **100%** | |
| Our held-out + dev messages | 64 | **100%** | |
| All messages: exact same score | 7,339 | 99.56% | 99.99% within 1 point. Differences come from dropping tiny model weights to keep the app small |
| Rules matched / identifiers found / masking | 7,339 | 100% / 100% / 100% | |
| Conversations (held-out sets + demo scenarios), every turn | 39 conversations, 166 turns | **100%** | same score, same Stop-screen moment, same scam type |
| Links (phishing + benign URLs, plus links in messages) | 6,005 | **100%** | model probability within 6e-7 |

Average check time in the parity run: 1.7 ms per message. Engine load: about 0.6 s on a laptop.

Model size in the app: about 25 MB uncompressed (about 10 MB inside the APK), including a 392,000-domain phishing blocklist.

Re-run after retraining:
```bash
python tools/export_engine.py ../secondthought        # server repo's Python environment
python tools/parity_expected.py ../secondthought
node tools/parity.mjs
```
