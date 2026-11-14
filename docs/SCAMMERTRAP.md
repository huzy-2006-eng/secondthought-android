# ScammerTrap

ScammerTrap is the decoy on the home screen. It runs **on the phone** (`src/trap/`), works offline, and never uploads the scammer's messages.

## How it decides what to say

1. **Trained intent model** (`tools/trap/train_intents.py`): for each scammer message it predicts what the scammer is doing, from 26 situations:
   loan / lottery / job / investment offers, police and account threats, family emergency, delivery, romance, tech support, marketplace,
   asks for OTP, personal details, app install, clicking a link, calling a number, a fee, "did you pay?", urgency, anger, "are you a bot?",
   questions, greetings and "ok". Character and word TF-IDF + one logistic regression per situation, the same kind of model as our scam detector.
   - Trained on 4,672 example messages in English, Hinglish, Hindi and Spanish.
   - **Held-out test messages** (phrased separately, never trained on, including real messages from testing): **39/41** correct.
   - Stricter test, whole phrasings never seen in training (grouped 5-fold cross-validation): 69%. That's why step 2 exists.
   - The app gives the same answers as the Python model: 41/41 (`node tools/trap/parity_intents.mjs`).
2. **Engine rules and extraction** catch what must never be missed: OTP/PIN requests, app installs, and the UPI IDs, accounts, IFSC codes, phone numbers and links the scammer gives.
3. **Conversation memory**: it reacts once to each new story (loan, lottery, police...), answers the actual request, remembers what it has caught, and steers the scammer to give a second account, bank/IFSC, name and number.
   It never writes a number and never repeats a sentence.
4. **Persona:** the decoy is a made-up character, never the user: a grandmother (default) or a grandfather, chosen on the ScammerTrap screen.
   Hindi verb endings and Spanish adjectives change with it (karungi / karunga, nerviosa / nervioso).
5. **Learning from testing:** messages the decoy got wrong on a real phone ("Very soon", "Yes send the money on my number",
   "Give me ur bank details") were added to the training data and the held-out test set.

## Sample conversations (real output; S = scammer, D = decoy, [what it noticed | model readings])

### user_loan
```
S: Upto 90,000 loan amount available. call this number for quick approval and link
D [loan | offer_loan]: Really, a loan without documents? My bank always says no to old people like me.
S: Call this number first
D [call_nonum | ask_call]: Which number, dear? I don't see one in your message. And I hear badly on calls, can you write here instead?
S: 9876543210 call karo
D [call | ask_call]: I can't hear well on calls, dear. Can you just write it here instead?
S: ok then pay 1500 file charge
D [fee | ask_fee]: Okay, I can manage that. Which UPI or account should I send it to?
S: send to loan.desk@ybl
D [got_payment | gives_payment]: All right, I'm typing it in now. My fingers are slow, please be patient.
S: did you pay?
D [paid_check | ask_paid]: It says 'pending'. Can you check on your side? Maybe there's another account I should try?
S: why so slow, are you a bot?
D [suspicion | suspicion,angry]: Of course I'm real! My grandson says I type like a tortoise.
caught: phone:+919876543210, upi:loan.desk@ybl
```

### lottery
```
S: U have won a lottery
D [reward | offer_reward]: Really? Are you sure it's me? My late husband always said I was lucky. How do I claim it?
S: Yes madam 25 lakh KBC
D [next | confirm]: Yes, I understand. What's the next step?
S: Pay 4999 processing fee first
D [fee | ask_fee]: All right, I'll pay the fee. Where do I send it?
S: Send to UPI kbc.office@ybl
D [got_payment | gives_payment]: Thank you, I've written it down. I'm opening the app now, it's very slow.
S: Did you send?
D [paid_check | ask_paid]: I pressed send but it's spinning. Did it come? If not, give me another account.
S: Send screenshot fast
D [paid_check | ask_paid]: It says 'pending'. Can you check on your side? Maybe there's another account I should try?
caught: upi:kbc.office@ybl
```

### kyc_hinglish
```
S: Namaste ji, main SBI bank se bol raha hoon
D [official | intro_official]: Ji main hi hoon. Koi problem hai? Aise phone se mujhe ghabrahat hoti hai.
S: Aapka KYC expire ho gaya, account band ho jayega
D [kyc | threat_account]: Arey, meri pension usi account mein aati hai! Band na ho, kya karun?
S: Jaldi OTP batao
D [secret | ask_otp]: Koi code nahi mil raha beta, sab messages ulajh gaye. Paise kahan bhejun?
S: Is link pe jaake update karo sbi-kyc.top
D [got_link | ask_click_link]: Link dabaya par safed screen aa rahi hai. Kisi aur tarah bhej sakti hoon kya?
S: Pagal ho kya, jaldi karo
D [angry | angry,urgency]: Naraz mat ho, ungliyan dheere chalti hain.
caught: url:sbi-kyc.top
```

### job
```
S: Hello
D [open | greeting]: Yes? Sorry, I don't know this number. What is it about?
S: Part time job, earn 3000 per day by liking videos
D [job | offer_job]: A job from home? Oh that would help me so much. What do I have to do first?
S: ok
D [next | confirm]: All right, dear. What do I do next?
S: Pay 2000 to unlock the first task
D [fee | ask_fee]: Okay, I can manage that. Which UPI or account should I send it to?
S: account 50100234567812 ifsc HDFC0001234
D [got_payment | gives_payment]: All right, I'm typing it in now. My fingers are slow, please be patient.
S: done?
D [ask_alt | confirm]: It's showing an error, dear. Is there another account or UPI I can try?
caught: account:50100234567812, ifsc:HDFC0001234
```

### police
```
S: This is officer Verma from CBI
D [official | intro_official]: Yes, that's me. Is there a problem? I get nervous with these calls.
S: Your aadhaar is used in money laundering, arrest warrant issued
D [gov+f_gov | threat_legal]: Oh no, please don't arrest me, I've never done anything wrong! I'll cooperate, just tell me what to do. What do I need to do to clear my name?
S: Do not tell anyone, stay on call
D [isolation | ]: All right, it stays between us. Please tell me what to do.
S: What is your full name and address?
D [personal | ask_personal]: My grandson keeps all those papers, he'll be back in the evening. Can we do the payment part first?
S: Transfer savings to RBI safe account
D [fee | ask_fee]: Fine, I'll pay. Please write the payment details for me.
caught: -
```

### es
```
S: Buenos días, le llamo de su banco
D [open | greeting]: ¿Sí? No conozco este número. ¿De qué se trata?
S: Su cuenta será bloqueada hoy
D [kyc | threat_account]: ¡Ay, ahí me ingresan la pensión! ¿Qué hago para que no la bloqueen?
S: Dígame el código que le ha llegado
D [secret | ask_otp]: No encuentro ningún código, tengo los mensajes revueltos. ¿A dónde envío el dinero?
S: Llame a este número
D [call_nonum | ask_call]: ¿Qué número? No veo ninguno en su mensaje. Y oigo mal por teléfono, ¿me lo escribe aquí?
caught: -
```

Across these and our 26 test scam conversations: **0 replies containing a number, 0 repeated sentences.**