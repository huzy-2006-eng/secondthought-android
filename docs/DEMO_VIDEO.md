# Demo video (about 3 minutes) and real screenshots

## Record the phone with scrcpy
```bash
scrcpy --record demo.mp4
```
To take a real screenshot at any point:
```bash
adb exec-out screencap -p > screenshots/device/01-home.png
```
Before recording, open the app once and wait for "Connecting…" to go away, which wakes the server.

## Script
| Time | Show | Say |
|---|---|---|
| 0:00 | Home screen | "Phone scams cost Indians thousands of crores a year. SecondThought pauses them before money moves." |
| 0:15 | Setup: notifications, call screening dialog | "One-time setup. Android only shows us calls from numbers that are not in your contacts, so family calls are never touched." |
| 0:35 | Call the phone from an unsaved number (or **Try a test call**) | "An unknown number calls. We ask first: protect this call? It already says this number is in 3 scam reports." |
| 0:55 | Tap Protect → tips → **Help! Alert my family** → text ready → **Call Hari** | "One tap texts or calls a family member, even without internet. They never see the conversation." |
| 1:20 | **Play this scam call (demo)** → Stop screen (second phone shows the live family alert) | "Fake police, secrecy, threat, payment demand: the Stop screen appears and family gets a live alert. Hang up, or hand over to our AI honeypot." |
| 1:55 | **Airplane mode on** → share a scam screenshot from WhatsApp → SecondThought → Scam | "Turn the internet off. Share a screenshot: the phone reads it and checks it itself. Nothing is uploaded, and it takes milliseconds." |
| 2:10 | Checker → **Reply with ScammerTrap** → decoy replies → UPI ID caught → home counters | "And we fight back: a decoy wastes the scammer's time and catches their payment details for the complaint." |
| 2:20 | Calls from a saved contact: no prompt | "Saved contacts: nothing happens. Nothing is ever recorded." |
| 2:35 | More → Scam network, Results | "Reports link scammers into campaigns. Measured on 7,275 real messages: F1 0.97." |
| 2:50 | Hindi home | "Built for every age: three big buttons, large text, three languages." |
