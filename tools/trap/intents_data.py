"""Training data for the ScammerTrap intent model: what is the scammer doing in this message?

Templates with slots, in English, Hinglish, Hindi and Spanish. Written for training only; the held-out
test set (intents_test.py) is phrased separately and is never used for training.
"""

SLOTS = {
    "amt": ["5000", "Rs 9999", "₹2,500", "10k", "50,000 rupees", "1 lakh", "$200", "499", "3000"],
    "big": ["25 lakh", "10,00,000", "50 lakh", "$1,000,000", "90,000", "2 crore", "5 lakh"],
    "upi": ["help.desk@ybl", "kyc.update@okaxis", "refund.cell@paytm", "claim.office@ibl", "loan.team@axl"],
    "acct": ["50100234567812", "000012345678901", "3456789012345"],
    "ifsc": ["HDFC0001234", "SBIN0004567", "ICIC0009876"],
    "phone": ["9876543210", "+91 88001 23456", "7004561234", "+44 7700 900123"],
    "url": ["sbi-kyc-update.in", "bit.ly/claim-now", "loan-fast.xyz/apply", "parcel-help.top", "https://refund-portal.site"],
    "bank": ["SBI", "HDFC", "ICICI", "Axis bank", "PNB", "Kotak"],
    "agency": ["Mumbai police", "CBI", "cyber crime branch", "customs department", "narcotics bureau", "TRAI", "income tax department"],
    "app": ["AnyDesk", "TeamViewer", "QuickSupport", "this apk", "RustDesk"],
    "co": ["Amazon", "Flipkart", "FedEx", "DHL", "BlueDart", "Jio", "Airtel", "electricity board"],
}

