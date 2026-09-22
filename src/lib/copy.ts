import type { Locale, LocalizedText } from "@/lib/types";

export const languageNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  gu: "ગુજરાતી",
};

export const languageNativeLabels: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी + English",
  gu: "ગુજરાતી + English",
};

export function text(value: LocalizedText, locale: Locale) {
  return value[locale] || value.en;
}

export const siteCopy = {
  navCta: {
    en: "Get my free plan",
    hi: "अपना free plan पाएँ",
    gu: "મારો free plan મેળવો",
  },
  mainWebsite: {
    en: "Visit our main website",
    hi: "Main website देखें",
    gu: "Main website જુઓ",
  },
  websiteShort: {
    en: "Website",
    hi: "Website",
    gu: "Website",
  },
  eyebrow: {
    en: "SURAT-BASED GROWTH TEAM",
    hi: "सूरत की बिज़नेस ग्रोथ टीम",
    gu: "બિઝનેસ વધારતી સુરતની ટીમ",
  },
  headlineTop: {
    en: "Want more customers",
    hi: "अपने बिज़नेस के लिए ज़्यादा",
    gu: "તમારા બિઝનેસ માટે વધુ",
  },
  headlineAccent: {
    en: "for your business?",
    hi: "ग्राहक चाहिए?",
    gu: "ગ્રાહકો જોઈએ છે?",
  },
  heroBody: {
    en: "Tell us what your business needs. We’ll suggest a clear next step for ads, Google visibility, product photos & videos, or an online store.",
    hi: "बस हमें बताइए कि आपके बिज़नेस को क्या चाहिए। Ads, Google पर पहचान, product photos/videos या online store के लिए हम आसान अगला कदम बताएँगे।",
    gu: "તમારા બિઝનેસને અત્યારે શાની જરૂર છે તે જણાવો. Ads, Google પર દેખાવ, product photos/videos કે online shop માટે અમે આગળનું સરળ પગલું સૂચવીશું.",
  },
  primaryCta: {
    en: "Start 2-minute check",
    hi: "2 मिनट की जाँच शुरू करें",
    gu: "2 મિનિટમાં શરૂ કરો",
  },
  whatsappCta: {
    en: "WhatsApp us",
    hi: "WhatsApp करें",
    gu: "WhatsApp કરો",
  },
  noJargon: {
    en: "No confusing jargon",
    hi: "मुश्किल शब्दों की उलझन नहीं",
    gu: "મુશ્કેલ technical શબ્દો નહીં",
  },
  freeCall: {
    en: "Free first conversation",
    hi: "पहली बातचीत free",
    gu: "પહેલી વાતચીત free",
  },
  localTeam: {
    en: "A real local team",
    hi: "सूरत की अपनी team",
    gu: "સુરતની પોતાની ટીમ",
  },
  languageAvailability: {
    en: "available",
    hi: "में बात कर सकते हैं",
    gu: "માં વાત કરી શકો છો",
  },
  formKicker: {
    en: "YOUR 2-MINUTE BUSINESS CHECK",
    hi: "आपके बिज़नेस की 2 मिनट की जाँच",
    gu: "2 મિનિટમાં તમારા બિઝનેસની માહિતી",
  },
  formTitle: {
    en: "Let’s understand your business.",
    hi: "आइए, आपके बिज़नेस को समझें।",
    gu: "ચાલો, તમારા બિઝનેસને સમજીએ.",
  },
  formIntro: {
    en: "One easy question at a time. No technical knowledge needed.",
    hi: "एक बार में एक आसान सवाल। Technical जानकारी की ज़रूरत नहीं।",
    gu: "એક સમયે એક સરળ સવાલ. કોઈ technical જાણકારી જરૂરી નથી.",
  },
  start: { en: "Start now", hi: "अभी शुरू करें", gu: "હમણાં શરૂ કરો" },
  back: { en: "Back", hi: "पीछे", gu: "પાછળ" },
  next: { en: "Continue", hi: "आगे बढ़ें", gu: "આગળ વધો" },
  submit: {
    en: "Send my details",
    hi: "मेरी details भेजें",
    gu: "મારી માહિતી મોકલો",
  },
  saving: { en: "Saving...", hi: "Save हो रहा है...", gu: "Save થઈ રહ્યું છે..." },
  optional: { en: "Optional", hi: "ज़रूरी नहीं", gu: "ફરજિયાત નથી" },
  selectAll: {
    en: "Choose all that apply",
    hi: "जो सही लगें, वे सभी चुनें",
    gu: "જે લાગુ પડે તે બધું પસંદ કરો",
  },
  requiredError: {
    en: "Please answer this to continue.",
    hi: "आगे बढ़ने के लिए जवाब चुनें।",
    gu: "આગળ વધવા માટે આ સવાલનો જવાબ આપો.",
  },
  consent: {
    en: "I agree that Global Surat may call or WhatsApp me about my enquiry. No spam.",
    hi: "मैं सहमत हूँ कि Global Surat मेरी enquiry के बारे में मुझसे call या WhatsApp पर संपर्क कर सकता है। कोई spam नहीं।",
    gu: "મારી enquiry માટે Global Surat મને call અથવા WhatsApp કરે તે માટે હું મંજૂરી આપું છું. કોઈ spam નહીં.",
  },
  consentError: {
    en: "Please allow us to contact you.",
    hi: "कृपया हमें संपर्क करने की अनुमति दें।",
    gu: "કૃપા કરીને અમને સંપર્ક કરવાની મંજૂરી આપો.",
  },
  successKicker: { en: "DONE / COMPLETE", hi: "पूरा हुआ", gu: "પૂર્ણ થયું" },
  successTitle: {
    en: "Thank you, we’ve got it!",
    hi: "धन्यवाद, आपकी details मिल गईं!",
    gu: "આભાર, તમારી માહિતી મળી ગઈ!",
  },
  successBody: {
    en: "Our Surat team will review your answers and contact you shortly with a simple next step.",
    hi: "हमारी सूरत team आपके जवाब देखेगी और आसान अगले कदम के साथ जल्द आपसे संपर्क करेगी।",
    gu: "અમારી સુરતની ટીમ તમારા જવાબો જોઈને ટૂંક સમયમાં call કરશે અને આગળનું સરળ પગલું સમજાવશે.",
  },
  humanFollowUp: {
    en: "Human follow-up",
    hi: "Team जल्द संपर्क करेगी",
    gu: "Team જલ્દી સંપર્ક કરશે",
  },
  detailsPrivate: {
    en: "Your details stay private",
    hi: "आपकी details सुरक्षित रहेंगी",
    gu: "તમારી details સુરક્ષિત રહેશે",
  },
  formUnavailable: {
    en: "The questionnaire is temporarily unavailable.",
    hi: "सवाल अभी उपलब्ध नहीं हैं। कृपया थोड़ी देर बाद कोशिश करें।",
    gu: "સવાલો હમણાં ઉપલબ્ધ નથી. કૃપા કરીને થોડી વાર પછી ફરી પ્રયાસ કરો.",
  },
  saveError: {
    en: "We could not save your details. Please try again.",
    hi: "आपकी details save नहीं हो सकीं। कृपया फिर कोशिश करें।",
    gu: "તમારી details save થઈ શકી નથી. કૃપા કરીને ફરી પ્રયાસ કરો.",
  },
  connectError: {
    en: "We could not connect. Please check your internet and try again.",
    hi: "Connection नहीं हो सका। Internet जाँचकर फिर कोशिश करें।",
    gu: "Connection થઈ શક્યું નથી. Internet તપાસીને ફરી પ્રયાસ કરો.",
  },
  privacyNote: {
    en: "Private & secure. Your details are never sold.",
    hi: "आपकी details सुरक्षित हैं। उन्हें कभी बेचा नहीं जाता।",
    gu: "તમારી details સુરક્ષિત છે. તે ક્યારેય વેચાતી નથી.",
  },
  servicesEyebrow: {
    en: "WHAT WE CAN HELP WITH",
    hi: "हम आपकी कैसे मदद कर सकते हैं",
    gu: "અમે કેવી રીતે મદદ કરી શકીએ",
  },
  servicesTitle: {
    en: "You tell us the problem. We handle the technical part.",
    hi: "आप अपनी परेशानी बताएँ। Technical काम हम सँभालेंगे।",
    gu: "તમારે શું જોઈએ છે તે કહો. Technical કામ અમે સંભાળીશું.",
  },
  servicesIntro: {
    en: "Simple outcomes first. The right tools come after we understand your business.",
    hi: "पहले आसान नतीजे। सही tools हम आपका बिज़नेस समझने के बाद चुनेंगे।",
    gu: "પહેલા સરળ પરિણામ. સાચા tools અમે તમારો બિઝનેસ સમજ્યા પછી પસંદ કરીશું.",
  },
  teamEyebrow: {
    en: "LOCAL. HUMAN. ACCOUNTABLE.",
    hi: "LOCAL TEAM. अपनी भाषा. पूरी जिम्मेदारी.",
    gu: "LOCAL TEAM. આપણી ભાષા. પૂરી જવાબદારી.",
  },
  teamTitle: {
    en: "A team you can actually talk to.",
    hi: "ऐसी team जो सच में आपकी बात समझे।",
    gu: "એવી ટીમ, જેની સાથે તમે સીધી વાત કરી શકો.",
  },
  teamBody: {
    en: "We’re based in Surat and work with businesses in clear, everyday language, from the first call to the final launch.",
    hi: "हम सूरत की team हैं। पहली call से final launch तक आपके साथ आसान भाषा में काम करते हैं।",
    gu: "અમે સુરતમાં છીએ અને પહેલી callથી કામ પૂરું થાય ત્યાં સુધી તમારી સાથે સરળ ભાષામાં વાત કરીએ છીએ.",
  },
  teamPhotoLabel: { en: "OUR TEAM", hi: "हमारी TEAM", gu: "અમારી TEAM" },
  processEyebrow: { en: "HOW IT WORKS", hi: "काम कैसे होगा", gu: "કામ કેવી રીતે થશે" },
  processTitle: {
    en: "Simple from day one.",
    hi: "पहले दिन से सब आसान।",
    gu: "શરૂઆતથી જ સરળ.",
  },
  faqEyebrow: { en: "GOOD TO KNOW", hi: "जानना अच्छा है", gu: "જાણવું સારું છે" },
  faqTitle: {
    en: "Simple answers before we talk.",
    hi: "बात करने से पहले आसान जवाब।",
    gu: "વાત કરતાં પહેલાં સરળ જવાબો.",
  },
  finalEyebrow: {
    en: "NO PRESSURE. JUST A CLEAR NEXT STEP.",
    hi: "कोई दबाव नहीं। बस साफ़ अगला कदम।",
    gu: "કોઈ દબાણ નહીં. ફક્ત સ્પષ્ટ આગળનું પગલું.",
  },
  finalTitle: {
    en: "Ready to find your next growth step?",
    hi: "बिज़नेस बढ़ाने का अगला कदम जानने के लिए तैयार हैं?",
    gu: "બિઝનેસ વધારવાનું આગળનું પગલું જાણવા તૈયાર છો?",
  },
  footerBody: {
    en: "Simple growth support for ambitious businesses.",
    hi: "आगे बढ़ना चाहने वाले बिज़नेस के लिए आसान growth support.",
    gu: "આગળ વધવા માંગતા બિઝનેસ માટે સરળ growth support.",
  },
} satisfies Record<string, LocalizedText>;

