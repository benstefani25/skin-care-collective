# Skin Care Collective — Consolidated Website Build Document

**Project:** `skin-care-collective` (Next.js 15 / React 19 / Supabase / Stripe / Anthropic SDK, App Router)
**What this is:** the single source of truth for the website/front-end build. It merges and supersedes four earlier docs (website notes, round-1 instructions, round-2 changes, content enrichment). Where earlier docs disagreed, this one reflects the **final decision** — notably the hero CTA (see §2), which changed between rounds.

**How to use:** build in the order below. Items are grouped: Part A is structure/UX, Part B is the page-by-page content (with ready copy), Part C is the round-2 functional changes (auth, waiver, ops agent), Part D is cross-cutting rules. Commit per item. Suggested PRs: (1) structure + content + the quick functional wins, (2) the read-only ops agent on its own (largest item).

---

## GLOBAL GUARDRAILS (apply to everything)
- **Express-only positioning.** Every SCC tan is the rapid-rinse type. NEVER mention "traditional," "overnight," "classic," or "Single" tans, or frame express as one option among several. Express isn't a choice SCC made — it's simply how an SCC tan works.
- **One consistent dark editorial identity across the ENTIRE site — see §A-0.** The dark espresso "Treatment B" theme must be applied to every page and surface, not just the landing hero. This REPLACES the current light cream theme. Hard requirement, called out first because it touches every other item.
- **Cosmetic, never medical.** Surface-level cosmetic framing only. No health claims, no "healthy," no sun-protection claims. Pair tan talk with "wear SPF as usual — a spray tan offers no sun protection."
- **Don't regress the app.** Booking engine, auth gates, the tech wall (techs never see member contact info), and the deterministic money paths are out of scope for content/UX work. If a change seems to require touching them, stop and flag.
- **All copy in `src/config/copy.ts`**, brand name via `config.brandName` (brand name isn't final — never hardcode it). Rinse-timing numbers in config with a "provisional" comment (see §B-Aftercare).
- **Mobile-first.** This audience is on phones; test every page/flow narrow.
- **No copied phrasing.** All copy is written fresh in SCC's voice — never lifted from any external source.
- **Before starting:** branch `web/consolidated`; establish a green baseline (`npm run typecheck`, build).

---

# PART A — Structure & UX

## A-0 — Apply the dark espresso editorial theme across the ENTIRE site  [do this FIRST — it governs every other page]
**Goal:** the founder has chosen a **dark, editorial "Treatment B" theme** (originally specced for the homepage hero) and wants it applied to the **whole website** — every marketing page, the signup/booking flow, member account pages, the tech surface, and the founder console. The entire site goes dark/editorial, not just the hero.

**IMPORTANT — this REPLACES the current theme.** The existing `src/app/globals.css` `:root` defines a *light warm cream* palette (cream bg, terracotta accent). That is the OLD look. Replace the global theme tokens with the dark espresso system below so the whole site adopts it. Do not leave any page on the cream palette.

**The dark editorial palette (canonical — define as the new `:root` tokens, use everywhere, never hardcode literals elsewhere):**
- **Hero background:** warm diagonal gradient (~115deg) from light warm tan `#b58e6e` -> mid-brown `#8f6a47` -> deep espresso `#4a3624`. Build so a real background photo can replace the gradient later via one CSS value — leave a clearly commented hook.
- **Hero scrim (over the gradient, for legibility):** vertical `rgba(20,16,12,0.55)` at top -> ~`0.45` near 38% -> `rgba(20,16,12,0.80)` at bottom; headline + CTAs sit on the darker lower portion. On mobile, raise scrim opacity slightly.
- **Page background (non-hero):** deep espresso, e.g. `#161310` / `#0f0d0b`. Use subtle tonal variation between page bg, cards, and hero — never one flat black-brown everywhere (flatness reads heavy/cheap).
- **Card / surface background:** lifted from page, e.g. `#1f1b16`.
- **Input/form field background:** lifted further with a visible border, e.g. bg `#221d18`, border `#4a443b` — critical so forms stay usable on dark (see legibility rules).
- **Headline / primary text:** near-white `#fbf8f2` (NOT pure white).
- **Body text:** soft warm off-white `#cfc7ba`; secondary/muted `#9a988f`. Never pure white on near-black.
- **Eyebrow / trust line / accents:** warm light tan `#e8ddd2`; warm gold `#d8a878` for small accents (rinse labels, active nav).
- **Primary button:** solid off-white fill `#f5f3ec`, near-black text `#1a1611`, **squared corners (`border-radius: 0`)**.
- **Secondary button:** transparent, thin `0.5px` light outline (`#cfc7ba` on hero, `#4a443b` on dark surfaces), off-white text, squared corners.
- **Type:** headlines/eyebrow/trust line in **Fraunces serif** (`--font-display`), near-white; body/nav/buttons clean sans (`--font-sans`).

**Legibility rules (make-or-break for an all-dark site — follow strictly):**
1. Body text soft off-white (`#cfc7ba`/`#e8ddd2`), never pure `#fff` on near-black.
2. Form inputs MUST have a lifted background and a clearly visible border so users can see where to type — never a field that blends into the page. This is the #1 dark-theme failure on functional pages (signup, booking, account).
3. Maintain tonal layering: page bg < card bg < input bg in lightness, so hierarchy is visible.
4. No flat pure-black; use the warm espresso tones above.
5. Check contrast specifically on the long-form pages (Prep, Aftercare, FAQ) — hardest to keep comfortable on dark.

**Do:**
1. **Replace the global theme** in `globals.css` with the dark espresso tokens above. Every page derives color from `:root`.
2. **Theme the hero** exactly to Treatment B (gradient + scrim + Fraunces headline + squared off-white primary button + tan eyebrow/trust line; left-aligned in the left ~70% on desktop, stacking on mobile).
3. **Theme marketing pages, signup/booking flow, member account, tech surface, and founder console** to the same dark system, applying the legibility rules — especially on forms and long-form content.
4. **Audit for hardcoded colors** (literal hex/rgb/off-palette grays) and replace with the new tokens. New color needed -> add a `:root` token, never a one-off literal.
5. **Every page/section built in Parts B-C uses these tokens from the start** — no cream-palette remnants.
**Reference:** read `/mnt/skills/public/frontend-design/SKILL.md` if present, but the palette above is authoritative.
**Verify:** visit every route (landing, how-it-works, tan-care, pricing, faq, contact, request-house, signup, login, member account, tech run sheet, founder console) — each is the dark espresso brand, hero matches Treatment B, all form inputs are clearly visible/typable on dark, long-form pages read comfortably, and a grep for hardcoded hex/rgb in components returns nothing outside `:root`.

## A-1 — Restyle login/signup affordances
**Problem:** member login/signup are oversized and dominate the landing page.
**Do:** move **Member login** to a small text link in the top-right nav (not a hero button). Demote signup from a hero slab to a normal button. The hero's primary CTA is the signup action (see A-2), not login. Header consistent across all marketing pages via a shared layout/nav component.
**Verify:** landing no longer leads with giant auth buttons; login is a quiet nav link; mobile header isn't dominated by auth.

## A-2 — Hero CTA: one signup button (house inside signup) + one "Request your house" button  [FINAL — supersedes the earlier two-button "Find your house" design]
**Decision history:** an earlier draft used two parallel house buttons ("Find your house" + "Bring SCC to your house"). **That is superseded.** Final design below — build only this.
**Do:**
1. Hero primary button: **"Sign Up"** → goes straight into the signup flow, where **step one is campus → house picker** (largely already exists in `/signup`). (Label decided as "Sign Up" for clarity over the earlier "Join your house"; keep it in `copy.ts` for easy revision.)
2. Inside the picker, if a member doesn't see her house: a clear **"Don't see your house? Request it →"** link to the new-house request form.
3. Hero secondary, lighter button: **"Request your house"** → the new-chapter/founding-member interest form (see A-3). This is the only genuinely separate action, so it's the only second button.
4. Remove any "Find your house" / "Bring SCC to your house" buttons from earlier work.
**Verify:** hero has a signup button (house chosen inside the flow) + one "Request your house" button; the in-signup "don't see your house" path reaches the request form; existing signup completes end to end.

## A-3 — New-house request form (founding-member / chapter interest)
**Problem:** the "Request your house" path and the in-signup "don't see your house" path need a destination.
**Do:** a simple interest form (`/request-house` or similar): campus, sorority/house name, submitter's name + contact, optional note. On submit, store the lead — either a lightweight `house_leads` table, or (zero schema change) an append-only `events` row `house_lead.submitted` with details in payload for the founder to read. Notify the founder (reuse the existing founder-notification path). Show a friendly confirmation.
**Safety:** public form — apply rate limiting (see D); never expose any existing house list through it.
**Verify:** submitting creates a lead record + notifies founder; confirmation shows; no public data leaks.

## A-4 — Shared marketing layout + clean nav
**Do:** a marketing layout with a consistent header (wordmark left; **How it works · Tan Care · Pricing · FAQ · Contact** center; "Member login" link + "Sign Up" button right) and a simple footer (contact, social, legal). Use the existing `Wordmark` component. Mobile: collapse nav into a simple menu. Lightweight — no heavy UI deps.
**Verify:** every marketing page shares header/footer; nav works on mobile; no layout shift.

---

# PART B — Pages & content (ready-to-use copy)

> All copy below goes in `copy.ts`. Edit to taste; it's written ready to use. Cosmetic framing throughout.

## B-1 — Home / landing
Restyled per A-1/A-2: hero with the come-to-you pitch, the express-tan benefit as subhead, a social-proof slot (testimonials when available), and the two CTAs. Pull the "same glow, none of the wait" idea (B-3 C-1) into the hero subhead in condensed form.

## B-2 — How it works
Explains the unusual model simply, plus two education blocks.

**Model explanation (4–6 short steps/sections):** we come to your house on a set schedule; one flat monthly membership; book in seconds (online or, later, by text); never pay your technician.

**Block — "Same glow. None of the wait." (timing-not-strength reassurance):**
> **Same glow. None of the wait.**
> An SCC tan develops just as deeply and lasts just as long as any professional spray tan — usually a glowing 5–7 days. The difference is simple: you don't have to sleep in it. Our express formula lets you rinse in just a few hours and get on with your day, while your color keeps developing to its full depth. Fast doesn't mean lighter, harsher, or rushed. It just means it fits your life.

**Block — "What to expect when your tech arrives" (trust-builder for the in-house experience):**
> Your appointment is quick, private, and professional — start to finish in about 15–20 minutes.
> 1. **A quick consult.** Your tech checks your skin tone and undertone and confirms the shade you're going for.
> 2. **Prep.** A light prep step helps the solution grip evenly for a smooth, streak-free finish.
> 3. **The airbrush application.** A custom, even coat — adjusted to you, not a one-size booth.
> 4. **Your rinse plan.** Before she leaves, your tech tells you exactly when to rinse to hit the shade you want.

End with links to Prep (arrive ready) and Aftercare (time the rinse right).

## B-3 — Tan Care: Preparation
**Heading:** Prep for the perfect glow

Great tans are made before we arrive. A little prep means smoother color, an even finish, and a tan that lasts. Here's all it takes.

**24 hours before**
- Exfoliate head to toe. Use an oil-free scrub and focus on dry spots — elbows, knees, ankles, knuckles. This sloughs off dead skin so color goes on even and fades evenly.
- Shave or wax at least 24 hours ahead. Doing it right before can leave color in the follicles and cause spotting.
- Get any other treatments done first — manicures, pedicures, facials, massages. Anything that scrubs or oils your skin should happen before the tan, not after.

**The day of**
- Come with clean skin and nothing on it — no lotion, no oil, no makeup, no deodorant, no perfume. These create a barrier the solution can't get through and cause uneven color. (If you've moisturized, a quick rinse beforehand fixes it.)
- Skip the heavy moisturizer that morning. Lightly hydrated is good; coated is not.
- Wear or bring loose, dark clothing and dark cotton underwear. After your session you'll want nothing tight against fresh color. Slip-on shoes, not sneakers.

