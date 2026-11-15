# Sender-ID check (TRAI DLT headers)

In India every business that sends SMS must register a **header** (sender ID) on TRAI's DLT system. Phones show it as

```
VM-HDFCBK-S
││ │      └─ category: S service · T transactional · P promotional · G government (TRAI suffix, May 2025)
││ └──────── header: 6 characters, registered to one organisation
│└────────── licence service area (circle)
└─────────── telecom operator
```

Real banks and agencies text only from their own headers. Scammers can't register those, so they use ordinary mobile
numbers, foreign numbers, or lookalike headers. SecondThought compares **the sender** with **who the message claims to be**.

## Decisions

| Sender | Message claims bank / agency? | Result |
|---|---|---|
| Mobile or landline number | yes | **Scam signal** (score ≥ 80): "Banks send SMS from registered sender IDs, never from a personal number" |
| Foreign number | yes | **Scam signal** (≥ 85) |
| Foreign number | no, but has a link | Warning (≥ 40) |
| Lookalike header: stand-in digits (`1CICIB`, `SB1INB`), not 6 characters (`SBIINB1`, `HDFCBANK`), or one letter off a known header (`HDFKBK`) | any | **Fake sender ID** (≥ 85) |
| Known header of bank A, text claims bank B | yes | **Mismatch** (≥ 75) |
| Known header, category **P** (promotional) asking for OTP/KYC/account action | yes | Warning (≥ 45) |
| Header without the bank's name, text claims a bank | yes | Warning (≥ 50) |
| Header with the bank's name, but not in our list | yes | Info only + "Verify on TRAI's sender ID portal" |
| **Known header** of the bank it claims | yes / no | **Known sender**: bank-style wording no longer counts against it (score capped at 20) unless a link looks unsafe |
| 6-digit promotional ID (`AD-650022-P`) | any, no urgent request | Info: "Advert from a registered sender"; wording-only suspicion is cleared if links look safe |
| 6-digit promotional ID | asks for OTP/KYC/account action | Warning (≥ 40, ≥ 45 if it claims a bank/agency) |
| Any other registered header, no claim | no | Info: "Registered business sender"; same wording-only clearing |
| Mobile number, no claim | no | Info only (friends and delivery agents text from numbers) |
| Saved contact name, short code | | nothing |

"Claims to be" = a known organisation name **and** an official-sounding cue ("Dear customer", "your account", "KYC",
"blocked", "aapka khata"...). Measured on the 4,186 normal personal messages in the test set: **1** (0.02%) looked like an
official claim (it was a real Airtel notice).

## Safety rules (so the check can't be used against the person)

- **Only real senders can clear a message.** A sender typed by the person, picked from the inbox, or coming from the live
  SMS check is trusted. A sender read from a **screenshot** could be text the scammer typed into the message, so it can
  only *raise* a warning (mobile number, lookalike, mismatch), never clear one; the card says so.
- **Senders can't be injected from outside.** Other apps and web links can open SecondThought's Check screen, but never with
  a pre-filled message or sender. The live SMS warning stores its message on the phone under a random one-time id, and only
  those ids are accepted.
- **Registered business senders are cleared only when it's plainly an advert:** no urgent account request, no phone
  number, UPI ID, account number or email to contact, low manipulation score and safe links. Task/job scams that say
  "WhatsApp 98…" stay flagged.
- **Hindi (Devanagari) messages** are recognised too: "प्रिय ग्राहक, आपका एसबीआई खाता…" from a mobile number is flagged.

## Why the known-sender rule matters

The message model learned that bank wording ("Dear Customer, your HDFC Bank…") is what scams look like, so even real bank
SMS can score high on words alone. A registered header is evidence words can't give: the demo shows the **same
message** as *Looks safe* from `VM-HDFCBK-S` and as *Scam* from `+91 98201 44517`.

## Three ways in

1. **Type the sender** under the message in Check (optional field).
2. **Pick an SMS from the inbox** (READ_SMS, asked when first used): the sender comes with the message. Sharing an SMS to
   an app only shares its text, which is why this exists.
3. **Live check** (RECEIVE_SMS, turned on in Setup): each new SMS is checked in `SmsReceiver.java`; only a mismatch shows a
   notification, and tapping it opens Check with the full analysis. **Send a test warning** in Setup shows one on demand.

Screenshot scans also pick up the sender line (`14:02 • VM-SBIINB`).

## Data and tests

- `public/engine/senders.json`: organisations, the names that identify a claim, header tokens, and known headers.
  Headers come from the banks' own pages where available (HDFC: HDFCBK/HDFCBN; SBI: SBIINB/SBIPSG/SBICRD; Axis:
  AXSBKS/AXSBKT) or are widely reported. A missing header means *unknown*, never *fake*.
- `src/engine/sender.js` (app) and `SenderCheck.java` (live check) implement the same rules on the same file.
- `node tools/sender/test.mjs`: 40 cases (real, 6-digit promotional, Hindi script, mobile, foreign, lookalike, mismatch, promotional, contacts, screenshot).
- `sh tools/sender/run_java.sh`: Java vs JS agreement on those cases and on 4,284 real messages × 7 kinds of sender (100%).

## Limits

- Not the full TRAI registry (not published as data). Users can check any header at TRAI's sender ID portal or by sending
  it to 1909, and the app links to the portal.
- SMS permissions suit a sideloaded APK. On the Play Store only default SMS apps may hold them, so a store build would rely on
  the typed sender, screenshots and notification reading.
- Older phones or operators may not show the -S/-P/-T/-G suffix; a missing suffix never counts against a sender.