export const marqueeItems = [
  { en: "MORE ENQUIRIES", hi: "ज़्यादा ENQUIRIES", gu: "વધુ ENQUIRIES" },
  { en: "ONLINE SALES", hi: "ज़्यादा ONLINE SALES", gu: "વધુ ONLINE SALES" },
  { en: "BETTER CREATIVE", hi: "बेहतर CREATIVE", gu: "વધુ સારું CREATIVE" },
  { en: "SHOPIFY STORES", hi: "SHOPIFY STORE", gu: "SHOPIFY STORE" },
  { en: "GOOGLE VISIBILITY", hi: "GOOGLE पर पहचान", gu: "GOOGLE પર ઓળખ" },
] satisfies LocalizedText[];

export const services = [
  {
    number: "01",
    title: {
      en: "Get more calls & enquiries",
      hi: "ज़्यादा calls और enquiries पाएँ",
      gu: "વધુ calls અને enquiries મેળવો",
    },
    body: {
      en: "We show clear Facebook and Instagram ads to people most likely to contact you.",
      hi: "हम Facebook और Instagram पर सही लोगों को Ads दिखाकर calls और WhatsApp enquiries बढ़ाते हैं।",
      gu: "Facebook અને Instagram પર યોગ્ય લોકોને Ads બતાવી વધુ calls અને WhatsApp enquiries મેળવવામાં મદદ કરીએ છીએ.",
    },
    technical: "Lead generation · Meta ads",
  },
  {
    number: "02",
    title: {
      en: "Sell more products online",
      hi: "Online ज़्यादा products बेचें",
      gu: "Online વધુ products વેચો",
    },
    body: {
      en: "We improve your ads and online-shop journey so more visitors become buyers.",
      hi: "हम Ads और online shop को बेहतर बनाते हैं, ताकि ज़्यादा visitors ग्राहक बनें।",
      gu: "અમે તમારા Ads અને online shopમાં ખરીદી કરવાની રીત સરળ બનાવીએ છીએ, જેથી વધુ લોકો ખરીદી કરે.",
    },
    technical: "D2C performance marketing",
  },
  {
    number: "03",
    title: {
      en: "Make products look premium",
      hi: "अपने products को premium दिखाएँ",
      gu: "Products ને premium દેખાડો",
    },
    body: {
      en: "Social posts, product-page photos, UGC-style videos and product showcase videos.",
      hi: "हम social posts, product-page photos, UGC-style videos और product showcase videos बनाते हैं।",
      gu: "Social media posts, product-page photos, UGC videos અને product showcase videos બનાવીએ છીએ.",
    },
    technical: "AI creative production",
  },
  {
    number: "04",
    title: {
      en: "Open or improve your online shop",
      hi: "Online shop बनाएँ या बेहतर करें",
      gu: "Online shop બનાવો અથવા સુધારો",
    },
    body: {
      en: "A fast, easy-to-use Shopify store that helps customers buy without confusion.",
      hi: "तेज़ और आसान Shopify store, जहाँ ग्राहक बिना उलझन के खरीदारी कर सकें।",
      gu: "ઝડપી અને સરળ Shopify Website, જ્યાં ગ્રાહક ગૂંચવાયા વગર ખરીદી કરી શકે.",
    },
    technical: "Shopify web development",
  },
  {
    number: "05",
    title: {
      en: "Show up higher on Google",
      hi: "Google पर ऊपर दिखें",
      gu: "Google પર ઉપર દેખાઓ",
    },
    body: {
      en: "We make it easier for nearby and relevant customers to find your business.",
      hi: "हम आपके बिज़नेस को आस-पास के सही ग्राहकों के लिए ढूँढना आसान बनाते हैं।",
      gu: "નજીકના યોગ્ય ગ્રાહકો Google પર તમારો બિઝનેસ સરળતાથી શોધી શકે તે માટે મદદ કરીએ છીએ.",
    },
    technical: "SEO",
  },
] as const;