**A quick word on our express formula**
Because our tans are designed to rinse in just a few hours, prep matters a little more, not less — clean, exfoliated, barrier-free skin is what lets the fast formula set evenly. Five minutes of prep is the difference between good and flawless.

## B-4 — Tan Care: Aftercare
**Heading:** Make it last

Your color keeps developing for about a day after your session, so the first 24 hours matter most. Treat your skin gently and your glow will go the distance.

**Right after (the first few hours)**
- Keep it dry. No sweating, no swimming, no washing the area until your first rinse. Water before you rinse will streak the color.
- Stay loose and covered. Wear the dark, loose clothing you brought. Avoid tight straps, waistbands, and anything that rubs.
- A little color transfer onto clothes at this stage is normal cosmetic bronzer — it washes out.

**You choose your shade by when you rinse**
Our express formula puts the final depth in your hands:
- Rinse around **3 hours** for a soft, natural daytime glow.
- Wait closer to **4–5 hours** for a deeper, event-ready tan.
- Going much longer than that won't make you darker — it only risks streaking or dry patches, so stick to your window.
Rinse in lukewarm water with no soap or scrubbing until the water runs clear. The bronzer washing away is normal — your real color keeps developing for the next 12–24 hours. Pat dry, never rub.
> **CONFIG NOTE for Claude Code:** wrap the "3" and "4–5" hour values in config constants with a comment: `// provisional rinse windows — replace with the chosen tan solution's actual instructions`. These are working placeholders, not final.

