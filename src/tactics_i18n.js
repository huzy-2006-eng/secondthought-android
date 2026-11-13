// Translations of the backend's tactic labels, advice and scam types for the
// screens a frightened user reads (intervention, live view). English comes from the API.
const TACTICS = {
  hi: {
    authority: ["अधिकारी होने का दावा", "असली बैंक, पुलिस या कंपनी बुरा नहीं मानती अगर आप फोन काटकर उनके आधिकारिक नंबर पर वापस फोन करें।"],
    urgency: ["जल्दबाज़ी का दबाव", "कुछ मिनटों में फैसला करने का दबाव आपको सोचने से रोकने के लिए है। आराम से सोचिए।"],
    threat: ["धमकी और डर", "कोई भी असली अधिकारी फोन या वीडियो कॉल पर गिरफ्तार नहीं करता, न ही केस निपटाता है।"],
    isolation: ["बात छिपाने को कहना", "जो आपसे परिवार या बैंक से बात न करने को कहे, वह कुछ छिपा रहा है। अभी किसी को बताइए।"],
    payment: ["अजीब तरीके से पैसे माँगना", "'सुरक्षित खाता' जैसी कोई चीज़ नहीं होती, और कोई असली अधिकारी गिफ्ट कार्ड या क्रिप्टो नहीं लेता।"],
    credentials: ["कोड, पिन या पासवर्ड माँगना", "ओटीपी, पिन या पासवर्ड कभी किसी को न बताएँ। पैसे पाने के लिए पिन की ज़रूरत कभी नहीं होती।"],
    remote_access: ["आपके फोन का एक्सेस माँगना", "किसी के कहने पर कोई ऐप इंस्टॉल न करें और अपनी स्क्रीन शेयर न करें।"],
    reward: ["इनाम या मुनाफ़े का लालच", "गारंटीड मुनाफ़ा और पहले फीस माँगने वाले इनाम हमेशा धोखा होते हैं।"],
    trust_building: ["जल्दी भरोसा जीतने की कोशिश", "जो अजनबी जल्दी भरोसा माँगते हैं, वे अक्सर अगली बार पैसे माँगते हैं।"],
    channel_switch: ["दूसरे ऐप पर ले जाना", "धोखेबाज़ सुरक्षा से बचने के लिए आपको व्हाट्सएप या टेलीग्राम पर ले जाते हैं।"],
    family_impersonation: ["परिवार का सदस्य होने का दावा", "कुछ भी भेजने से पहले परिवार वाले को उनके पुराने नंबर पर फोन करके पूछिए।"],
    ai_manipulation: ["सुरक्षा सिस्टम को बहकाने की कोशिश", "असली कॉल करने वाले कभी किसी एआई से बात नहीं करते। यह धोखे का पक्का संकेत है।"],
  },
  es: {
    authority: ["Se hace pasar por una autoridad", "Un banco, la policía o una empresa de verdad no se molestan si cuelgas y llamas a su número oficial."],
    urgency: ["Te mete prisa", "La presión para decidir en minutos busca que no pienses. Tómate tu tiempo."],
    threat: ["Amenazas y miedo", "Ninguna autoridad real detiene a nadie ni resuelve casos por teléfono o videollamada."],
    isolation: ["Te pide que lo mantengas en secreto", "Quien te pide que no hables con tu familia o tu banco oculta algo. Cuéntaselo a alguien ya."],
    payment: ["Pide un pago inusual", "No existe la 'cuenta segura', y ninguna autoridad real acepta tarjetas regalo ni criptomonedas."],
    credentials: ["Pide un código, PIN o contraseña", "No compartas nunca un código, PIN o contraseña. Nunca hace falta un PIN para recibir dinero."],
    remote_access: ["Quiere acceder a tu dispositivo", "No instales aplicaciones ni compartas tu pantalla porque alguien te lo pida."],
    reward: ["Promete dinero o premios", "Las ganancias garantizadas y los premios que piden pagar antes son siempre estafas."],
    trust_building: ["Busca ganarse tu confianza", "Los desconocidos que piden confianza rápido suelen pedir dinero después."],
    channel_switch: ["Te lleva a otra aplicación", "Los estafadores te llevan a WhatsApp o Telegram para evitar las protecciones."],
    family_impersonation: ["Dice ser un familiar", "Llama a tu familiar al número que ya tienes antes de enviar nada."],
    ai_manipulation: ["Intenta engañar al sistema de seguridad", "Quien llama de verdad nunca se dirige a una IA. Es una señal clara de estafa."],
  },
};

const SCAM_TYPES = {
  hi: {
    "Tech-support / remote-access scam": "टेक-सपोर्ट / रिमोट-एक्सेस धोखा",
    'Government / police impersonation ("digital arrest")': "सरकारी अधिकारी / पुलिस बनकर धोखा (\"डिजिटल अरेस्ट\")",
    "Bank 'safe account' scam": "बैंक 'सुरक्षित खाता' धोखा",
    "Investment / task scam": "निवेश / टास्क धोखा",
    "'Enter your PIN to receive money' scam": "'पैसे पाने के लिए पिन डालें' धोखा",
    "Bank / KYC impersonation (credential theft)": "बैंक / केवाईसी बनकर धोखा (कोड की चोरी)",
    "Remote-access scam": "रिमोट-एक्सेस धोखा",
    "Advance-fee (lottery / refund / job) scam": "पहले फीस वाला धोखा (लॉटरी / रिफंड / नौकरी)",
    "Romance / relationship scam": "प्रेम / रिश्ते के नाम पर धोखा",
    "Gift-card payment scam": "गिफ्ट-कार्ड पेमेंट धोखा",
    "Family-emergency impersonation ('Hi Mum' / grandparent) scam": "परिवार की इमरजेंसी के नाम पर धोखा",
    "Online marketplace buyer/seller scam": "ऑनलाइन खरीद-बिक्री (OLX) धोखा",
  },
  es: {
    "Tech-support / remote-access scam": "Estafa de soporte técnico / acceso remoto",
    'Government / police impersonation ("digital arrest")': "Suplantación de policía o autoridad (\"arresto digital\")",
    "Bank 'safe account' scam": "Estafa de la 'cuenta segura' del banco",
    "Investment / task scam": "Estafa de inversión / tareas",
    "'Enter your PIN to receive money' scam": "Estafa de 'introduce tu PIN para recibir dinero'",
    "Bank / KYC impersonation (credential theft)": "Suplantación del banco (robo de claves)",
    "Remote-access scam": "Estafa de acceso remoto",
    "Advance-fee (lottery / refund / job) scam": "Estafa de pago por adelantado (lotería / reembolso / empleo)",
    "Romance / relationship scam": "Estafa romántica",
    "Gift-card payment scam": "Estafa de pago con tarjetas regalo",
    "Family-emergency impersonation ('Hi Mum' / grandparent) scam": "Estafa del familiar en apuros ('Hola mamá')",
    "Online marketplace buyer/seller scam": "Estafa de compraventa online",
  },
};

export function tacticText(lang, t) {
  const tr = TACTICS[lang]?.[t.tactic];
  return tr ? { label: tr[0], advice: tr[1] } : { label: t.label, advice: t.advice };
}

export function scamTypeText(lang, s) {
  return (s && SCAM_TYPES[lang]?.[s]) || s;
}