# intent -> list of templates (any language)
DATA = {
    "greeting": [
        "hi", "hello", "hello madam", "hi sir", "good morning", "hey", "hello?", "namaste", "namaste ji", "hello ji",
        "hii", "hello dear", "hola", "buenos días", "नमस्ते", "हेलो", "hello are you there", "hi how are you",
    ],
    "intro_official": [
        "this is {bank} customer care", "i am calling from {bank} head office", "this is officer sharma from {agency}",
        "I am an executive from {co}", "this is the fraud department of your bank", "we are calling from {co} support team",
        "main {bank} se bol raha hoon", "main {agency} se bol raha hoon", "hum {co} customer care se baat kar rahe hain",
        "मैं {bank} से बोल रहा हूँ", "le llamo del departamento de seguridad de su banco", "soy agente de la policía nacional",
        "this is your bank manager", "I am calling on behalf of {co}",
    ],
    "offer_loan": [
        "upto {big} loan amount available", "instant loan of {big} approved for you", "get personal loan without documents",
        "pre approved loan {big} at 0% interest", "need loan? get {big} in 5 minutes", "your loan of {big} is sanctioned",
        "low interest loan available, apply now", "instant cash loan, no cibil check", "loan chahiye? {big} tak turant milega",
        "aapka {big} ka loan approve ho gaya hai", "bina documents ke loan milega", "आपका {big} का लोन मंजूर हो गया है",
        "préstamo inmediato de {big} aprobado", "loan available with minimum documents, reply yes",
        "Upto {big} loan amount available. call this number for quick approval", "your credit card limit increased, get loan on card",
    ],
    "offer_reward": [
        "you have won a lottery", "u have won {big} in lucky draw", "congratulations you won a car in KBC lottery",
        "your number selected for {big} prize", "you won an iphone in our lucky draw", "claim your cashback of {amt}",
        "your income tax refund of {amt} is approved", "you are eligible for {amt} reward points, redeem now",
        "aapne {big} ki lottery jeeti hai", "KBC se aapka lucky draw nikla hai", "आपने {big} की लॉटरी जीती है",
        "ha ganado un premio de {big}", "felicidades, usted es el ganador del sorteo", "your electricity bill refund {amt} pending",
        "you won a gift from {co}, claim today", "your SIM won {big} in anniversary draw",
    ],
    "offer_job": [
        "part time job available, earn {amt} per day", "work from home job, like youtube videos and earn",
        "we are hiring for online data entry job", "earn {amt} daily by rating hotels on google", "simple tasks, daily payment",
        "hello, I am HR from {co}, are you interested in part time job", "ghar baithe kamaiye {amt} roz", "part time job chahiye? daily {amt}",
        "घर बैठे काम करें और रोज़ {amt} कमाएं", "trabajo desde casa, gane {amt} al día", "you are selected for the job, joining fee required",
        "complete 3 tasks and get {amt} commission",
    ],
    "offer_invest": [
        "invest {amt} and get double in 7 days", "guaranteed returns 30% weekly", "join our crypto trading group for profit",
        "bitcoin investment plan with daily profit", "join VIP stock tips group, 100% profit", "our trading mentor will guide you",
        "paisa double scheme, {amt} lagao", "invest karo aur rozana profit kamao", "निवेश करें और पैसा दोगुना करें",
        "inversión con rentabilidad garantizada", "minimum deposit {amt} to start trading", "USDT investment, withdraw anytime",
    ],
    "threat_legal": [
        "there is an arrest warrant against you", "you will be arrested today", "a case of money laundering is registered on your aadhaar",
        "your parcel contains drugs, case filed", "you are under digital arrest", "police will come to your house in 2 hours",
        "FIR has been filed in your name", "court summons issued against you", "aap par case darj hua hai, giraftar honge",
        "aapke naam pe FIR hai", "आपके खिलाफ गिरफ्तारी वारंट है", "hay una orden de detención contra usted",
        "your number is involved in illegal activities", "stay on video call, you are under investigation",
    ],
    "threat_account": [
        "your account will be blocked today", "your KYC is expired, account will be suspended", "your SIM will be deactivated in 24 hours",
        "electricity connection will be disconnected tonight", "your PAN is not linked, account freeze", "your debit card is blocked",
        "aapka account band ho jayega", "aapka KYC expire ho gaya hai", "bijli ka connection aaj raat kaat diya jayega", "aapki sim band ho jayegi",
        "आपका खाता बंद हो जाएगा", "su cuenta será bloqueada hoy", "your netbanking is locked due to suspicious activity",
        "your yono account will be blocked, update pan",
    ],
    "family_emergency": [
        "hi mum it's me, this is my new number", "dad i lost my phone, using friend's phone", "grandma it's me, i'm in trouble",
        "mom I need money urgently, don't tell dad", "it's me, I had an accident, need money for hospital", "papa mera phone kho gaya, yeh naya number hai",
        "mummy main hoon, paise chahiye urgent", "माँ यह मेरा नया नंबर है", "mamá soy yo, este es mi número nuevo",
        "abuela soy yo, tuve un accidente", "your son is in police custody, pay bail", "beta hospital mein hai, turant paise bhejo",
    ],
    "delivery": [
        "your parcel is held at customs", "your {co} package could not be delivered, update address", "pay {amt} customs duty to release parcel",
        "your courier is pending, redelivery fee {amt}", "parcel from abroad, clearance charges required", "aapka parcel customs mein ruka hai",
        "आपका पार्सल रुका हुआ है", "su paquete está retenido en aduanas", "your shipment is on hold, confirm details",
    ],
    "romance": [
        "i love you dear", "you are so beautiful, i want to marry you", "i am sending you a gift box from london",
        "my love, i need help to clear customs for your gift", "sweetheart i miss you", "i am a doctor in the US army, i like you",
        "mi amor te extraño", "jaan main tumse pyaar karta hoon",
    ],
    "tech_support": [
        "your computer has a virus", "this is microsoft support, your windows license expired", "hackers have access to your bank account",
        "your phone is hacked, we will fix it", "your apple id is compromised", "aapke phone mein virus hai", "su ordenador tiene un virus",
    ],
    "marketplace": [
        "i want to buy your item on olx", "i am army officer, will buy your sofa", "is the bike still available? i will pay now",
        "i sent you a qr code, scan to receive money", "i paid extra by mistake, please return", "I will pay advance, send your upi",
        "aapka saaman lena hai, main army mein hoon", "qr scan karo paise aa jayenge", "quiero comprar su artículo, le pago ahora",
    ],
    "ask_otp": [
        "tell me the otp", "share the otp you received", "send me the 6 digit code", "what is the code you got",
        "read the OTP to verify", "please tell pin for verification", "share cvv on back of card", "forward the sms you received",
        "otp batao", "jo code aaya hai woh bata do", "pin batao jaldi", "ओटीपी बताइए", "dígame el código que le ha llegado",
        "why not telling otp", "otp send karo verification ke liye", "enter your upi pin to receive money",
    ],
    "ask_personal": [
        "send your aadhaar card photo", "tell me your full name and address", "share your pan card number", "what is your date of birth",
        "send your card number and expiry", "share your bank account details", "send a selfie for verification", "what is your account number",
        "apna aadhaar number batao", "apna naam aur pata bhejo", "पैन कार्ड नंबर बताइए", "envíeme su DNI", "send your card front and back photo",
    ],
    "ask_install": [
        "download {app} from play store", "install {app} and share the code", "install this app to get refund", "share your screen with me",
        "open play store and install {app}", "download the apk from this link", "{app} download karo", "app install karo main help karunga",
        "screen share karo", "{app} डाउनलोड कीजिए", "descargue la aplicación {app}", "allow screen sharing on your phone",
    ],
    "ask_click_link": [
        "click this link {url}", "open {url} and fill details", "visit {url} to claim", "update your kyc at {url}",
        "click on the link to get loan", "fill the form on {url}", "link pe click karo", "is link par jaakar details bharo",
        "इस लिंक पर क्लिक करें {url}", "haga clic en este enlace {url}", "tap the link I sent", "did you open the link?",
    ],
    "ask_call": [
        "call this number", "call this number first", "call me on {phone}", "call this number for quick approval",
        "call our helpline {phone}", "please call me back", "call karo is number pe", "is number pe call kijiye", "{phone} pe call karo",
        "इस नंबर पर कॉल करें", "llame a este número", "contact our agent on {phone}", "give a missed call to {phone}",
        "whatsapp me on {phone}", "call now for approval",
    ],
    "gives_payment": [
        "send to upi {upi}", "pay to {upi}", "account number {acct} ifsc {ifsc}", "transfer to {acct} {ifsc}", "my upi id is {upi}",
        "deposit in this account {acct}", "pay on this upi {upi}", "is upi pe bhejo {upi}", "{upi} pe paise daalo",
        "इस खाते में भेजें {acct}", "transfiera a la cuenta ES9121000418450200051332", "scan this QR and pay", "use this account, {acct}, {bank}",
    ],
    "ask_fee": [
        "pay {amt} processing fee first", "you need to pay {amt} registration charge", "pay {amt} to release the amount",
        "first pay the insurance fee of {amt}", "deposit {amt} as security", "pay tax of {amt} to claim prize", "file charge {amt} bharna hoga",
        "pehle {amt} processing fee bhejo", "{amt} jama karo phir loan milega", "पहले {amt} शुल्क जमा करें", "pague {amt} de comisión primero",
        "to withdraw you need to pay {amt}", "send {amt} to activate", "transfer your savings for verification",
    ],
    "ask_paid": [
        "did you send", "did you pay", "payment done?", "send screenshot", "have you transferred", "what happened, did you send money",
        "send screenshot fast", "bheja kya", "paise bheje?", "payment ho gaya?", "भेज दिया क्या", "¿ya ha enviado el dinero?", "show me the payment receipt",
    ],
    "urgency": [
        "hurry up", "do it fast", "quickly", "only 10 minutes left", "offer valid for today only", "do it immediately",
        "jaldi karo", "turant karo", "abhi karo warna", "जल्दी करो", "rápido, no hay tiempo", "last chance", "why so slow",
    ],
    "angry": [
        "why are you not replying", "are you stupid", "you are wasting my time", "don't waste my time", "reply fast idiot",
        "kya bakwas hai", "time waste mat karo", "jawab kyun nahi de rahe", "बकवास मत करो", "no me haga perder el tiempo",
        "useless", "i will block your number", "last time i am telling you",
    ],
    "suspicion": [
        "are you a bot", "are you real", "who are you", "are you making fun of me", "is this a recording", "you are not serious",
        "tum bot ho kya", "kaun ho tum", "¿es usted un robot?", "why are you asking so many questions", "are you police",
    ],
    "question": [
        "what is your name", "where are you from", "how old are you", "are you married", "what do you do", "which city",
        "aap kahan se ho", "aapka naam kya hai", "¿cómo se llama?", "do you have a bank account", "which bank do you use",
        "how much money do you have", "do you use google pay or phonepe",
    ],
    "confirm": [
        "ok", "yes", "fine", "okay madam", "right", "correct", "yes yes", "haan", "theek hai", "ji haan", "sí", "vale", "हाँ", "ok do it", "good",
    ],
}

