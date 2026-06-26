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
    ctaFindHouse: "Sign Up", // A-2 (FINAL) — primary CTA into the signup flow (house picked inside)
    ctaBringScc: "Request your house",
    heroEyebrow: "Cosmetic sunless tanning, delivered",
    heroTrust: "We come to you · card on file · pause anytime",
    // R2-3: reassurance at the moment of payment (also lives in the FAQ).
    checkoutNeverPay:
      "Your membership is billed to the card on file. You'll never pay your technician at an appointment.",
    // C-1b: deferred billing disclosure — shown at the card-save step and on
    // the card_on_file member dashboard. Card-network requirement: must be
    // unambiguous before the SetupIntent completes.
    deferredBillingDisclosure:
      "We're saving your card now — you won't be charged until we launch at your house. We'll let you know before your first charge.",
    deferredBillingDashboard:
      "You're all set! Your card is saved and your spot is reserved. We'll charge your first month and notify you when we launch at your house.",
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
      "Skin-conscious spray tans delivered to your house on a set schedule — one flat monthly membership, booked in seconds.",
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
    waiverSignLabel: "Type your full legal name to sign",
    waiverSignRequired: "Please type your full legal name to sign the waiver.",
    smsConsentLabel: "I agree to receive text messages about my appointments (reminders, scheduling).",
    smsConsentRequired: "Text-message consent is required so we can confirm and remind you about visits.",

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
      { title: "Rinse in a few hours", body: "Get on with your day — you time your rinse to the shade you want. More on Tan Care and Pricing." },
    ],
    sameGlowTitle: "Same glow. None of the wait.",
    sameGlowBody:
      "An SCC tan develops just as deeply and lasts just as long as any professional spray tan. The difference is simple: you don't have to sleep in it. Our express formula lets you rinse in just a few hours and get on with your day, while your color keeps developing to its full depth. Fast doesn't mean lighter, harsher, or rushed. It just means it fits your life.",
    expectTitle: "What to expect when your tech arrives",
    expectIntro: "Your appointment is quick, private, and professional — start to finish in about 15–20 minutes.",
    expectSteps: [
      { title: "A quick consult", body: "Your tech checks your skin tone and undertone and confirms the shade you're going for." },
      { title: "Prep", body: "A light prep step helps the solution grip evenly for a smooth, streak-free finish." },
      { title: "The airbrush application", body: "A custom, even coat — adjusted to you, not a one-size booth." },
      { title: "Your rinse plan", body: "Before she leaves, your tech tells you exactly when to rinse to hit the shade you want." },
    ],
  },

  tanCare: {
    prepTitle: "Prep for the perfect glow",
    prepIntro:
      "Great tans are made before we arrive. A little prep means smoother color, an even finish, and a tan that lasts. Here's all it takes.",
    prepBeforeTitle: "24 hours before",
    prepBefore: [
      "Exfoliate head to toe. Use an oil-free scrub and focus on dry spots — elbows, knees, ankles, knuckles. This sloughs off dead skin so color goes on even and fades evenly.",
      "Shave or wax at least 24 hours ahead. Doing it right before can leave color in the follicles and cause spotting.",
      "Get any other treatments done first — manicures, pedicures, facials, massages. Anything that scrubs or oils your skin should happen before the tan, not after.",
    ],
    prepDayOfTitle: "The day of",
    prepDayOf: [
      "Come with clean skin and nothing on it — no lotion, no oil, no makeup, no deodorant, no perfume. These create a barrier the solution can't get through and cause uneven color. (If you've moisturized, a quick rinse beforehand fixes it.)",
      "Skip the heavy moisturizer that morning. Lightly hydrated is good; coated is not.",
      "Wear or bring loose, dark clothing and dark cotton underwear. After your session you'll want nothing tight against fresh color. Slip-on shoes, not sneakers.",
    ],
    prepExpressNote:
      "Because our tans are designed to rinse in just a few hours, prep matters a little more, not less — clean, exfoliated, barrier-free skin is what lets the fast formula set evenly. Five minutes of prep is the difference between good and flawless.",

    aftercareTitle: "Make it last",
    aftercareIntro:
      "Your color keeps developing for about a day after your session, so the first 24 hours matter most. Treat your skin gently and your glow will go the distance.",
    aftercareRightAfterTitle: "Right after (the first few hours)",
    aftercareRightAfter: [
      "Keep it dry. No sweating, no swimming, no washing the area until your first rinse. Water before you rinse will streak the color.",
      "Stay loose and covered. Wear the dark, loose clothing you brought. Avoid tight straps, waistbands, and anything that rubs.",
      "A little color transfer onto clothes at this stage is normal cosmetic bronzer — it washes out.",
    ],
    rinseTitle: "You choose your shade by when you rinse",
    rinseIntro: "Our express formula puts the final depth in your hands:",
    rinseLines: [
      `Rinse around ${config.rinseSoftHours} hours for a soft, natural daytime glow.`,
      `Wait closer to ${config.rinseDeeperHours} hours for a deeper, event-ready tan.`,
      "Going much longer than that won't make you darker — it only risks streaking or dry patches, so stick to your window.",
    ],
    rinseHow:
      "Rinse in lukewarm water with no soap or scrubbing until the water runs clear. The bronzer washing away is normal — your real color keeps developing for the next 12–24 hours. Pat dry, never rub.",
    aftercareDaysTitle: "The days after (keep the glow)",
    aftercareDays: [
      "Moisturize morning and night, every day. Hydrated skin holds color; dry skin flakes and fades. Use an oil-free, fragrance-light lotion.",
      "Take shorter, cooler showers and pat dry. Long hot showers and vigorous towels are a tan's worst enemy.",
      "Skip exfoliating scrubs, retinols, and acids while you want the color — they speed fading.",
      "Avoid long soaks, chlorine, and salt water; pat dry quickly when you do get wet.",
      "Sunscreen still matters. A spray tan offers no sun protection — wear SPF as you normally would.",
    ],
    betweenTitle: "Between visits",
    betweenBody:
      "You're on a recurring schedule, so you never have to think about timing — your next tan is already coming. Light moisturizing and gentle skin habits in between keep you glowing right up to the next visit.",
  },

  pricingPage: {
    title: "Membership",
    intro: "One flat price, a fresh tan on your schedule, and nothing to pay at your appointment.",
    expressTitle: "Same glow. None of the wait.",
    expressBody:
      "An SCC tan develops just as deeply and lasts just as long. You simply don't have to sleep in it: rinse in just a few hours, time it to the shade you want, and get on with your day. Fast doesn't mean lighter or rushed. It's just how an SCC tan works.",
    includesTitle: "What's included",
    includes: [
      "Recurring visits to your house on its set schedule",
      "Your shade kept on file, so every tan matches",
      "One-tap rescheduling and skipping, online or by text",
      "Auto-booking each visit — never miss your spot",
    ],
    neverPay: "Your membership is billed to your card on file. You'll never pay your technician at an appointment.",
  },

  faqItems: [
    { q: "Is a spray tan safe for my skin?", a: "Yes. The color comes from DHA, an ingredient that reacts only with the outermost, already-dead layer of your skin — a surface-level cosmetic reaction, a bit like how bread browns. It doesn't soak into living skin and doesn't change how your skin naturally makes pigment. As your skin renews, the tan fades gradually and evenly." },
    { q: "Does it offer any sun protection?", a: "No — a spray tan is purely cosmetic and gives you no protection from the sun. Keep wearing SPF exactly as you normally would." },
    { q: "Will the quick rinse time make my tan lighter or lower-quality?", a: "Not at all. “Express” refers only to how soon you rinse — the tan still develops fully and lasts just as long. You're just not sleeping in it." },
    { q: "How long until I can shower?", a: "A few hours — you time your rinse to the shade you want (see Tan Care)." },
    { q: "What do I wear?", a: "Loose, dark clothing; see Prep." },
    { q: "Have sensitive skin, allergies, or other concerns?", a: "Just ask your tech about a patch test." },
    { q: "Do I pay my technician?", a: "Never. Everything runs through your membership and your card on file — you'll never be asked to pay your tech at an appointment. (If anyone ever asks, tell us.)" },
    { q: "Can I pause or cancel?", a: "Yes, anytime from your account — great for summer." },
  ],
};
