// Every customer-facing string lives here, keyed off the configurable brand
// name. Tone: warm, concise, competent front desk — no emoji spam.
import { config } from "./app";

export const copy = {
  smsStandingConfirm: (firstName: string, dateStr: string, timeStr: string, link: string) =>
    `Hi ${firstName}! You're booked for your ${config.brandName} tan on ${dateStr} at ${timeStr}. ` +
    `Need a different time, or want to skip this visit? One tap: ${link}`,

  smsReminder48: (dateStr: string, timeStr: string, link: string) =>
    `Reminder from ${config.brandName}: your tan is ${dateStr} at ${timeStr}. ` +
    `Reschedule or cancel here: ${link}`,

  smsReminder3: (timeStr: string) =>
    `See you at ${timeStr}! Quick prep: shower & exfoliate beforehand, skip lotion and deodorant, ` +
    `and wear loose, dark clothing after. — ${config.brandName}`,

  smsMissedYou: (link: string) =>
    `We missed you today! Want to grab a spot at the next visit? ${link} — ${config.brandName}`,

  smsRunningLate: (minutes: number) =>
    `Quick heads up from ${config.brandName}: your tech is running about ${minutes} minutes behind ` +
    `today. Same spot, just a little later — thanks for your patience!`,

  smsPaymentFailed: (link: string) =>
    `Hi! Your ${config.brandName} membership payment didn't go through — usually just an expired card. ` +
    `Update it in a minute here: ${link}`,

  // Fixed, safe reply sent whenever the concierge escalates (e.g. medical) —
  // the member never receives the model's improvised text in that case.
  smsEscalationHandoff: () =>
    `Thanks for flagging this — a real person from ${config.brandName} will follow up with you ` +
    `personally very shortly. For anything urgent or medical, please contact a healthcare professional.`,

  standingExplanation:
    "We'll auto-book you each visit; skip any time with one tap.",

  // ── Marketing site (W-1…W-9) — labels & structural copy. Skin-care content
  // (Prep/Aftercare/FAQ/express-tan) is pulled from scc-website-notes.md into
  // the `tanCare`, `faqItems`, and `pricing` keys when provided. Nothing here
  // is a health claim; cosmetic framing only.
  marketing: {
    // Primary = join (house pick is step 1 of signup). Secondary = request a
    // house that isn't on the platform yet. (Revises the earlier
    // "Find your house"/"Bring SCC" labels per founder feedback.)
    ctaFindHouse: "Join your house",
    ctaBringScc: "Request your house",
    heroTrust: "We come to you · card on file · pause anytime",
    memberLogin: "Member login",
    navItems: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/tan-care", label: "Tan Care" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
    heroHeadline: "A fresh glow, without leaving the house.",
    heroLede:
      "Skin-conscious spray tans delivered to your house on a set schedule — one flat monthly membership, booked in seconds online or by text.",
    heroSub: "Already a member at your house? Find it below. New to us? Bring us to your house.",
    neverPayTech: "You never pay your technician — membership is billed to your card on file.",
    noSunProtection:
      "A spray tan is cosmetic color only — it offers no sun protection. Keep wearing SPF as you normally would.",
    footerTagline: "Cosmetic sunless tanning, delivered.",

    findTitle: "Join your house",
    findIntro: "Pick your campus and house to start your membership. Don't see yours? Request it below.",
    findNoHouses: "No houses are taking signups yet — be the first to request yours.",

    bringTitle: "Request your house",
    bringIntro:
      "Want recurring tans at your house? Tell us where you are and we'll reach out about getting set up.",
    bringConfirm: "Got it — thank you! We'll be in touch about getting your house set up.",

    // Waiver shown and accepted during signup (see /join). PLACEHOLDER — must
    // be replaced with founder/legal-reviewed text before real launch.
    waiverVersion: "v1-draft",
    waiverTitle: "Spray tan consent & waiver",
    waiverText:
      "I understand a spray tan is a cosmetic sunless tan using DHA — temporary color that develops over a few hours and fades gradually. Results vary by skin and prep, and a spray tan provides no sun protection. If I have sensitive skin or known allergies I'll request a patch test first. I accept responsibility for following the prep and aftercare guidance, and I release the provider from liability for ordinary cosmetic outcomes such as clothing/sheet staining or uneven fading. (Draft text — pending legal review.)",
    waiverAgree: "I've read and agree to the consent & waiver above.",
    waiverRequired: "Please read and agree to the waiver to continue.",

    contactTitle: "Contact us",
    contactIntro: "Questions? Send a note — or just text us, that's our front desk too.",
    contactConfirm: "Thanks — we'll get back to you shortly.",

    formRateLimited: "Too many submissions — give it a few minutes and try again.",
    formError: "Something went wrong — please try again.",
  },

  // ── Content pages. Facts/compliance lines below are from the build
  // instructions; longer marketing prose from scc-website-notes.md can be
  // slotted into these same keys. Cosmetic framing only — never "healthy".
  howItWorks: {
    title: "How it works",
    intro: "A salon glow without the salon. Here's the whole thing in a minute.",
    steps: [
      { title: "We come to your house", body: "Your technician visits on your house's set schedule — typically twice a month — so a fresh tan is always on the calendar." },
      { title: "One flat monthly membership", body: "Pick monthly or semester. Your card is on file, so there's nothing to pay on the day." },
      { title: "Book in seconds", body: "Reserve, move, or skip a visit online — or just text us. You're auto-booked each visit and can skip any time with one tap." },
      { title: "You never pay your technician", body: "All billing runs through your membership. Your tech just shows up and gives you a great tan." },
      { title: "Express, as standard", body: "Every tan is the rapid-rinse type — shower in 2–4 hours, no overnight wait. More on the Pricing page." },
    ],
  },

  tanCare: {
    title: "Tan Care",
    intro: "A little prep and aftercare go a long way toward an even, longer-lasting glow.",
    prepTitle: "Preparation",
    prep: [
      "Shower and exfoliate the day of — smooth, clean skin takes color most evenly.",
      "Skip lotion, deodorant, makeup, and perfume before your appointment.",
      "Shave or wax at least a few hours ahead, not right before.",
      "Wear loose, dark clothing and bring flip-flops.",
    ],
    aftercareTitle: "Aftercare",
    aftercare: [
      "Avoid water, sweat, and tight clothing until your first rinse.",
      "First rinse: lukewarm water only, no soap or scrubbing — just let the bronzer wash off.",
      "Moisturize daily afterward to keep the color even as it fades.",
      "Pat dry gently; don't rub.",
    ],
    rinseTitle: "When to rinse (express timing)",
    rinseIntro: "Your tan keeps developing for about 24 hours. Time your first rinse to the depth you want — the longer you wait (within range), the deeper the color.",
    rinseGuide: [
      { shade: "Light", time: "~2 hours" },
      { shade: "Medium", time: "~3 hours" },
      { shade: "Deep", time: "~4 hours" },
    ],
    rinseNote: "Not sure? Start lighter — you can always go deeper next visit.",
  },

  pricingPage: {
    title: "Membership",
    intro: "One flat price, a fresh tan on your schedule, and nothing to pay at your appointment.",
    expressTitle: "Express is standard here",
    expressBody:
      "Every tan we do is the rapid-rinse, express type: the same DHA glow, but you rinse in 2–4 hours instead of waiting overnight. Time your rinse to your shade and get on with your day. It's not an upsell — it's just how we do every tan.",
    includesTitle: "What's included",
    includes: [
      "Recurring visits to your house on its set schedule",
      "Your shade kept on file, so every tan matches",
      "One-tap rescheduling and skipping, online or by text",
      "Auto-booking each visit — never miss your spot",
    ],
  },

  faqItems: [
    { q: "Do I pay the technician?", a: "Never. Everything runs through your membership on the card you have on file — there's no cash, tipping pressure, or checkout at your appointment. Your technician just gives you a great tan." },
    { q: "What kind of tan is this?", a: "A cosmetic sunless spray tan using DHA — the same ingredient salons use. It's temporary color that develops over a few hours and fades gradually. No UV, no booth." },
    { q: "How fast can I rinse?", a: "Every tan is express: rinse in about 2–4 hours depending on how deep you want to go. Color keeps developing for around 24 hours. See Tan Care for the timing guide." },
    { q: "Does a spray tan protect me from the sun?", a: "No. A spray tan is cosmetic color only and offers no sun protection — keep wearing SPF as you normally would." },
    { q: "Can I pause or cancel?", a: "Anytime, right from your account — great for summer or finals. A paused membership keeps your spot for when you're back." },
    { q: "What if my house isn't signed up yet?", a: "Tell us where you are and we'll reach out about bringing us to your house." },
  ],
};
