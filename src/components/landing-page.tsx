"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Images,
  MapPin,
  Megaphone,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  languageNames,
  languageNativeLabels,
  marqueeItems,
  processSteps,
  services,
  siteCopy,
  text,
} from "@/lib/copy";
import {
  getSelectedGrowthPath,
  getVisibleQuestions,
  pruneHiddenAnswers,
} from "@/lib/questionnaire-flow";
import {
  growthPaths,
  locales,
  type Locale,
  type PublicQuestion,
  type PublicQuestionnaire,
  type QuestionOption,
} from "@/lib/types";
import { validateQuestionAnswer } from "@/lib/validation";

type AnswerMap = Record<string, unknown>;

const serviceIcons: LucideIcon[] = [Megaphone, ShoppingBag, Images, Store, Search];
const MAIN_WEBSITE_URL = "https://globalsurat.com/";

const faqs = [
  {
    q: {
      en: "Do I need to understand digital marketing?",
      hi: "क्या मुझे digital marketing समझना ज़रूरी है?",
      gu: "શું મને digital marketing સમજવું જરૂરી છે?",
    },
    a: {
      en: "Not at all. Tell us what result you want in normal words. We’ll explain the useful options without jargon.",
      hi: "बिल्कुल नहीं। आपको जो result चाहिए, वह आसान शब्दों में बताइए। उपयोगी options हम मुश्किल jargon के बिना समझाएँगे।",
      gu: "બિલકુલ નહીં. તમને જે result જોઈએ તે સરળ શબ્દોમાં કહો. ઉપયોગી options અમે મુશ્કેલ jargon વગર સમજાવીશું.",
    },
  },
  {
    q: {
      en: "Is this 2-minute check free?",
      hi: "क्या यह 2-minute check free है?",
      gu: "શું આ 2-minute check free છે?",
    },
    a: {
      en: "Yes. Sharing your needs and the first conversation are free. We only discuss pricing after we understand the work.",
      hi: "हाँ। अपनी ज़रूरत बताना और पहली बातचीत free है। काम समझने के बाद ही pricing पर बात होगी।",
      gu: "હા. તમારી જરૂરિયાત જણાવવી અને પહેલી વાતચીત free છે. કામ સમજ્યા પછી જ pricing વિશે વાત થશે.",
    },
  },
  {
    q: {
      en: "What happens after I submit?",
      hi: "Submit करने के बाद क्या होगा?",
      gu: "Submit કર્યા પછી શું થશે?",
    },
    a: {
      en: "A person from our Surat team reviews your answers, then calls or WhatsApps you with a practical next step. There is no pressure to buy.",
      hi: "हमारी सूरत team आपके जवाब देखकर उपयोगी अगले कदम के साथ call या WhatsApp करेगी। खरीदने का कोई दबाव नहीं।",
      gu: "અમારી સુરત team તમારા જવાબ જોઈને ઉપયોગી આગળના પગલા સાથે call અથવા WhatsApp કરશે. ખરીદીનું કોઈ દબાણ નહીં.",
    },
  },
] as const;

function optionDescription(option: QuestionOption, locale: Locale) {
  return option.description ? text(option.description, locale) : "";
}

