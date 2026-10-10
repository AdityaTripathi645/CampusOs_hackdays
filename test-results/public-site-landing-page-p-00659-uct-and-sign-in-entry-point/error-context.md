# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-site.spec.ts >> landing page presents the product and sign-in entry point
- Location: tests\e2e\public-site.spec.ts:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3001/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "CampusOS" [ref=e5] [cursor=pointer]:
        - /url: /
      - navigation [ref=e12]:
        - link "Capabilities" [ref=e13] [cursor=pointer]:
          - /url: "#capabilities"
        - link "Events" [ref=e14] [cursor=pointer]:
          - /url: "#events"
        - link "Sign in" [ref=e15] [cursor=pointer]:
          - /url: /sign-in
        - link "Get started" [ref=e16] [cursor=pointer]:
          - /url: /sign-up
  - generic [ref=e19]:
    - paragraph [ref=e20]: Hackathon & campus event operating system
    - heading "One Event. One Intelligence Layer." [level=1] [ref=e22]: One Event.One Intelligence Layer.
    - paragraph [ref=e23]: CampusOS runs the entire event lifecycle — from registration and teams to Gemini-assisted screening, QR attendance, private judging, discrepancy review and published results — on one shared, auditable data model.
    - generic [ref=e24]:
      - link "Start an event" [ref=e25] [cursor=pointer]:
        - /url: /sign-up
      - link "Browse events" [ref=e28] [cursor=pointer]:
        - /url: "#events"
    - generic [ref=e30]:
      - generic [ref=e31]:
        - generic [ref=e35]: Create
        - generic [ref=e36]: "01"
      - generic [ref=e37]:
        - generic [ref=e44]: Register & team
        - generic [ref=e45]: "02"
      - generic [ref=e46]:
        - generic [ref=e52]: Submit
        - generic [ref=e53]: "03"
      - generic [ref=e54]:
        - generic [ref=e64]: AI screen
        - generic [ref=e65]: "04"
      - generic [ref=e66]:
        - generic [ref=e74]: Check in
        - generic [ref=e75]: "05"
      - generic [ref=e76]:
        - generic [ref=e84]: Judge
        - generic [ref=e85]: "06"
      - generic [ref=e86]:
        - generic [ref=e92]: FairJudge
        - generic [ref=e93]: "07"
      - generic [ref=e94]:
        - generic [ref=e102]: Results
        - generic [ref=e103]: "08"
  - generic [ref=e105]:
    - paragraph [ref=e106]: Capabilities
    - heading "Built for the 36 hours where everything happens at once." [level=2] [ref=e107]
    - generic [ref=e108]:
      - generic [ref=e109]:
        - heading "Gemini screening, human decisions" [level=3] [ref=e119]
        - paragraph [ref=e120]: Summaries, track fit, rubric-aligned observations, missing info and evidence quotes — every output schema-validated and clearly marked as a suggestion until a reviewer accepts or overrides it.
      - generic [ref=e121]:
        - heading "QR check-in & logistics" [level=3] [ref=e129]
        - paragraph [ref=e130]: Each approved participant gets an ID card with a unique QR. Scan with a camera or USB scanner, auto-allocate rooms and seats, and export attendance as CSV.
      - generic [ref=e131]:
        - heading "Private, rubric-based judging" [level=3] [ref=e139]
        - paragraph [ref=e140]: Balanced auto-assignment with conflict checks. Judges score against weighted criteria and only ever see their own evaluations.
      - generic [ref=e141]:
        - heading "FairJudge review" [level=3] [ref=e147]
        - paragraph [ref=e148]: After an authorised reveal, large score differences are flagged for review tickets with recorded decisions and a full audit trail — without ever labelling a judge as biased.
      - generic [ref=e149]:
        - heading "Live command center" [level=3] [ref=e158]
        - paragraph [ref=e159]: Milestones, registrations, submissions, attendance, judging progress and operational alerts in one view — plus a Gemini assistant grounded in your event's live numbers.
      - generic [ref=e160]:
        - heading "Accountable by design" [level=3] [ref=e165]
        - paragraph [ref=e166]: Server-side role and ownership checks on every action, configurable scoring methods, publication gates, and an append-only audit log.
  - generic [ref=e168]:
    - generic [ref=e169]:
      - generic [ref=e170]:
        - paragraph [ref=e171]: Event overview
        - heading "Open and upcoming events" [level=2] [ref=e172]
      - link "Register for an event" [ref=e173] [cursor=pointer]:
        - /url: /sign-up
    - generic [ref=e176]:
      - generic [ref=e177]:
        - generic [ref=e178]:
          - generic [ref=e179]: Live
          - generic "Seeded demo record — not real data" [ref=e181]: Demo
        - heading "Pink City Hack 2026" [level=3] [ref=e184]
        - paragraph [ref=e185]: 36 hours to build for Rajasthan's campuses and cities
        - generic [ref=e186]:
          - paragraph [ref=e187]: 9 Oct 2026 – 14 Oct 2026
          - paragraph [ref=e190]: Innovation Centre, Jaipur
        - generic [ref=e194]:
          - generic [ref=e195]: Campus Life
          - generic [ref=e196]: Civic Tech
          - generic [ref=e197]: Climate & Water
        - link "View event" [ref=e199] [cursor=pointer]:
          - /url: /sign-up
      - generic [ref=e202]:
        - generic [ref=e203]:
          - generic [ref=e204]: Published
          - generic "Seeded demo record — not real data" [ref=e205]: Demo
        - heading "AI for Bharat Ideathon" [level=3] [ref=e208]
        - paragraph [ref=e209]: Pitch an AI idea that works in every Indian language
        - generic [ref=e210]:
          - paragraph [ref=e211]: 25 Oct 2026 – 26 Oct 2026
          - paragraph [ref=e214]: Online + Main Auditorium
        - generic [ref=e218]:
          - generic [ref=e219]: Agri AI
          - generic [ref=e220]: Health AI
          - generic [ref=e221]: Language AI
        - link "View event" [ref=e223] [cursor=pointer]:
          - /url: /sign-up
  - contentinfo [ref=e226]:
    - generic [ref=e227]:
      - link "CampusOS" [ref=e228] [cursor=pointer]:
        - /url: /
      - paragraph [ref=e235]: One Event. One Intelligence Layer.
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | test("landing page presents the product and sign-in entry point", async ({ page }) => {
> 4   |   await page.goto("/");
      |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  5   |   await expect(page.getByRole("heading", { name: /One Event\./ })).toBeVisible();
  6   |   await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  7   |   await expect(page.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "#events");
  8   | });
  9   | 
  10  | test("sign-in page exposes labeled credentials and account recovery", async ({ page }) => {
  11  |   await page.goto("/sign-in");
  12  |   await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  13  |   await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  14  |   await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  15  |   await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  16  | });
  17  | 
  18  | test("anonymous visitors are redirected away from the dashboard", async ({ page }) => {
  19  |   await page.goto("/dashboard");
  20  |   await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  21  | });
  22  | 
  23  | test("demo accounts see navigation appropriate to their role", async ({ page }) => {
  24  |   const cases = [
  25  |     { email: "admin@campusos.demo", required: ["Events", "Audit log"], forbidden: ["Explore events", "Judge workspace"] },
  26  |     { email: "organizer@campusos.demo", required: ["Events", "Audit log"], forbidden: ["Explore events", "Judge workspace"] },
  27  |     { email: "participant14@campusos.demo", required: ["Explore events", "My events"], forbidden: ["Events", "Judge workspace", "Audit log"] },
  28  |     { email: "judge1@campusos.demo", required: ["Judge workspace"], forbidden: ["Events", "Explore events", "Audit log"] },
  29  |   ];
  30  | 
  31  |   for (const account of cases) {
  32  |     await page.context().clearCookies();
  33  |     await page.goto("/sign-in");
  34  |     await page.getByLabel("Email").fill(account.email);
  35  |     await page.getByLabel("Password").fill("Demo@1234");
  36  |     await page.getByRole("button", { name: "Sign in" }).click();
  37  |     await expect(page).toHaveURL(/\/dashboard$/);
  38  |     for (const label of account.required) {
  39  |       await expect(page.getByRole("navigation").getByRole("link", { name: label, exact: true })).toBeVisible();
  40  |     }
  41  |     for (const label of account.forbidden) {
  42  |       await expect(page.getByRole("navigation").getByRole("link", { name: label, exact: true })).toHaveCount(0);
  43  |     }
  44  |   }
  45  | });
  46  | 
  47  | test("participant14 creates a team and saves a draft submission", async ({ page }) => {
  48  |   await page.goto("/sign-in");
  49  |   await page.getByLabel("Email").fill("participant14@campusos.demo");
  50  |   await page.getByLabel("Password").fill("Demo@1234");
  51  |   await page.getByRole("button", { name: "Sign in" }).click();
  52  |   await expect(page).toHaveURL(/\/dashboard$/);
  53  | 
  54  |   await page.goto("/explore/pink-city-hack-2026");
  55  |   await page.getByLabel("Team name").fill("E2E Campus Builders");
  56  |   await page.getByRole("button", { name: "Create team" }).click();
  57  |   await expect(page.getByText("E2E Campus Builders")).toBeVisible();
  58  | 
  59  |   await page.getByRole("link", { name: "Start submission" }).click();
  60  |   await page.getByLabel("Project title").fill("Campus Cooling Map");
  61  |   await page.getByLabel("Abstract").fill(
  62  |     "A practical campus heat map that helps students find shaded routes and cooler study spaces.",
  63  |   );
  64  |   await page.getByRole("button", { name: "Save draft" }).click();
  65  |   await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  66  | });
  67  | 
  68  | test("organizer approves a pending participant and checks them in with their code", async ({ page }) => {
  69  |   await page.goto("/sign-in");
  70  |   await page.getByLabel("Email").fill("organizer@campusos.demo");
  71  |   await page.getByLabel("Password").fill("Demo@1234");
  72  |   await page.getByRole("button", { name: "Sign in" }).click();
  73  |   await expect(page).toHaveURL(/\/dashboard$/);
  74  | 
  75  |   await page.goto("/events");
  76  |   const eventHref = await page.getByRole("link", { name: /Pink City Hack 2026/ }).first().getAttribute("href");
  77  |   expect(eventHref).toBeTruthy();
  78  |   const eventId = eventHref!.split("/").at(-1)!;
  79  |   await page.goto(`/events/${eventId}/participants`);
  80  |   const pendingParticipant = page.getByRole("row").filter({ hasText: "participant15@campusos.demo" });
  81  |   await pendingParticipant.getByRole("button", { name: "Approve" }).click();
  82  |   await expect(pendingParticipant.getByText("Approved")).toBeVisible();
  83  | 
  84  |   await page.context().clearCookies();
  85  |   await page.goto("/sign-in");
  86  |   await page.getByLabel("Email").fill("participant15@campusos.demo");
  87  |   await page.getByLabel("Password").fill("Demo@1234");
  88  |   await page.getByRole("button", { name: "Sign in" }).click();
  89  |   await page.goto("/explore/pink-city-hack-2026");
  90  |   const code = (await page.locator("p.font-mono").filter({ hasText: /^CO-/ }).innerText()).trim();
  91  | 
  92  |   await page.context().clearCookies();
  93  |   await page.goto("/sign-in");
  94  |   await page.getByLabel("Email").fill("organizer@campusos.demo");
  95  |   await page.getByLabel("Password").fill("Demo@1234");
  96  |   await page.getByRole("button", { name: "Sign in" }).click();
  97  |   await page.goto(`/events/${eventId}/operations`);
  98  |   await page.getByLabel("Check-in code").fill(code);
  99  |   await page.getByRole("button", { name: "Check in" }).click();
  100 |   await expect(page.getByText("participant15@campusos.demo")).toBeVisible();
  101 |   await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
  102 | });
  103 | 
  104 | test("judge submits Lightrail scores and the organizer sees Neer flagged for review", async ({ page }) => {
```