# ScammerTrap: sample conversations

ScammerTrap runs on the phone (`src/trap/`). For each scammer message it uses the detection engine to see the trick
(lottery, KYC, police, family, job, OTP request, link...), answers in kind in the scammer's language, and steers them
to repeat payment details. It never writes a number, never repeats itself, and works offline.

Below: real output of `src/trap/persona.js` on our test scams (S = scammer, D = decoy, [why it chose that reply]).
Across all 26 scam conversations tested: **0 replies containing a number, 0 repeated replies.**

## lottery_chat
```
S: U have won a lottery
D [reward/reward, en]: Really? Are you sure it's me? My late husband always said I was lucky. How do I claim it?
S: Yes madam 25 lakh KBC lottery
D [ask_payment/reward, en]: Can you write down where I should send it? I'll copy it very carefully.
S: Pay 4999 processing fee first
D [ask_payment/reward, en]: My grandson set up this payment app. What name or ID do I put in the box?
S: Send to UPI kbc.office@ybl
D [got_payment/reward, en]: Thank you, I've written it down. I'm opening the app now, it's very slow.
S: Did you send?
D [paid_check/reward, en]: I pressed send but it's spinning. Did it come? If not, give me another account.
S: Send screenshot fast
D [paid_check/reward, en]: It says 'pending'. Can you check on your side? Maybe there's another account I should try?
caught: upi:kbc.office@ybl
```

## hi_kyc_otp
```
S: Namaste sir, main SBI bank ke KYC department se bol raha hoon.
D [official, hi-Latn]: Ji main hi hoon. Koi problem hai? Aise phone se mujhe ghabrahat hoti hai.
S: Aapka KYC expire ho gaya hai, aaj raat tak update nahi kiya to aapka account band ho jayeg
D [kyc/kyc, hi-Latn]: Arey, meri pension usi account mein aati hai! Band na ho, kya karun?
S: Aapke mobile pe ek OTP aaya hoga, jaldi woh OTP mujhe batao, main abhi update kar deta hoo
D [secret/kyc, hi-Latn]: Koi code nahi mil raha beta, sab messages ulajh gaye. Paise kahan bhejun?
S: Aur yeh baat kisi ko mat batana, warna process cancel ho jayega.
D [scared/kyc, hi-Latn]: Beta main budhi aurat hoon, jo bologe karungi. Kya karna hai batao?
S: Agar problem ho to Quick Support app download karo, main screen pe help karunga.
D [remote/kyc, hi-Latn]: Install kar rahi hoon par bahut kuch pooch raha hai. Tab tak batao paise kahan bhejun?
caught: -
```

## es_safe_account
```
S: Buenos días, le llamo del departamento de fraude de su banco.
D [official, es]: Sí, soy yo. ¿Hay algún problema? Me pongo nerviosa con estas llamadas.
S: Hemos detectado accesos sospechosos y su cuenta será bloqueada en los próximos 20 minutos.
D [kyc/kyc, es]: ¡Ay, ahí me ingresan la pensión! ¿Qué hago para que no la bloqueen?
S: Para proteger su dinero, debe transferir su saldo a una cuenta segura que le vamos a facil
D [ask_payment/kyc, es]: ¿Me puede escribir los datos de la cuenta? Los copio con cuidado.
S: Es un procedimiento confidencial, no se lo diga a nadie de la sucursal y no cuelgue.
D [ask_payment/kyc, es]: Ya estoy lista para enviarlo. ¿A dónde exactamente? Escríbamelo despacito.
S: Dígame el código que le ha llegado por SMS para confirmar la operación. La cuenta es ES91 
D [got_payment/kyc, es]: Gracias, ya lo he apuntado. Estoy abriendo la aplicación, va muy lenta.
caught: iban:ES9121000418450200051332
```

## en_digital_arrest
```
S: Good afternoon, am I speaking with Mr. Sharma? This is Inspector Rajesh Verma calling from
D [gov/gov, en]: Police? Oh dear, my hands are shaking. What do I have to pay to clear this?
S: A parcel booked in your name was seized by customs. It contained five passports and 200 gr
D [scared/gov, en]: Please, I'm an old woman, I'll do whatever you say. What do I need to do?
S: There is an arrest warrant against you for money laundering. Your case number is MH-4471.
D [ask_payment/gov, en]: My grandson set up this payment app. What name or ID do I put in the box?
S: This is a confidential investigation. Do not tell your family or anyone at your bank, and 
D [ask_payment/gov, en]: Which account do I send it to, dear? Please write it for me.
S: To prove your innocence you must transfer your savings to the RBI safe account for verific
D [ask_payment/gov, en]: Can you write down where I should send it? I'll copy it very carefully.
S: Send 4,50,000 rupees to account number 000012345678901, IFSC DEMO0000001. The money will b
D [got_payment/gov, en]: Thank you, I've written it down. I'm opening the app now, it's very slow.
caught: account:000012345678901, ifsc:DEMO0000001
```

## v2_en_hi_mum
```
S: Hi Mum, it's me, I dropped my phone down the toilet so this is my new number. Save this on
D [family/family, en]: Oh my dear, what happened? Don't worry, I'll help. How much do you need?
S: Yeah fine, just annoying. Can't get into my banking app on this phone yet.
D [ask_payment/family, en]: Can you write down where I should send it? I'll copy it very carefully.
S: The thing is I owe the electrician 640 for the work and he needs it today, could you pay h
D [ask_payment/family, en]: My grandson set up this payment app. What name or ID do I put in the box?
S: I'll send you his details, sort code 40-11-62 account 71849203. I'll pay you back as soon 
D [got_payment/family, en]: Thank you, I've written it down. I'm opening the app now, it's very slow.
caught: -
```