MORE = {
    "greeting": ["hello how are you madam", "hi dear, good evening", "hello sir good afternoon", "hey there", "hi, are you free now",
                 "salaam", "hello hello", "good evening ma'am", "ram ram ji", "kaise ho", "hola señora", "buenas tardes"],
    "offer_reward": ["you are the lucky winner of our draw", "you have been selected for a free gift", "claim your prize money today",
                     "your number won the jackpot", "your account will receive bonus of {amt}", "free recharge of {amt} won",
                     "aapka inaam nikla hai", "aapko {amt} cashback mila hai", "badhai ho, aap jeet gaye", "ganaste un iPhone",
                     "winner of amazon lucky draw", "you are eligible for govt subsidy of {amt}", "pending refund of {amt}, claim now"],
    "offer_job": ["are you interested in earning extra income", "join our telegram for daily paid tasks", "hiring urgently, salary {amt} per week",
                  "only need a smartphone, earn from home", "review products and get paid", "online job for housewives and students",
                  "kaam ghar se, paisa roz", "naukri chahiye? join karo", "empleo desde casa, sin experiencia", "earn by watching videos, 50 per video"],
    "offer_invest": ["double your money in a week", "crypto gives 5% daily profit", "join premium trading group now",
                     "high returns on forex trading", "small investment big profit", "ipo allotment guaranteed, pay now",
                     "trading app se rozana kamai", "paise lagao, double pao", "gana dinero con criptomonedas", "stock market tips with sure profit"],
    "threat_legal": ["your aadhaar is used in a crime", "the police are coming to arrest you", "you are involved in money laundering case",
                     "drugs found in parcel in your name", "case will be registered against you", "you will go to jail",
                     "non bailable warrant issued", "cyber crime complaint against your number", "jail jaoge", "police ghar aayegi",
                     "aapke aadhaar se illegal kaam hua", "lo vamos a detener", "legal action will be taken", "do not disconnect, you are under arrest"],
    "threat_account": ["your account is on hold", "update kyc or account will close", "your card will be blocked in 2 hours",
                       "your number will stop working today", "your gas connection will be cut", "pan card deactivated, update now",
                       "account suspend ho jayega", "card block ho jayega", "kyc update karo warna band", "su tarjeta ha sido bloqueada",
                       "power supply will be disconnected at 9.30 pm", "your wallet is frozen", "your upi id will be blocked"],
    "family_emergency": ["mum can you help me with a payment", "it's your son, i'm stuck, send money", "dad don't call, my mic is broken",
                         "i'm in hospital please send money fast", "your grandson needs bail money", "mom i can't talk now, just text",
                         "bhai mushkil mein hoon, paise bhej", "beta hoon, naya number save karo", "hijo en apuros, necesito dinero",
                         "hi mum, save this number", "it's me, phone broke, can you pay a bill for me"],
    "delivery": ["your package is waiting, pay delivery charge", "parcel returned to warehouse, reschedule", "customs fee pending for your parcel",
                 "address incomplete, parcel on hold", "your order could not be delivered", "india post: parcel held, update address",
                 "parcel aaya hai, fees bharo", "courier wapas jayega", "su envío requiere pago de aduana", "shipment from dubai held at airport"],
    "romance": ["you are very sweet, i like talking to you", "i want to come to india to meet you", "send me your photo dear",
                "i am lonely, will you be my friend", "baby i need your help", "i have sent you a gift with diamonds and dollars",
                "tumse shaadi karni hai", "eres muy bonita, quiero conocerte", "my dear, customs is asking for fee for your gift"],
    "tech_support": ["your device is infected with malware", "your google account is hacked", "we detected suspicious login on your phone",
                     "windows support here, your pc has errors", "your phone will be blocked due to virus", "phone hack ho gaya hai",
                     "virus remove karna hai", "detectamos un virus en su móvil", "your whatsapp will be hacked"],
    "marketplace": ["i am interested in your post", "send your item photo, i will buy", "i will pay first, give me your phonepe",
                    "i am from army, can't come, will send courier", "scan the qr to get advance payment", "i sent double amount, return half",
                    "olx pe dekha, kharidna hai", "advance bhej raha hoon, qr scan karo", "le hago un bizum, acepte la solicitud",
                    "is it available? i'm ready to pay now"],
    "ask_otp": ["you will get a code, tell me", "what is the otp", "please read the message you got", "share the verification pin",
                "tell the 4 digit number", "give me the code on your screen", "sms aaya hoga, code batao", "otp share karo jaldi",
                "jo pin aaya woh bolo", "lea el código que recibió", "type your upi pin to accept", "read me the code from the sms"],
    "ask_personal": ["what is your full name", "tell me your address", "your mother's name please", "send your id proof",
                     "give your card details", "what is your aadhaar number", "share your account number", "send photo of your pan card",
                     "naam kya hai aapka pura", "address bhejo", "card ka number batao", "dígame su número de tarjeta", "your bank name and account please"],
    "ask_paid": ["is it done", "sent or not", "share the transaction id", "where is the payment", "money not received yet",
                 "payment kiya ya nahi", "screenshot bhejo", "kitna bheja", "¿ha hecho la transferencia?", "show me proof of payment",
                 "transaction successful?", "did it go through"],
    "urgency": ["hurry, time is running out", "you have only 5 minutes", "fast fast", "do it now or lose it", "right now please",
                "no time, act now", "quick, before deadline", "jaldi jaldi", "abhi ke abhi", "date nikal jayegi", "deprisa", "today is last date"],
    "angry": ["why so slow, are you mad", "stop playing games", "you are irritating me", "bloody fool", "nonsense, just do it",
              "pagal ho kya", "dimaag kharab hai", "kitni der lagegi", "faltu baat mat karo", "estoy perdiendo la paciencia",
              "hurry up you old fool", "shut up and pay", "i am getting angry now"],
    "question": ["how much is in your account", "do you live alone", "what is your profession", "do you have kids",
                 "which phone do you use", "which upi app you use", "kya karte ho aap", "aapki umar kitni hai", "¿dónde vive?",
                 "are you at home now", "is anyone with you", "what time are you free"],
    "confirm": ["yes ok", "alright", "sure", "okay fine", "done", "noted", "ok ok", "achha", "thik hai ji", "bilkul", "de acuerdo", "claro", "yes madam", "ok sir"],
}
for _k, _v in MORE.items():
    DATA[_k] = DATA[_k] + _v

