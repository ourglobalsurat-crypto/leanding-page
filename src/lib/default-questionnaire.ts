import type { PublicQuestion, PublicQuestionnaire } from "@/lib/types";

export const defaultQuestions: PublicQuestion[] = [
  {
    id: "growth-path",
    key: "growth_path",
    type: "single_choice",
    label: {
      en: "What would you like help with?",
      hi: "आपको किस काम में मदद चाहिए?",
      gu: "તમને કઈ બાબતમાં મદદ જોઈએ છે?",
    },
    helpText: {
      en: "Choose one. We’ll show only the questions relevant to you.",
      hi: "एक विकल्प चुनें। आगे सिर्फ़ आपसे जुड़े सवाल दिखेंगे।",
      gu: "એક વિકલ્પ પસંદ કરો. આગળ ફક્ત તમારા કામને લગતા પ્રશ્નો દેખાશે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 1,
    options: [
      {
        id: "lead_generation",
        label: {
          en: "Get more enquiries",
          hi: "ज़्यादा enquiries पाना",
          gu: "વધુ enquiries મેળવવી",
        },
        description: {
          en: "Lead Generation: for service, local and B2B businesses",
          hi: "Lead Generation: service, local और B2B businesses के लिए",
          gu: "Lead Generation: service, local અને B2B businesses માટે",
        },
      },
      {
        id: "d2c_growth",
        label: {
          en: "Grow online product sales",
          hi: "Online product sales बढ़ाना",
          gu: "Online product sales વધારવી",
        },
        description: {
          en: "D2C Growth: for brands selling through a website or online store",
          hi: "D2C Growth: Website या online store से products बेचने वाले brands के लिए",
          gu: "D2C Growth: Website અથવા online store દ્વારા products વેચતી brands માટે",
        },
      },
      {
        id: "seo",
        label: {
          en: "Rank higher on Google",
          hi: "Google पर ऊपर आना",
          gu: "Google પર ઉપર આવવું",
        },
        description: {
          en: "SEO: for businesses that want steady customers from Google search",
          hi: "SEO: Google search से लगातार ग्राहक चाहने वाले businesses के लिए",
          gu: "SEO: Google search દ્વારા સતત ગ્રાહકો મેળવવા માંગતા businesses માટે",
        },
      },
    ],
    config: { systemRole: "flow_selector" },
    isActive: true,
  },
  {
    id: "lead-business-model",
    key: "lead_business_model",
    type: "single_choice",
    label: {
      en: "What type of business do you operate?",
      hi: "आप किस प्रकार का business चलाते हैं?",
      gu: "તમે કયા પ્રકારનો business ચલાવો છો?",
    },
    helpText: {
      en: "Choose who you mainly sell your products or services to.",
      hi: "आप मुख्य रूप से अपने products या services किसे बेचते हैं, वह चुनें।",
      gu: "તમે મુખ્યત્વે તમારા products અથવા services કોને વેચો છો તે પસંદ કરો.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 2,
    options: [
      {
        id: "b2b",
        label: { en: "B2B", hi: "B2B", gu: "B2B" },
        description: {
          en: "Other businesses or companies",
          hi: "दूसरे businesses या companies को",
          gu: "બીજા businesses અથવા companiesને",
        },
      },
      {
        id: "b2c",
        label: { en: "B2C", hi: "B2C", gu: "B2C" },
        description: {
          en: "Individual customers directly",
          hi: "सीधे ग्राहकों को",
          gu: "સીધા ગ્રાહકોને",
        },
      },
      {
        id: "both",
        label: {
          en: "Both B2B and B2C",
          hi: "B2B और B2C दोनों",
          gu: "B2B અને B2C બંને",
        },
        description: {
          en: "Businesses and individual customers",
          hi: "Businesses और सीधे ग्राहक, दोनों",
          gu: "Businesses અને સીધા ગ્રાહકો, બંને",
        },
      },
    ],
    config: { flow: "lead_generation" },
    isActive: true,
  },
  {
    id: "lead-target-location",
    key: "lead_target_location",
    type: "single_choice",
    label: {
      en: "Which location do you want to target for lead generation?",
      hi: "Lead generation के लिए आप किस जगह को target करना चाहते हैं?",
      gu: "Lead generation માટે તમે કયા વિસ્તારને target કરવા માંગો છો?",
    },
    helpText: {
      en: "If you want to target more than one area, choose Multiple locations.",
      hi: "एक से ज़्यादा area चाहिए तो Multiple locations चुनें।",
      gu: "એકથી વધુ વિસ્તાર target કરવો હોય તો Multiple locations પસંદ કરો.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 3,
    options: [
      {
        id: "local_city",
        label: { en: "Local City", hi: "सिर्फ़ अपना शहर", gu: "ફક્ત તમારું શહેર" },
      },
      {
        id: "gujarat",
        label: { en: "Gujarat", hi: "पूरा गुजरात", gu: "આખું ગુજરાત" },
      },
      {
        id: "pan_india",
        label: { en: "Pan India", hi: "पूरा भारत / Pan India", gu: "સમગ્ર ભારત / Pan India" },
      },
      {
        id: "international",
        label: { en: "International", hi: "भारत के बाहर / International", gu: "ભારત બહાર / International" },
      },
      {
        id: "multiple_locations",
        label: {
          en: "Multiple Locations",
          hi: "एक से ज़्यादा शहर / area",
          gu: "એકથી વધુ શહેર / વિસ્તાર",
        },
      },
    ],
    config: { flow: "lead_generation" },
    isActive: true,
  },
  {
    id: "lead-campaign-experience",
    key: "lead_campaign_experience",
    type: "single_choice",
    label: {
      en: "Have you run lead-generation campaigns before?",
      hi: "क्या आपने पहले leads पाने के लिए Ads चलाए हैं?",
      gu: "શું તમે પહેલાં leads મેળવવા માટે Ads ચલાવી છે?",
    },
    helpText: {
      en: "Choose the option that best matches your experience.",
      hi: "जो आपके experience से सबसे सही मिले, उसे चुनें।",
      gu: "તમારા experience સાથે સૌથી યોગ્ય વિકલ્પ પસંદ કરો.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 4,
    options: [
      {
        id: "first_time",
        label: {
          en: "No, this is my first time",
          hi: "नहीं, यह मेरी पहली बार है",
          gu: "ના, આ મારી પહેલી વાર છે",
        },
      },
      {
        id: "internal",
        label: {
          en: "Yes, managed internally",
          hi: "हाँ, हमारी अपनी team ने manage किया",
          gu: "હા, અમારી પોતાની teamએ manage કરી છે",
        },
      },
      {
        id: "freelancer",
        label: {
          en: "Yes, worked with a freelancer",
          hi: "हाँ, freelancer के साथ काम किया",
          gu: "હા, freelancer સાથે કામ કર્યું છે",
        },
      },
      {
        id: "agency",
        label: {
          en: "Yes, worked with an agency",
          hi: "हाँ, agency के साथ काम किया",
          gu: "હા, agency સાથે કામ કર્યું છે",
        },
      },
      {
        id: "scaling",
        label: {
          en: "Currently running campaigns and want to scale",
          hi: "Campaigns अभी चल रहे हैं, अब उन्हें scale करना है",
          gu: "Campaigns હાલમાં ચાલી રહી છે, હવે scale કરવી છે",
        },
      },
    ],
    config: { flow: "lead_generation" },
    isActive: true,
  },
  {
    id: "d2c-website",
    key: "website_url",
    type: "short_text",
    label: {
      en: "Share your website or online store link.",
      hi: "अपनी Website या online store का link शेयर करें।",
      gu: "તમારી Website અથવા online storeની link શેર કરો.",
    },
    helpText: {
      en: "If your store is not live yet, enter ‘Not launched yet’.",
      hi: "अगर store अभी live नहीं है, तो ‘अभी launch नहीं हुआ’ लिखें।",
      gu: "જો store હજી live નથી, તો ‘હજી launch થયું નથી’ લખો.",
    },
    placeholder: {
      en: "yourstore.com or Not launched yet",
      hi: "yourstore.com या अभी launch नहीं हुआ",
      gu: "yourstore.com અથવા હજી launch થયું નથી",
    },
    required: true,
    position: 5,
    options: [],
    config: { flow: "d2c_growth", maxLength: 500 },
    isActive: true,
  },
  {
    id: "d2c-monthly-revenue",
    key: "monthly_online_revenue",
    type: "single_choice",
    label: {
      en: "What is your current average monthly online revenue?",
      hi: "हर महीने आपकी औसत online sales कितनी हैं?",
      gu: "દર મહિને તમારી સરેરાશ online sales કેટલી છે?",
    },
    helpText: {
      en: "An estimate is fine.",
      hi: "लगभग रकम चुनना ठीक है।",
      gu: "અંદાજિત રકમ પસંદ કરશો તો પણ ચાલશે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 6,
    options: [
      {
        id: "pre_launch",
        label: {
          en: "Pre-launch / New Brand",
          hi: "Brand अभी launch नहीं हुआ / नया brand",
          gu: "Brand હજી launch નથી થઈ / નવી brand",
        },
      },
      {
        id: "below_1l",
        label: { en: "Below ₹1 lakh", hi: "₹1 लाख से कम", gu: "₹1 લાખથી ઓછું" },
      },
      {
        id: "1l_5l",
        label: { en: "₹1–5 lakh", hi: "₹1–5 लाख", gu: "₹1–5 લાખ" },
      },
      {
        id: "5l_15l",
        label: { en: "₹5–15 lakh", hi: "₹5–15 लाख", gu: "₹5–15 લાખ" },
      },
      {
        id: "above_15l",
        label: { en: "Above ₹15 lakh", hi: "₹15 लाख से ज़्यादा", gu: "₹15 લાખથી વધુ" },
      },
    ],
    config: { flow: "d2c_growth" },
    isActive: true,
  },
  {
    id: "d2c-monthly-ad-budget",
    key: "monthly_ad_budget",
    type: "single_choice",
    label: {
      en: "What is your current or planned monthly ad budget?",
      hi: "हर महीने Ads के लिए आपका मौजूदा या planned budget कितना है?",
      gu: "દર મહિને Ads માટે તમારું હાલનું અથવા planned budget કેટલું છે?",
    },
    helpText: {
      en: "Only include the amount spent on ads. Agency fees are not included.",
      hi: "सिर्फ़ Ads पर खर्च होने वाली रकम चुनें। Agency fees इसमें शामिल नहीं हैं।",
      gu: "ફક્ત Ads પર ખર્ચ થતી રકમ પસંદ કરો. Agency fees તેમાં સામેલ નથી.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 7,
    options: [
      {
        id: "below_50k",
        label: { en: "Below ₹50,000", hi: "₹50,000 से कम", gu: "₹50,000થી ઓછું" },
      },
      {
        id: "50k_1l",
        label: { en: "₹50,000–₹1 lakh", hi: "₹50,000–₹1 लाख", gu: "₹50,000–₹1 લાખ" },
      },
      {
        id: "1l_3l",
        label: { en: "₹1–3 lakh", hi: "₹1–3 लाख", gu: "₹1–3 લાખ" },
      },
      {
        id: "3l_5l",
        label: { en: "₹3–5 lakh", hi: "₹3–5 लाख", gu: "₹3–5 લાખ" },
      },
      {
        id: "above_5l",
        label: { en: "Above ₹5 lakh", hi: "₹5 लाख से ज़्यादा", gu: "₹5 લાખથી વધુ" },
      },
    ],
    config: { flow: "d2c_growth" },
    isActive: true,
  },
  {
    id: "seo-track",
    key: "seo_track",
    type: "single_choice",
    label: {
      en: "What should Google search bring you?",
      hi: "Google search से आपको क्या चाहिए?",
      gu: "Google search દ્વારા તમને શું જોઈએ છે?",
    },
    helpText: {
      en: "SEO is planned differently for enquiries and for product sales.",
      hi: "Enquiries और product sales के लिए SEO का plan अलग-अलग बनता है।",
      gu: "Enquiries અને product sales માટે SEOનો plan અલગ-અલગ બને છે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 8,
    options: [
      {
        id: "lead_generation",
        label: {
          en: "Calls and enquiries",
          hi: "Calls और enquiries",
          gu: "Calls અને enquiries",
        },
        description: {
          en: "Lead Generation: for service, local and B2B businesses",
          hi: "Lead Generation: service, local और B2B businesses के लिए",
          gu: "Lead Generation: service, local અને B2B businesses માટે",
        },
      },
      {
        id: "d2c_growth",
        label: {
          en: "Online product sales",
          hi: "Online product sales",
          gu: "Online product sales",
        },
        description: {
          en: "D2C: for brands selling through a website or online store",
          hi: "D2C: Website या online store से products बेचने वाले brands के लिए",
          gu: "D2C: Website અથવા online store દ્વારા products વેચતી brands માટે",
        },
      },
    ],
    config: { flow: "seo", systemRole: "track_selector" },
    isActive: true,
  },
  {
    id: "seo-website",
    key: "seo_website_url",
    type: "short_text",
    label: {
      en: "Share your website or online store link.",
      hi: "अपनी Website या online store का link शेयर करें।",
      gu: "તમારી Website અથવા online storeની link શેર કરો.",
    },
    helpText: {
      en: "If you do not have one yet, enter ‘No website yet’.",
      hi: "अगर अभी कोई Website नहीं है, तो ‘अभी Website नहीं है’ लिखें।",
      gu: "જો હજી કોઈ Website નથી, તો ‘હજી Website નથી’ લખો.",
    },
    placeholder: {
      en: "yourbusiness.com or No website yet",
      hi: "yourbusiness.com या अभी Website नहीं है",
      gu: "yourbusiness.com અથવા હજી Website નથી",
    },
    required: true,
    position: 9,
    options: [],
    config: { flow: "seo", maxLength: 500 },
    isActive: true,
  },
  {
    id: "seo-lead-target-location",
    key: "seo_lead_target_location",
    type: "single_choice",
    label: {
      en: "Which area do you want to rank in on Google?",
      hi: "Google पर आप किस जगह के लिए ऊपर आना चाहते हैं?",
      gu: "Google પર તમે કયા વિસ્તાર માટે ઉપર આવવા માંગો છો?",
    },
    helpText: {
      en: "Local searches and country-wide searches need different SEO work.",
      hi: "Local और पूरे देश की searches के लिए SEO का काम अलग होता है।",
      gu: "Local અને આખા દેશની searches માટે SEOનું કામ અલગ હોય છે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 10,
    options: [
      {
        id: "local_city",
        label: { en: "Local City", hi: "सिर्फ़ अपना शहर", gu: "ફક્ત તમારું શહેર" },
        description: {
          en: "Google Maps and ‘near me’ searches",
          hi: "Google Maps और ‘near me’ searches",
          gu: "Google Maps અને ‘near me’ searches",
        },
      },
      {
        id: "gujarat",
        label: { en: "Gujarat", hi: "पूरा गुजरात", gu: "આખું ગુજરાત" },
      },
      {
        id: "pan_india",
        label: { en: "Pan India", hi: "पूरा भारत / Pan India", gu: "સમગ્ર ભારત / Pan India" },
      },
      {
        id: "international",
        label: { en: "International", hi: "भारत के बाहर / International", gu: "ભારત બહાર / International" },
      },
      {
        id: "multiple_locations",
        label: {
          en: "Multiple Locations",
          hi: "एक से ज़्यादा शहर / area",
          gu: "એકથી વધુ શહેર / વિસ્તાર",
        },
      },
    ],
    config: { flow: "seo", track: "lead_generation" },
    isActive: true,
  },
  {
    id: "seo-d2c-monthly-revenue",
    key: "seo_d2c_monthly_revenue",
    type: "single_choice",
    label: {
      en: "What is your current average monthly online revenue?",
      hi: "हर महीने आपकी औसत online sales कितनी हैं?",
      gu: "દર મહિને તમારી સરેરાશ online sales કેટલી છે?",
    },
    helpText: {
      en: "An estimate is fine. It tells us which product pages are worth ranking first.",
      hi: "लगभग रकम चुनना ठीक है। इससे पता चलता है कि पहले किन product pages पर काम करना है।",
      gu: "અંદાજિત રકમ પસંદ કરશો તો ચાલશે. તેનાથી ખબર પડે કે પહેલાં કયા product pages પર કામ કરવું.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 11,
    options: [
      {
        id: "pre_launch",
        label: {
          en: "Pre-launch / New Brand",
          hi: "Brand अभी launch नहीं हुआ / नया brand",
          gu: "Brand હજી launch નથી થઈ / નવી brand",
        },
      },
      {
        id: "below_1l",
        label: { en: "Below ₹1 lakh", hi: "₹1 लाख से कम", gu: "₹1 લાખથી ઓછું" },
      },
      {
        id: "1l_5l",
        label: { en: "₹1–5 lakh", hi: "₹1–5 लाख", gu: "₹1–5 લાખ" },
      },
      {
        id: "5l_15l",
        label: { en: "₹5–15 lakh", hi: "₹5–15 लाख", gu: "₹5–15 લાખ" },
      },
      {
        id: "above_15l",
        label: { en: "Above ₹15 lakh", hi: "₹15 लाख से ज़्यादा", gu: "₹15 લાખથી વધુ" },
      },
    ],
    config: { flow: "seo", track: "d2c_growth" },
    isActive: true,
  },
  {
    id: "seo-experience",
    key: "seo_experience",
    type: "single_choice",
    label: {
      en: "Has any SEO work been done on your website before?",
      hi: "क्या आपकी Website पर पहले SEO का काम हुआ है?",
      gu: "શું તમારી Website પર પહેલાં SEOનું કામ થયું છે?",
    },
    helpText: {
      en: "Choose the option that best matches your experience.",
      hi: "जो आपके experience से सबसे सही मिले, उसे चुनें।",
      gu: "તમારા experience સાથે સૌથી યોગ્ય વિકલ્પ પસંદ કરો.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 12,
    options: [
      {
        id: "first_time",
        label: {
          en: "No, this is my first time",
          hi: "नहीं, यह मेरी पहली बार है",
          gu: "ના, આ મારી પહેલી વાર છે",
        },
      },
      {
        id: "internal",
        label: {
          en: "Yes, done by our own team",
          hi: "हाँ, हमारी अपनी team ने किया",
          gu: "હા, અમારી પોતાની teamએ કર્યું છે",
        },
      },
      {
        id: "freelancer",
        label: {
          en: "Yes, worked with a freelancer",
          hi: "हाँ, freelancer के साथ काम किया",
          gu: "હા, freelancer સાથે કામ કર્યું છે",
        },
      },
      {
        id: "agency",
        label: {
          en: "Yes, worked with an agency",
          hi: "हाँ, agency के साथ काम किया",
          gu: "હા, agency સાથે કામ કર્યું છે",
        },
      },
      {
        id: "ranking_now",
        label: {
          en: "We already rank for some keywords and want to grow",
          hi: "कुछ keywords पर पहले से रैंक हैं, अब और आगे बढ़ना है",
          gu: "કેટલાક keywords પર પહેલેથી રેન્ક છે, હવે વધુ આગળ વધવું છે",
        },
      },
    ],
    config: { flow: "seo" },
    isActive: true,
  },
  {
    id: "seo-monthly-budget",
    key: "seo_monthly_budget",
    type: "single_choice",
    label: {
      en: "What monthly budget have you planned for SEO?",
      hi: "हर महीने SEO के लिए आपका planned budget कितना है?",
      gu: "દર મહિને SEO માટે તમારું planned budget કેટલું છે?",
    },
    helpText: {
      en: "SEO builds up over months. An estimate helps us suggest a realistic plan.",
      hi: "SEO का असर कुछ महीनों में बनता है। लगभग रकम बताने से सही plan सुझाना आसान होता है।",
      gu: "SEOની અસર થોડા મહિનામાં બને છે. અંદાજિત રકમ જણાવશો તો યોગ્ય plan સૂચવવો સરળ બને છે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 13,
    options: [
      {
        id: "not_decided",
        label: {
          en: "Not decided yet",
          hi: "अभी तय नहीं किया",
          gu: "હજી નક્કી કર્યું નથી",
        },
      },
      {
        id: "below_15k",
        label: { en: "Below ₹15,000", hi: "₹15,000 से कम", gu: "₹15,000થી ઓછું" },
      },
      {
        id: "15k_30k",
        label: { en: "₹15,000–₹30,000", hi: "₹15,000–₹30,000", gu: "₹15,000–₹30,000" },
      },
      {
        id: "30k_60k",
        label: { en: "₹30,000–₹60,000", hi: "₹30,000–₹60,000", gu: "₹30,000–₹60,000" },
      },
      {
        id: "above_60k",
        label: { en: "Above ₹60,000", hi: "₹60,000 से ज़्यादा", gu: "₹60,000થી વધુ" },
      },
    ],
    config: { flow: "seo" },
    isActive: true,
  },
  {
    id: "name",
    key: "full_name",
    type: "short_text",
    label: { en: "Your Full Name", hi: "आपका पूरा नाम", gu: "તમારું પૂરું નામ" },
    helpText: { en: "", hi: "", gu: "" },
    placeholder: {
      en: "Enter your full name",
      hi: "अपना पूरा नाम लिखें",
      gu: "તમારું પૂરું નામ લખો",
    },
    required: true,
    position: 14,
    options: [],
    config: { systemRole: "contact_name", minLength: 2, maxLength: 100 },
    isActive: true,
  },
  {
    id: "phone",
    key: "phone",
    type: "phone",
    label: { en: "Your WhatsApp Number", hi: "आपका WhatsApp नंबर", gu: "તમારો WhatsApp નંબર" },
    helpText: {
      en: "We’ll use this only to discuss your enquiry.",
      hi: "इस नंबर का इस्तेमाल सिर्फ़ आपकी enquiry पर बात करने के लिए होगा।",
      gu: "તમારી enquiry વિશે વાત કરવા માટે જ આ નંબરનો ઉપયોગ કરીશું.",
    },
    placeholder: {
      en: "Enter your WhatsApp number",
      hi: "WhatsApp नंबर लिखें",
      gu: "WhatsApp નંબર લખો",
    },
    required: true,
    position: 15,
    options: [],
    config: { systemRole: "contact_phone" },
    isActive: true,
  },
];

export const fallbackQuestionnaire: PublicQuestionnaire = {
  formId: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  slug: "growth-check",
  name: "Global Surat Growth Check",
  version: 1,
  questions: defaultQuestions,
  isFallback: true,
};
