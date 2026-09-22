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
    id: "seo-goal",
    key: "seo_goal",
    type: "single_choice",
    label: {
      en: "What would you like SEO to help you achieve?",
      hi: "आप SEO की मदद से क्या हासिल करना चाहते हैं?",
      gu: "તમે SEO ની મદદથી શું હાંસલ કરવા માંગો છો?",
    },
    helpText: {
      en: "This helps us understand your main SEO goal.",
      hi: "इससे हमें आपका मुख्य SEO goal समझने में मदद मिलेगी।",
      gu: "આનાથી અમને તમારો મુખ્ય SEO goal સમજવામાં મદદ મળશે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 8,
    options: [
      {
        id: "lead_generation",
        label: {
          en: "Generate more leads",
          hi: "ज़्यादा leads पाना",
          gu: "વધુ leads મેળવવી",
        },
      },
      {
        id: "d2c_growth",
        label: {
          en: "Increase online sales",
          hi: "Online sales बढ़ाना",
          gu: "Online sales વધારવી",
        },
      },
      {
        id: "local_customers",
        label: {
          en: "Get more local customers",
          hi: "आस-पास के ज़्यादा ग्राहक पाना",
          gu: "આસપાસના વધુ ગ્રાહકો મેળવવા",
        },
      },
      {
        id: "website_traffic",
        label: {
          en: "Increase relevant website traffic",
          hi: "Website पर सही traffic बढ़ाना",
          gu: "Website પર યોગ્ય traffic વધારવું",
        },
      },
      {
        id: "google_rankings",
        label: {
          en: "Improve Google rankings",
          hi: "Google ranking बेहतर करना",
          gu: "Google ranking સુધારવી",
        },
      },
      {
        id: "not_sure",
        label: {
          en: "Not sure yet",
          hi: "अभी तय नहीं है",
          gu: "હજી નક્કી નથી",
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
      en: "What is your website URL?",
      hi: "आपकी website URL क्या है?",
      gu: "તમારી website URL શું છે?",
    },
    helpText: {
      en: "We’ll review your website to understand its current SEO setup.",
      hi: "हम आपकी website की current SEO setup को समझने के लिए इसे review करेंगे।",
      gu: "તમારી website ની current SEO setup સમજવા માટે અમે તેને review કરીશું.",
    },
    placeholder: {
      en: "yourbusiness.com",
      hi: "yourbusiness.com",
      gu: "yourbusiness.com",
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
      en: "Where do you want to attract customers from?",
      hi: "आप किन locations से customers attract करना चाहते हैं?",
      gu: "તમે કઈ locationsમાંથી customers attract કરવા માંગો છો?",
    },
    helpText: {
      en: "Tell us the areas where you want to generate leads.",
      hi: "उन locations के बारे में बताएं जहाँ आप leads generate करना चाहते हैं।",
      gu: "તમે જે locationsમાંથી leads generate કરવા માંગો છો તે જણાવો.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 10,
    options: [
      {
        id: "local_area",
        label: {
          en: "My city/local area",
          hi: "मेरा शहर / आस-पास का area",
          gu: "મારું શહેર / આસપાસનો વિસ્તાર",
        },
      },
      {
        id: "multiple_cities",
        label: {
          en: "Multiple cities",
          hi: "एक से ज़्यादा शहर",
          gu: "એકથી વધુ શહેરો",
        },
      },
      {
        id: "across_country",
        label: {
          en: "Across my country",
          hi: "पूरे देश में",
          gu: "આખા દેશમાં",
        },
      },
      {
        id: "worldwide",
        label: {
          en: "Worldwide",
          hi: "पूरी दुनिया में",
          gu: "આખી દુનિયામાં",
        },
      },
      {
        id: "other",
        label: { en: "Other", hi: "अन्य", gu: "અન્ય" },
      },
    ],
    config: { flow: "seo", track: "lead_generation" },
    isActive: true,
  },
  {
    id: "seo-d2c-monthly-sales",
    key: "seo_d2c_monthly_sales",
    type: "single_choice",
    label: {
      en: "What are your average monthly online sales?",
      hi: "आपकी average monthly online sales कितनी हैं?",
      gu: "તમારી average monthly online sales કેટલી છે?",
    },
    helpText: {
      en: "This helps us understand your current online business scale.",
      hi: "इससे हमें आपके current online business scale को समझने में मदद मिलेगी।",
      gu: "આનાથી અમને તમારા current online business scale ને સમજવામાં મદદ મળશે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 11,
    options: [
      {
        id: "under_1l",
        label: { en: "Under ₹1 lakh", hi: "₹1 लाख से कम", gu: "₹1 લાખથી ઓછું" },
      },
      {
        id: "1l_5l",
        label: { en: "₹1–5 lakh", hi: "₹1–5 लाख", gu: "₹1–5 લાખ" },
      },
      {
        id: "5l_10l",
        label: { en: "₹5–10 lakh", hi: "₹5–10 लाख", gu: "₹5–10 લાખ" },
      },
      {
        id: "10l_25l",
        label: { en: "₹10–25 lakh", hi: "₹10–25 लाख", gu: "₹10–25 લાખ" },
      },
      {
        id: "above_25l",
        label: { en: "₹25 lakh+", hi: "₹25 लाख+", gu: "₹25 લાખ+" },
      },
      {
        id: "prefer_not_to_say",
        label: {
          en: "Prefer not to say",
          hi: "बताना नहीं चाहते",
          gu: "જણાવવા માંગતા નથી",
        },
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
      en: "Have you invested in SEO before?",
      hi: "क्या आपने पहले SEO में investment किया है?",
      gu: "શું તમે પહેલાં SEO માં investment કર્યું છે?",
    },
    helpText: {
      en: "This helps us understand what has already been tried.",
      hi: "इससे हमें समझने में मदद मिलेगी कि पहले क्या try किया जा चुका है।",
      gu: "આનાથી અમને સમજવામાં મદદ મળશે કે પહેલાં શું try કરવામાં આવ્યું છે.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 12,
    options: [
      {
        id: "first_time",
        label: {
          en: "No, this is our first time",
          hi: "नहीं, यह हमारी पहली बार है",
          gu: "ના, આ અમારી પહેલી વાર છે",
        },
      },
      {
        id: "stopped",
        label: {
          en: "Yes, but we stopped",
          hi: "हाँ, लेकिन हमने बंद कर दिया",
          gu: "હા, પણ અમે બંધ કરી દીધું",
        },
      },
      {
        id: "currently_doing",
        label: {
          en: "Yes, we are currently doing SEO",
          hi: "हाँ, अभी SEO चल रहा है",
          gu: "હા, અત્યારે SEO ચાલી રહ્યું છે",
        },
      },
      {
        id: "not_satisfied",
        label: {
          en: "Yes, but we are not satisfied with the results",
          hi: "हाँ, लेकिन results से संतुष्ट नहीं हैं",
          gu: "હા, પણ results થી સંતુષ્ટ નથી",
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
      en: "What monthly budget are you considering for SEO?",
      hi: "आप SEO के लिए हर महीने कितना budget consider कर रहे हैं?",
      gu: "તમે SEO માટે દર મહિને કેટલું budget consider કરી રહ્યા છો?",
    },
    helpText: {
      en: "This helps us suggest an SEO plan that fits your budget.",
      hi: "इससे हम आपके budget के अनुसार सही SEO plan suggest कर पाएंगे।",
      gu: "આનાથી અમે તમારા budget મુજબ યોગ્ય SEO plan suggest કરી શકીશું.",
    },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 13,
    options: [
      {
        id: "under_25k",
        label: { en: "Under ₹25,000", hi: "₹25,000 से कम", gu: "₹25,000થી ઓછું" },
      },
      {
        id: "25k_50k",
        label: { en: "₹25,000–₹50,000", hi: "₹25,000–₹50,000", gu: "₹25,000–₹50,000" },
      },
      {
        id: "50k_1l",
        label: { en: "₹50,000–₹1 lakh", hi: "₹50,000–₹1 लाख", gu: "₹50,000–₹1 લાખ" },
      },
      {
        id: "above_1l",
        label: { en: "₹1 lakh+", hi: "₹1 लाख+", gu: "₹1 લાખ+" },
      },
      {
        id: "not_decided",
        label: {
          en: "Not decided yet",
          hi: "अभी तय नहीं किया",
          gu: "હજી નક્કી કર્યું નથી",
        },
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