**The days after (keep the glow)**
- Moisturize morning and night, every day. Hydrated skin holds color; dry skin flakes and fades. Use an oil-free, fragrance-light lotion.
- Take shorter, cooler showers and pat dry. Long hot showers and vigorous towels are a tan's worst enemy.
- Skip exfoliating scrubs, retinols, and acids while you want the color — they speed fading.
- Avoid long soaks, chlorine, and salt water; pat dry quickly when you do get wet.
- Sunscreen still matters. A spray tan offers **no** sun protection — wear SPF as you normally would.

**Between visits**
You're on a recurring schedule, so you never have to think about timing — your next tan is already coming. Light moisturizing and gentle skin habits in between keep you glowing right up to the next visit.

## B-5 — Pricing / Membership
Flat-membership story; **every SCC tan is the express type** (the short wait is the headline benefit, not an upsell). Use the timing-not-strength framing. Include the membership price (config-driven — do **not** hardcode; the price decision lives in config/per-house pricing), the semester-prepay option if implemented, and the trust line: *"Your membership is billed to your card on file. You'll never pay your technician at an appointment."* (See C-3 for placement of this line.)

## B-6 — FAQ
Accordion or headed list. Short, honest, cosmetic framing.
> **Is a spray tan safe for my skin?**
> Yes. The color comes from DHA, an ingredient that reacts only with the outermost, already-dead layer of your skin — a surface-level cosmetic reaction, a bit like how bread browns. It doesn't soak into living skin and doesn't change how your skin naturally makes pigment. As your skin renews, the tan fades gradually and evenly.
>
> **Does it offer any sun protection?**
> No — a spray tan is purely cosmetic and gives you no protection from the sun. Keep wearing SPF exactly as you normally would.
>
> **Will the quick rinse time make my tan lighter or lower-quality?**
> Not at all. "Express" refers only to how soon you rinse — the tan still develops fully and lasts the usual 5–7 days. You're just not sleeping in it.
>
> **How long until I can shower?**
> A few hours — you time your rinse to the shade you want (see Aftercare).
>
> **What do I wear?**
> Loose, dark clothing; see Prep.
>
> **Have sensitive skin, allergies, or other concerns?**
> Just ask your tech about a patch test.
>
> **Do I pay my technician?**
> Never. Everything runs through your membership and your card on file — you'll never be asked to pay your tech at an appointment. (If anyone ever asks, tell us.)
>
> **Can I pause or cancel?**
> Yes, anytime from your account — great for summer.

