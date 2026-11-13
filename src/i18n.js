// UI text in English, Hindi and Spanish. The intervention screen is the one that
// must be understood instantly by a frightened person, so it is fully translated.
import { createContext, useContext } from "react";
import { APP } from "./i18n_app.js";

const T = {
  en: {
    nav_shield: "Shield", nav_check: "Check", nav_guardian: "Guardian", nav_intel: "Intel", nav_results: "Results",
    protect_title: "Protect a call or chat",
    protect_sub: "SecondThought spots manipulation tactics and pauses you before money moves.",
    play_sim: "Play a simulated scam call", listen: "Listen on speakerphone", paste_chat: "Check a chat as it happens",
    choose_scenario: "Scenario", start: "Start", stop: "Stop", end: "End", pause: "Pause", resume: "Resume",
    level_safe: "Safe", level_caution: "Caution", level_high: "High risk", level_critical: "Critical",
    why: "Why", conversation: "Conversation", details_given: "Details they gave you",
    seen_in_reports: "seen in earlier scam reports",
    i_know: "I know this person", hand_over: "Hand over to SecondThought", make_payment: "Make a payment", end_report: "End & report",
    they_said: "They said", i_said: "I said", send: "Send",
    stop_title: "Stop. This looks like a scam.",
    stop_sub: "Don't send money, share codes or install anything. Take a breath.",
    reasons: "What we noticed",
    hang_up: "Hang up now", call_guardian: "Call {name}", continue_in: "Continue anyway ({s}s)", continue_anyway: "Continue anyway",
    guardian_alerted: "{name} has been alerted.", guardian_none: "No family member linked yet.",
    real_check: "A real bank, police officer or family member will never mind if you hang up and call them back on a number you already have.",
    link_guardian: "Link a family member", guardian_linked_to: "Linked to {name}",
    cooling_title: "Wait before you pay", cooling_sub: "This payment looks risky. Take a moment.",
    cancel_payment: "Cancel payment", pay_anyway: "Pay anyway",
    intel_line: "this detail appears in {n} earlier scam report(s).",
    consent_title: "Before you listen",
    consent_audio: "Your browser's speech service turns the call audio into text. In Chrome this audio is processed by Google's speech servers. SecondThought itself never receives or stores audio.",
    consent_text: "The text is sent to SecondThought over an encrypted connection and analysed in memory. Codes, card, Aadhaar and PAN numbers and your own phone number, UPI ID and account are masked as soon as they arrive. The conversation is never saved (only the scammer's details, and only if you choose to share them), and tapping End deletes it.",
    consent_guardian: "Your family member only ever sees the warning, never the conversation.",
    consent_other: "Tell the other person that the call is being checked for scams. In some places everyone on a call must agree before it is analysed.",
    consent_agree: "I understand, and I'm allowed to analyse this call",
    consent_start: "Start listening",
    chat_privacy: "Messages are analysed in memory on the SecondThought server and never saved. Codes and card numbers are masked.",
  },
  hi: {
    nav_shield: "सुरक्षा", nav_check: "जाँचें", nav_guardian: "अभिभावक", nav_intel: "जानकारी", nav_results: "नतीजे",
    protect_title: "कॉल या चैट को सुरक्षित करें",
    protect_sub: "SecondThought धोखे की चालें पहचानता है और पैसे जाने से पहले आपको रोकता है।",
    play_sim: "नकली स्कैम कॉल चलाएँ", listen: "स्पीकरफोन पर सुनें", paste_chat: "चैट को साथ-साथ जाँचें",
    choose_scenario: "उदाहरण", start: "शुरू करें", stop: "रोकें", end: "खत्म करें", pause: "रोकें", resume: "जारी रखें",
    level_safe: "सुरक्षित", level_caution: "सावधान", level_high: "उच्च खतरा", level_critical: "गंभीर खतरा",
    why: "क्यों", conversation: "बातचीत", details_given: "उन्होंने जो जानकारी दी",
    seen_in_reports: "पहले की स्कैम शिकायतों में मिला",
    i_know: "मैं इन्हें जानता/जानती हूँ", hand_over: "SecondThought को सौंपें", make_payment: "पेमेंट करें", end_report: "खत्म करें और शिकायत करें",
    they_said: "उन्होंने कहा", i_said: "मैंने कहा", send: "भेजें",
    stop_title: "रुकिए। यह धोखा लगता है।",
    stop_sub: "पैसे न भेजें, कोई कोड न बताएँ, कोई ऐप इंस्टॉल न करें। एक गहरी साँस लीजिए।",
    reasons: "हमने क्या देखा",
    hang_up: "अभी फोन काटें", call_guardian: "{name} को फोन करें", continue_in: "फिर भी जारी रखें ({s} सेकंड)", continue_anyway: "फिर भी जारी रखें",
    guardian_alerted: "{name} को सूचना भेज दी गई है।", guardian_none: "अभी कोई परिवार का सदस्य जुड़ा नहीं है।",
    real_check: "असली बैंक, पुलिस या परिवार वाले बुरा नहीं मानेंगे अगर आप फोन काटकर उन्हें उस नंबर पर वापस फोन करें जो आपके पास पहले से है।",
    link_guardian: "परिवार के सदस्य को जोड़ें", guardian_linked_to: "{name} से जुड़ा है",
    cooling_title: "पेमेंट से पहले रुकिए", cooling_sub: "यह पेमेंट जोखिम भरा लगता है। एक पल सोचिए।",
    cancel_payment: "पेमेंट रद्द करें", pay_anyway: "फिर भी पेमेंट करें",
    intel_line: "यह जानकारी पहले की {n} स्कैम शिकायतों में मिली है।",
    consent_title: "सुनना शुरू करने से पहले",
    consent_audio: "आपके ब्राउज़र की स्पीच सेवा कॉल की आवाज़ को टेक्स्ट में बदलती है। Chrome में यह आवाज़ Google के सर्वर पर प्रोसेस होती है। SecondThought खुद कभी आवाज़ न लेता है, न रखता है।",
    consent_text: "टेक्स्ट एन्क्रिप्टेड कनेक्शन से SecondThought को भेजा जाता है और सिर्फ़ मेमोरी में जाँचा जाता है। ओटीपी, कार्ड, आधार, पैन और आपका अपना नंबर, यूपीआई और खाता पहुँचते ही छिपा दिए जाते हैं। बातचीत कभी सेव नहीं होती (सिर्फ़ धोखेबाज़ की जानकारी, और वह भी तभी जब आप शेयर करना चुनें), और खत्म करें दबाने पर मिट जाती है।",
    consent_guardian: "आपके परिवार वाले को सिर्फ़ चेतावनी दिखती है, बातचीत कभी नहीं।",
    consent_other: "सामने वाले को बता दें कि कॉल की धोखे के लिए जाँच हो रही है। कुछ जगहों पर कॉल की जाँच से पहले सभी की सहमति ज़रूरी है।",
    consent_agree: "मैं समझता/समझती हूँ, और मुझे इस कॉल की जाँच करने की अनुमति है",
    consent_start: "सुनना शुरू करें",
    chat_privacy: "संदेश SecondThought सर्वर की मेमोरी में जाँचे जाते हैं और कभी सेव नहीं होते। कोड और कार्ड नंबर छिपा दिए जाते हैं।",
  },
  es: {
    nav_shield: "Escudo", nav_check: "Comprobar", nav_guardian: "Familiar", nav_intel: "Redes", nav_results: "Resultados",
    protect_title: "Protege una llamada o un chat",
    protect_sub: "SecondThought detecta tácticas de manipulación y te frena antes de que se mueva el dinero.",
    play_sim: "Reproducir una llamada de estafa simulada", listen: "Escuchar en altavoz", paste_chat: "Revisar un chat en directo",
    choose_scenario: "Escenario", start: "Empezar", stop: "Parar", end: "Terminar", pause: "Pausa", resume: "Seguir",
    level_safe: "Seguro", level_caution: "Precaución", level_high: "Riesgo alto", level_critical: "Crítico",
    why: "Por qué", conversation: "Conversación", details_given: "Datos que te han dado",
    seen_in_reports: "aparece en denuncias anteriores",
    i_know: "Conozco a esta persona", hand_over: "Pasar a SecondThought", make_payment: "Hacer un pago", end_report: "Terminar y denunciar",
    they_said: "Han dicho", i_said: "He dicho", send: "Enviar",
    stop_title: "Para. Esto parece una estafa.",
    stop_sub: "No envíes dinero, no compartas códigos ni instales nada. Respira.",
    reasons: "Lo que hemos visto",
    hang_up: "Cuelga ahora", call_guardian: "Llamar a {name}", continue_in: "Seguir de todos modos ({s} s)", continue_anyway: "Seguir de todos modos",
    guardian_alerted: "Hemos avisado a {name}.", guardian_none: "Aún no hay ningún familiar vinculado.",
    real_check: "Un banco, un policía o un familiar de verdad no se molestará si cuelgas y le llamas a un número que ya tienes.",
    link_guardian: "Vincular a un familiar", guardian_linked_to: "Vinculado con {name}",
    cooling_title: "Espera antes de pagar", cooling_sub: "Este pago parece arriesgado. Tómate un momento.",
    cancel_payment: "Cancelar el pago", pay_anyway: "Pagar de todos modos",
    intel_line: "este dato aparece en {n} denuncias de estafa anteriores.",
    consent_title: "Antes de escuchar",
    consent_audio: "El servicio de voz de tu navegador convierte el audio de la llamada en texto. En Chrome, ese audio lo procesan los servidores de voz de Google. SecondThought nunca recibe ni guarda audio.",
    consent_text: "El texto se envía a SecondThought por una conexión cifrada y se analiza en memoria. Los códigos, tarjetas, documentos y tu propio teléfono, Bizum/UPI y cuenta se ocultan en cuanto llegan. La conversación nunca se guarda (solo los datos del estafador, y solo si decides compartirlos) y al pulsar Terminar se borra.",
    consent_guardian: "Tu familiar solo ve el aviso, nunca la conversación.",
    consent_other: "Avisa a la otra persona de que la llamada se está revisando contra estafas. En algunos lugares todos deben estar de acuerdo antes de analizar una llamada.",
    consent_agree: "Lo entiendo y puedo analizar esta llamada",
    consent_start: "Empezar a escuchar",
    chat_privacy: "Los mensajes se analizan en la memoria del servidor de SecondThought y nunca se guardan. Los códigos y números de tarjeta se ocultan.",
  },
};

for (const l of Object.keys(APP)) Object.assign(T[l], APP[l]);

export const LANGS = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "es", label: "Español" },
];

export const LangContext = createContext("en");

export function translate(lang, key, vars = {}) {
  const s = (T[lang] && T[lang][key]) || T.en[key] || key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

export function useT() {
  const lang = useContext(LangContext);
  return (key, vars) => translate(lang, key, vars);
}