export const processSteps = [
  {
    number: "01",
    title: { en: "Tell us", hi: "हमें बताएँ", gu: "અમને જણાવો" },
    body: {
      en: "Answer a few easy questions about your business.",
      hi: "अपने बिज़नेस के बारे में कुछ आसान सवालों के जवाब दें।",
      gu: "તમારા બિઝનેસ વિશે થોડા સરળ સવાલોના જવાબ આપો.",
    },
  },
  {
    number: "02",
    title: { en: "We review", hi: "हम समझेंगे", gu: "અમે સમજશું" },
    body: {
      en: "A real strategist looks at your needs, not a bot.",
      hi: "हमारी team आपकी ज़रूरत समझेगी, कोई bot नहीं।",
      gu: "અમારી ટીમ જાતે તમારા જવાબો જોશે, કોઈ bot નહીં.",
    },
  },
  {
    number: "03",
    title: { en: "Clear next step", hi: "साफ़ अगला कदम", gu: "આગળનું સ્પષ્ટ પગલું" },
    body: {
      en: "We call with a practical suggestion and no pressure.",
      hi: "हम उपयोगी सुझाव के साथ call करेंगे, कोई दबाव नहीं।",
      gu: "અમે ઉપયોગી સલાહ સાથે call કરીશું, કોઈ દબાણ નહીં.",
    },
  },
] as const;