## B-7 — Contact
Simple contact form + the brand SMS line framed as "you can also just text us" (live once Twilio is set up). Route submissions like A-3 (event/table + founder notification); apply rate limiting.

## B-8 — (Deferred) About / Our Story
Build later, once real photos/testimonials exist. Intentionally not built now.

---

# PART C — Functional changes (round 2)

## C-1 — Persistent sessions + password login for staff
**Decided:** members keep magic links; **persistent sessions for all roles**; **real password login for staff** (founder + techs).
**Do:**
1. Configure Supabase for long-lived sessions / refresh-token persistence so a login lasts weeks; default "keep me logged in"; session survives browser restarts.
2. Enable email+password login for founder and tech accounts alongside magic links (a "staff login" toggle or `/staff-login` route; members still see magic-link flow).
3. Provide a way for founder to set their password and techs to set theirs on first login. Keep it simple.
4. Preserve role resolution in `src/lib/auth.ts` (`requireFounder`/`requireTech`/`requireMember`) — only the auth *method* changes, not authorization.
**Security:** passwords handled by Supabase Auth (hashed); never log credentials; don't weaken founder/tech gates.
**Verify:** founder logs in with password once, stays logged in across restarts; tech same; member still gets magic link; wrong password rejected; gates still block non-staff.