function QuestionControl({
  question,
  locale,
  value,
  onChange,
}: {
  question: PublicQuestion;
  locale: Locale;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const labelledBy = "question-heading";
  const textValue = typeof value === "string" || typeof value === "number" ? String(value) : "";

  if (["short_text", "email", "phone", "number", "date"].includes(question.type)) {
    const type =
      question.type === "short_text"
        ? "text"
        : question.type === "phone"
          ? "tel"
          : question.type;
    return (
      <input
        className="question-input"
        type={type}
        value={textValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder={text(question.placeholder, locale)}
        aria-labelledby={labelledBy}
        inputMode={question.type === "phone" ? "tel" : question.type === "number" ? "numeric" : undefined}
        autoComplete={
          question.key === "full_name"
            ? "name"
            : question.type === "phone"
              ? "tel"
              : question.type === "email"
                ? "email"
                : question.key === "city"
                  ? "address-level2"
                  : "off"
        }
        maxLength={question.config.maxLength}
        min={question.config.min}
        max={question.config.max}
      />
    );
  }

  if (question.type === "long_text") {
    return (
      <textarea
        className="question-input question-textarea"
        value={textValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder={text(question.placeholder, locale)}
        aria-labelledby={labelledBy}
        maxLength={question.config.maxLength ?? 2000}
        rows={5}
      />
    );
  }

  if (question.type === "dropdown") {
    return (
      <div className="select-wrap">
        <select
          className="question-input question-select"
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          aria-labelledby={labelledBy}
        >
          <option value="">Choose one</option>
          {question.options.map((option) => (
            <option key={option.id} value={option.id}>
              {text(option.label, locale)}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" size={20} />
      </div>
    );
  }

  if (question.type === "rating") {
    const selected = Number(value || 0);
    const min = question.config.min ?? 1;
    const max = question.config.max ?? 5;
    return (
      <div className="rating-grid" role="radiogroup" aria-labelledby={labelledBy}>
        {Array.from({ length: max - min + 1 }, (_, index) => index + min).map((rating) => (
          <button
            key={rating}
            type="button"
            className={selected === rating ? "rating-option selected" : "rating-option"}
            role="radio"
            aria-checked={selected === rating}
            onClick={() => onChange(rating)}
          >
            {rating}
          </button>
        ))}
      </div>
    );
  }

  const options =
    question.type === "yes_no" && question.options.length === 0
      ? [
          { id: "yes", label: { en: "Yes", hi: "हाँ", gu: "હા" } },
          { id: "no", label: { en: "No", hi: "नहीं", gu: "ના" } },
        ]
      : question.options;

  if (question.type === "multi_choice") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const maxSelections = question.config.maxSelections ?? options.length;

    return (
      <div className="choice-grid" role="group" aria-labelledby={labelledBy}>
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          const isDisabled = !isSelected && selected.length >= maxSelections;
          return (
            <button
              type="button"
              key={option.id}
              className={isSelected ? "choice-card selected" : "choice-card"}
              aria-pressed={isSelected}
              disabled={isDisabled}
              onClick={() =>
                onChange(
                  isSelected
                    ? selected.filter((id) => id !== option.id)
                    : [...selected, option.id],
                )
              }
            >
              <span className="choice-check">{isSelected && <Check size={16} strokeWidth={3} />}</span>
              <span className="choice-copy">
                <strong>{text(option.label, locale)}</strong>
                {optionDescription(option, locale) && <small>{optionDescription(option, locale)}</small>}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="choice-grid" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <button
            type="button"
            key={option.id}
            className={isSelected ? "choice-card selected" : "choice-card"}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.id)}
          >
            <span className="choice-check">{isSelected && <Check size={16} strokeWidth={3} />}</span>
            <span className="choice-copy">
              <strong>{text(option.label, locale)}</strong>
              {optionDescription(option, locale) && <small>{optionDescription(option, locale)}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GrowthCheck({
  questionnaire,
  locale,
  onLocaleChange,
}: {
  questionnaire: PublicQuestionnaire;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [submissionToken] = useState(() => crypto.randomUUID());
  const questions = getVisibleQuestions(questionnaire.questions, answers);
  const currentQuestion = questions[step];
  const isLast = step === questions.length - 1;
  const selectedGrowthPath = getSelectedGrowthPath(questionnaire.questions, answers);
  const expectedQuestionCount = selectedGrowthPath
    ? questions.length
    : Math.max(
        questions.length,
        ...growthPaths.map((growthPath) =>
          questionnaire.questions.filter(
            (question) => !question.config.flow || question.config.flow === growthPath,
          ).length,
        ),
      );
  const progress = expectedQuestionCount ? ((step + 1) / expectedQuestionCount) * 100 : 0;

  const moveFocus = () => {
    window.setTimeout(() => document.getElementById("question-heading")?.focus(), 0);
  };

  function validateCurrent() {
    if (!currentQuestion) return false;
    const result = validateQuestionAnswer(currentQuestion, answers[currentQuestion.key]);
    if (!result.ok) {
      setError(text(siteCopy.requiredError, locale));
      return false;
    }
    setError("");
    return true;
  }

  function nextStep() {
    if (!validateCurrent()) return;
    setStep((current) => Math.min(current + 1, questions.length - 1));
    moveFocus();
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    moveFocus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCurrent()) return;
    if (!consent) {
      setError(text(siteCopy.consentError, locale));
      return;
    }

    setError("");
    setIsSubmitting(true);

    const params = new URLSearchParams(window.location.search);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: questionnaire.formId,
          versionId: questionnaire.versionId,
          language: locale,
          answers,
          submissionToken,
          consent: true,
          startedAt,
          honeypot,
          attribution: {
            source: params.get("source") || undefined,
            referrer: document.referrer || undefined,
            utmSource: params.get("utm_source") || undefined,
            utmMedium: params.get("utm_medium") || undefined,
            utmCampaign: params.get("utm_campaign") || undefined,
            utmContent: params.get("utm_content") || undefined,
            utmTerm: params.get("utm_term") || undefined,
            fbclid: params.get("fbclid") || undefined,
            gclid: params.get("gclid") || undefined,
          },
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        questionKey?: string;
      };

      if (!response.ok || !result.ok) {
        if (result.questionKey) {
          const invalidIndex = questions.findIndex((question) => question.key === result.questionKey);
          if (invalidIndex >= 0) setStep(invalidIndex);
        }
        setError(result.message || text(siteCopy.saveError, locale));
        return;
      }

      window.location.replace("/thank-you");
    } catch {
      setError(text(siteCopy.connectError, locale));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!currentQuestion) {
    return <p className="form-error">{text(siteCopy.formUnavailable, locale)}</p>;
  }

  return (
    <form onSubmit={submit} className="growth-form" noValidate>
      <div className="form-topline">
        <span className="form-kicker">{text(siteCopy.formKicker, locale)}</span>
        <span className="step-count">{String(step + 1).padStart(2, "0")} / {String(expectedQuestionCount).padStart(2, "0")}</span>
      </div>
      <div className="progress-track" aria-label={`Question ${step + 1} of ${expectedQuestionCount}`} role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={expectedQuestionCount}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="form-language-mobile" aria-label="Choose language">
        {locales.map((item) => (
          <button key={item} type="button" aria-pressed={locale === item} className={locale === item ? "active" : ""} onClick={() => onLocaleChange(item)}>
            {languageNames[item]}
          </button>
        ))}
      </div>

      <fieldset className="question-fieldset">
        <legend className="sr-only">{text(currentQuestion.label, locale)}</legend>
        <div className="question-heading-wrap">
          <span className="question-number">Q{String(step + 1).padStart(2, "0")}</span>
          <div>
            <h2 id="question-heading" tabIndex={-1}>{text(currentQuestion.label, locale)}</h2>
            {text(currentQuestion.helpText, locale) && <p>{text(currentQuestion.helpText, locale)}</p>}
            {!currentQuestion.required && <span className="optional-pill">{text(siteCopy.optional, locale)}</span>}
          </div>
        </div>

        <QuestionControl
          question={currentQuestion}
          locale={locale}
          value={answers[currentQuestion.key]}
          onChange={(value) => {
            setAnswers((current) =>
              pruneHiddenAnswers(questionnaire.questions, {
                ...current,
                [currentQuestion.key]: value,
              }),
            );
            setError("");
          }}
        />
      </fieldset>

      <label className="honeypot" aria-hidden="true">
        Company website
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
      </label>

      {isLast && (
        <label className="consent-row">
          <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError(""); }} />
          <span className="consent-box"><Check size={14} /></span>
          <span>{text(siteCopy.consent, locale)}</span>
        </label>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="button button-secondary" type="button" onClick={previousStep} disabled={step === 0 || isSubmitting}>
          <ArrowLeft size={18} /> {text(siteCopy.back, locale)}
        </button>
        {isLast ? (
          <button className="button button-primary form-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? text(siteCopy.saving, locale) : text(siteCopy.submit, locale)} <ArrowRight size={18} />
          </button>
        ) : (
          <button className="button button-primary" type="button" onClick={nextStep}>
            {text(siteCopy.next, locale)} <ArrowRight size={18} />
          </button>
        )}
      </div>
      <p className="privacy-note"><ShieldCheck size={15} /> {text(siteCopy.privacyNote, locale)}</p>
    </form>
  );
}

export function LandingPage({ questionnaire }: { questionnaire: PublicQuestionnaire }) {
  const [locale, setLocale] = useState<Locale>("en");
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "#growth-check";
  const activeCopy = useMemo(() => ({
    body: text(siteCopy.heroBody, locale),
    cta: text(siteCopy.primaryCta, locale),
  }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale === "gu" ? "gu-IN" : locale === "hi" ? "hi-IN" : "en-IN";
  }, [locale]);

  function startGrowthCheck() {
    const formSection = document.getElementById("growth-check");
    if (!formSection) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formSection.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    window.setTimeout(() => {
      formSection
        .querySelector<HTMLElement>(
          ".choice-card:not(:disabled), .question-input, .rating-option:not(:disabled)",
        )
        ?.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 350);
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <a href="#top" className="brand-link" aria-label="Global Surat home">
          <Image
            src="/assets/global-surat-logo.png"
            alt="Global Surat"
            width={212}
            height={113}
            sizes="(max-width: 900px) 146px, 168px"
            priority
          />
        </a>
        <div className="header-actions">
          <a
            className="header-main-site"
            href={MAIN_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${text(siteCopy.mainWebsite, locale)} (opens in a new tab)`}
          >
            {text(siteCopy.mainWebsite, locale)} <ExternalLink size={14} />
          </a>
          <div className="language-switch" role="group" aria-label="Choose page language">
            {locales.map((item) => (
              <button key={item} type="button" aria-pressed={locale === item} className={locale === item ? "active" : ""} onClick={() => setLocale(item)}>
                {languageNames[item]}
              </button>
            ))}
          </div>
          <button className="header-cta" type="button" onClick={startGrowthCheck} aria-controls="growth-check" data-cta-location="navbar">
            {text(siteCopy.navCta, locale)} <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <section id="top" className="hero-section">
        <div className="hero-grid-pattern" aria-hidden="true" />
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> {text(siteCopy.eyebrow, locale)}</span>
          <h1>
            {text(siteCopy.headlineTop, locale)}<br />
            <em>{text(siteCopy.headlineAccent, locale)}</em>
          </h1>
          <p className="hero-description">{activeCopy.body}</p>
          <div className="hero-actions">
            <button className="button button-primary button-large" type="button" onClick={startGrowthCheck} aria-controls="growth-check" data-cta-location="hero">
              {activeCopy.cta} <ArrowRight size={20} />
            </button>
            {whatsappNumber ? (
              <a className="text-link" href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={19} /> {text(siteCopy.whatsappCta, locale)}
              </a>
            ) : (
              <button className="text-link" type="button" onClick={startGrowthCheck} aria-controls="growth-check">
                <MessageCircle size={19} /> {text(siteCopy.whatsappCta, locale)}
              </button>
            )}
          </div>
          <div className="trust-row" aria-label="Why people choose this check">
            <span><Check size={15} /> {text(siteCopy.noJargon, locale)}</span>
            <span><Check size={15} /> {text(siteCopy.freeCall, locale)}</span>
            <span><Check size={15} /> {text(siteCopy.localTeam, locale)}</span>
          </div>
          <div className="language-note">
            <strong>{languageNativeLabels[locale]}</strong>
            <span>{text(siteCopy.languageAvailability, locale)}</span>
          </div>
        </div>

        <div id="growth-check" className="form-column">
          <div className="form-accent" aria-hidden="true"><span>2 MIN</span><span>FREE CHECK</span></div>
          <div className="form-card">
            <div className="form-intro">
              <div>
                <span className="form-kicker">{text(siteCopy.formKicker, locale)}</span>
                <h2>{text(siteCopy.formTitle, locale)}</h2>
              </div>
              <p>{text(siteCopy.formIntro, locale)}</p>
            </div>
            <GrowthCheck questionnaire={questionnaire} locale={locale} onLocaleChange={setLocale} />
          </div>
        </div>
      </section>

      <section className="marquee-strip" aria-label="Global Surat service outcomes">
        <span className="sr-only">{marqueeItems.map((item) => text(item, locale)).join(" · ")}</span>
        <div className="marquee-track" aria-hidden="true">
          {[0, 1].map((copyIndex) => (
            <div className="marquee-group" key={copyIndex}>
              {marqueeItems.map((item) => (
                <span key={`${copyIndex}-${item.en}`}>{text(item, locale)} <i>✦</i></span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="services-section section-pad">
        <div className="section-heading">
          <span className="eyebrow dark">{text(siteCopy.servicesEyebrow, locale)}</span>
          <h2>{text(siteCopy.servicesTitle, locale)}</h2>
          <p>{text(siteCopy.servicesIntro, locale)}</p>
        </div>
        <div className="services-grid">
          {services.map((service, index) => {
            const Icon = serviceIcons[index];
            return (
              <article className="service-card" key={service.number}>
                <div className="service-card-top"><span>{service.number}</span><Icon size={27} strokeWidth={1.8} /></div>
                <h3>{text(service.title, locale)}</h3>
                <p>{text(service.body, locale)}</p>
                <small>{service.technical}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="team-section section-pad">
        <div className="team-copy">
          <span className="eyebrow"><MapPin size={15} /> {text(siteCopy.teamEyebrow, locale)}</span>
          <h2>{text(siteCopy.teamTitle, locale)}</h2>
          <p>{text(siteCopy.teamBody, locale)}</p>
          <a
            className="button button-light"
            href={MAIN_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${text(siteCopy.mainWebsite, locale)} (opens in a new tab)`}
          >
            {text(siteCopy.mainWebsite, locale)} <ExternalLink size={18} />
          </a>
        </div>
        <figure className="team-photo-wrap">
          <Image
            src="/assets/global-surat-team.webp"
            alt="The Global Surat team in their Surat office"
            width={1920}
            height={1080}
            sizes="(max-width: 900px) 100vw, 58vw"
          />
          <figcaption><span>{text(siteCopy.teamPhotoLabel, locale)}</span><strong>Surat, Gujarat</strong></figcaption>
        </figure>
      </section>

      <section className="process-section section-pad">
        <div className="section-heading light">
          <span className="eyebrow">{text(siteCopy.processEyebrow, locale)}</span>
          <h2>{text(siteCopy.processTitle, locale)}</h2>
        </div>
        <div className="process-grid">
          {processSteps.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <h3>{text(item.title, locale)}</h3>
              <p>{text(item.body, locale)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="faq-section section-pad">
        <div className="section-heading compact">
          <span className="eyebrow dark">{text(siteCopy.faqEyebrow, locale)}</span>
          <h2>{text(siteCopy.faqTitle, locale)}</h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={index}>
              <summary><span>{text(faq.q, locale)}</span><span className="faq-plus">+</span></summary>
              <p>{text(faq.a, locale)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta section-pad">
        <div>
          <span className="eyebrow">{text(siteCopy.finalEyebrow, locale)}</span>
          <h2>{text(siteCopy.finalTitle, locale)}</h2>
        </div>
        <button className="button button-light button-large" type="button" onClick={startGrowthCheck} aria-controls="growth-check" data-cta-location="final">
          {text(siteCopy.primaryCta, locale)} <ArrowRight size={21} />
        </button>
      </section>

      <footer className="site-footer">
        <a href={MAIN_WEBSITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Visit the Global Surat main website (opens in a new tab)">
          <Image src="/assets/global-surat-logo.png" alt="Global Surat" width={175} height={93} />
        </a>
        <p>{text(siteCopy.footerBody, locale)}</p>
        <div>
          <span>© {new Date().getFullYear()} Global Surat</span>
          <a href={MAIN_WEBSITE_URL} target="_blank" rel="noopener noreferrer">{text(siteCopy.websiteShort, locale)} ↗</a>
        </div>
      </footer>

      <button className="mobile-sticky-cta" type="button" onClick={startGrowthCheck} aria-controls="growth-check" data-cta-location="mobile-sticky">
        {text(siteCopy.primaryCta, locale)} <ArrowRight size={18} />
      </button>
    </main>
  );
}
