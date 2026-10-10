# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-site.spec.ts >> demo accounts see navigation appropriate to their role
- Location: tests\e2e\public-site.spec.ts:23:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/dashboard$/
Received string:  "http://localhost:3001/sign-in"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="en" class="__variable_532bb9 __variable_4dc837">…</html>
       - unexpected value "http://localhost:3001/sign-in"

```

```yaml
- complementary:
  - link "CampusOS":
    - /url: /
  - paragraph: One Event. One Intelligence Layer.
  - heading "Run the whole hackathon from a single, accountable system." [level=2]
  - list:
    - listitem: Gemini screening that suggests — humans decide.
    - listitem: QR check-in, rooms and seats, exported in one click.
    - listitem: FairJudge flags score gaps for review, never labels judges.
  - paragraph: © 2026 CampusOS
- main:
  - text: Language
  - combobox "Language":
    - option "English" [selected]
    - option "हिन्दी"
  - heading "Welcome back" [level=1]
  - paragraph: Sign in to your CampusOS workspace.
  - text: Email
  - textbox "Email":
    - /placeholder: you@college.edu
    - text: admin@campusos.demo
  - text: Password
  - textbox "Password": Demo@1234
  - link "Forgot password?":
    - /url: /forgot-password
  - button "Signing in…" [disabled]
  - paragraph: Seeded demo accounts
  - paragraph: "Available after running the seed. Password: Demo@1234"
  - button "Organizer"
  - button "Participant"
  - button "Judge"
  - button "Admin"
  - paragraph:
    - text: New here?
    - link "Create an account":
      - /url: /sign-up
- alert
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | test("landing page presents the product and sign-in entry point", async ({ page }) => {
  4   |   await page.goto("/");
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
> 37  |     await expect(page).toHaveURL(/\/dashboard$/);
      |                        ^ Error: expect(page).toHaveURL(expected) failed
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
  105 |   await page.goto("/sign-in");
  106 |   await page.getByLabel("Email").fill("judge1@campusos.demo");
  107 |   await page.getByLabel("Password").fill("Demo@1234");
  108 |   await page.getByRole("button", { name: "Sign in" }).click();
  109 |   await page.goto("/judge");
  110 |   await page.getByRole("link", { name: /Lightrail/ }).click();
  111 |   await expect(page.getByRole("heading", { name: /Lightrail/ })).toBeVisible();
  112 |   for (const score of await page.locator('input[type="number"][name^="score_"]').all()) {
  113 |     await score.fill("8");
  114 |   }
  115 |   await page.getByLabel("Written feedback").fill(
  116 |     "The project addresses an important problem and gives users a clear, feasible reporting workflow.",
  117 |   );
  118 |   await page.getByRole("button", { name: "Submit evaluation" }).click();
  119 |   await expect(page.getByText("Submitted and locked")).toBeVisible();
  120 | 
  121 |   await page.context().clearCookies();
  122 |   await page.goto("/sign-in");
  123 |   await page.getByLabel("Email").fill("organizer@campusos.demo");
  124 |   await page.getByLabel("Password").fill("Demo@1234");
  125 |   await page.getByRole("button", { name: "Sign in" }).click();
  126 |   await page.goto("/events");
  127 |   const eventHref = await page.getByRole("link", { name: /Pink City Hack 2026/ }).first().getAttribute("href");
  128 |   expect(eventHref).toBeTruthy();
  129 |   const eventId = eventHref!.split("/").at(-1)!;
  130 |   await page.goto(`/events/${eventId}/fairjudge`);
  131 |   await expect(page.getByText(/Neer/).first()).toBeVisible();
  132 | });
  133 | 
```