## C-1b — Deferred billing: save card at signup, charge at launch (Option B / SetupIntent)  [HIGH PRIORITY — affects whether founding sign-ups are charged correctly]
**Goal:** during the pre-launch founding-member drive, collect and save each member's card at signup but **do not charge them**. Charge happens later, per house, when service actually launches (target: early August). The founder triggers billing; Stripe does not auto-charge.

**Why this is a real change:** the current `src/app/signup/actions.ts` creates a `mode: "subscription"` Checkout session, which **charges the first month immediately** on completion. That must change, or every founding sign-up is billed now.

**Decided approach: Option B — SetupIntent now, subscription created later.** (Not a trial-based subscription. The founder converts saved-card members to active subscriptions per house at launch.)

**Do:**
1. **Signup saves the card, does not subscribe.** Replace the subscription Checkout with a **`mode: "setup"` Stripe Checkout session** (hosted page, so no raw card handling) that saves the payment method to the member's Stripe customer. Do NOT create a subscription at signup. Keep creating the Stripe customer as today.
2. **New member status `card_on_file`.** Add a status value (e.g. `card_on_file`) distinct from `pending` (signup incomplete) and `active` (being billed). On successful SetupIntent, set the member to `card_on_file`, store the saved payment method id and set it as the customer's default for invoices. Update the Stripe webhook to handle setup completion (`checkout.session.completed` with `mode=setup`) -> mark `card_on_file`, log an event.
3. **Keep these members OUT of active flows until launch.** Confirm standing-appointment generation books only `active` members (it already filters to active — verify `card_on_file` is excluded). Founder console should show `card_on_file` members as a distinct pre-launch count, not as paying members.
4. **Launch action (the "charge them" trigger) — per house.** Build a founder-only admin action: for a chosen house, for each `card_on_file` member, create the real monthly subscription against the saved card (charging the first month now) and on success move them to `active`. Per-house so campuses launch independently. Write an event per conversion. Implement as an admin-console button and/or a script (`scripts/launch-house.ts`).
5. **Handle charge failures gracefully (critical for Option B).** Because cards are charged months after capture, expect a real failure rate (expired/replaced cards, insufficient funds). On a failed first charge at launch: set a clear status (e.g. `payment_failed`, or reuse `past_due`), do NOT mark active, and notify the member with a link to update their card (reuse the tokenized billing-portal route `src/app/billing/[token]/route.ts`). Surface these on the founder console exceptions feed. Never silently drop a member.
6. **Disclosure copy at signup (trust + card-network requirement).** Clearly state at the card step: e.g. "We're saving your card now — you won't be charged until {brandName} launches at your house. We'll let you know before your first charge." Put copy in `copy.ts`. Deferred billing that isn't clearly disclosed drives chargebacks and complaints (and this audience compares notes), so this must be unambiguous.
7. **Member-facing state.** A `card_on_file` member logging in should see a clear "You're all set — you'll be charged when we launch at your house" state, not an empty dashboard implying active service.

**Stripe mode:** test end-to-end in **test mode** first — confirm the saved card persists and the launch action creates the subscription and charges it. Only collect real founding members in **live mode**, and confirm which mode the live site is in before going live.

**Verify:** a test signup saves a card with NO charge and NO subscription (member = `card_on_file`); the member is not auto-booked; the per-house launch action converts them to `active` with exactly one first charge; a deliberately failing test card at launch marks the member failed + notifies + appears in founder exceptions without becoming active; signup clearly discloses deferred billing.

## C-2 — Reposition the "never pay your technician" line
**Problem:** the line floats oddly on the marketing page.
**Do:** remove from its odd spot; place it where it does its two jobs — (1) the **signup/checkout step** ("Your membership is billed to your card on file. You'll never pay your technician at an appointment.") and (2) the **FAQ** (B-6, already included). Copy in `copy.ts`.
**Verify:** no longer floating on landing; present at checkout and in FAQ.