# Added after phone testing (real messages the decoy got wrong)
FROM_TESTING = {
    "confirm": ["very soon", "soon", "within 1 hour", "today itself", "after 10 minutes", "it will come fast", "yes very soon",
                "jaldi aayega", "thodi der mein", "muy pronto", "don't worry it will come", "sure it will be credited"],
    "gives_payment": ["yes send the money on my number", "send money to this number", "pay on my phone number", "google pay on this number",
                      "phonepe to my number", "is number pe paise bhejo", "mere number pe gpay karo", "paytm karo is number pe",
                      "envíe el dinero a mi número", "send on same number"],
    "ask_personal": ["give me ur bank details", "send your bank details", "share ur account details", "give me your account and ifsc",
                     "apne bank ki details do", "bank details bhejo", "deme sus datos bancarios", "what is your bank account number and ifsc"],
}
for _k, _v in FROM_TESTING.items():
    DATA[_k] = DATA[_k] + _v
DATA["ask_fee"] = DATA["ask_fee"] + ["rápido, pague la comisión", "tiene que pagar una tasa de {amt}", "pague los gastos de gestión", "debe abonar {amt} primero",
                                      "pague el seguro para liberar el dinero", "haga un ingreso de {amt}"]
DATA["gives_payment"] = DATA["gives_payment"] + ["{phone}", "this is my number {phone}", "number is {phone}", "send on {phone}", "mera number {phone}"]