## C-3 — E-signature waiver + SMS consent at signup
**Decided:** an e-signature step, implemented as an **in-house typed-signature + immutable timestamped record** (not a third-party integration; swappable later if legal review requires).
**Do:**
1. Add a waiver/consent step to signup **before payment completes.** Show the waiver text; require the member to type her full legal name as signature and check an explicit agreement box.
2. **Record immutably:** member id, waiver **version**, typed name, timestamp, and ideally IP/user-agent. Write to append-only `events` (`consent.waiver_signed`) and/or a dedicated `consents` table. Never editable after the fact. Version the waiver text.
3. Block signup completion without a signed waiver.
4. **Capture SMS consent in the same step** (separate checkbox: "I agree to receive text messages about my appointments"), recorded the same immutable way — this makes SCC A2P-ready when Twilio goes live.
**Waiver content guidance (for the founder's legal reviewer to refine):** acknowledge that members with asthma, highly reactive skin, known fragrance/cosmetic sensitivities, or who are pregnant should consult their healthcare provider before a first tan; offer a patch test on request; instruct that if intense itching, irritation, or breathing difficulty occurs, rinse immediately and seek medical advice; frame as **cosmetic-service consent, not medical**.
**Compliance flags (surface in PR):** waiver content needs legal review before reliance; in-house e-signature is generally workable for this consent type but is not identity-verified like DocuSign — note the swap path.
**Verify:** signup can't complete without typed signature + checked agreement; immutable consent record with version + timestamp written; SMS consent captured separately; record visible to founder (member detail page) but never editable.

## C-4 — Hide the dead ops chatbot now; build the real read-only ops agent  [largest item — own PR]
**Problem:** the founder console shows a chat UI wired to nothing. (Confirmed: no founder ops agent exists yet. Existing agents: concierge (SMS, Twilio-blocked), tech copilot (works), QC digest (a generated report, not a chat).)
**Do — immediately (small):** hide/remove the non-functional ops chat UI; leave a clean "Ops assistant — coming soon" placeholder or remove entirely so nothing broken is visible.
**Do — the real build (larger, separate PR):** a **read-only** founder ops agent:
1. Founder-only chat in the console, Claude API, with **read-only** tools over `events`, `visits`, `appointments`, `payroll`/`bonus_ledger`, `surveys`, exceptions. **No mutating tools bound** — physically cannot change data.
2. Never sends externally (no SMS, no house-director messages); may *draft* text for the founder to copy. Same guardrails as the concierge: honest about being AI; medical flagged not advised; never recomputes pay (reads computed values only).
3. Reuse prompt-versioning in `src/config/prompts.ts` and the Anthropic patterns in `src/lib/concierge.ts` / `copilot.ts`.
4. Optionally unify with the weekly QC digest (`src/lib/qc.ts`) so one agent powers both the morning brief and ask-anytime; the interactive chat is the priority.
**Verify:** founder asks "what's my labor cost and outstanding deferred liability this month" → correct answer from real data; asking it to change/cancel/charge anything is impossible (no such tool); never emits SMS; non-founders can't reach it.

---

# PART D — Cross-cutting requirements
- **Rate limiting** on all public mutation endpoints (signup, request-house form, contact form, and the inbound SMS path once live) — lightweight, dependency-light.
- **No medical/health claims anywhere**, especially the waiver (cosmetic-consent framing) and any skin-science copy. SPF/no-sun-protection line on Aftercare and FAQ.
- **All customer-facing copy in `copy.ts`; brand name via `config.brandName`.**
- **Mobile-first**; test every changed page/flow narrow.
- Commit per item.

## Suggested PRs
1. **Main web pass:** Parts A, B, and functional items C-1, C-2, C-3 + the *hide* half of C-4.
2. **Ops agent:** the real-build half of C-4, on its own — it's the largest, most complex item and shouldn't gate the quick wins.

## Human follow-ups to flag in PR descriptions
- Waiver text needs legal review before reliance (C-3).
- Founder sets staff passwords / decides tech password onboarding (C-1).
- Confirm membership price shown matches the founder's decision (pricing reconciliation — tracked separately in the hardening doc, item T1-1).
- Rinse-timing numbers are provisional placeholders — replace with the chosen tan solution's real instructions (B-4).
- Hero button labels: primary = "Sign Up", secondary = "Request your house" (decided; both in `copy.ts`).
- Ops agent (C-4 build) priority vs. shipping the quick wins first.
- Deferred billing (C-1b): confirm target launch/charge date per campus and confirm live-mode Stripe before collecting real founding members.
