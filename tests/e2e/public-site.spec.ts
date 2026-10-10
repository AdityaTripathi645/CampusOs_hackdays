import { expect, test } from "@playwright/test";

test("landing page presents the product and sign-in entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One Event\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "#events");
});

test("sign-in page exposes labeled credentials and account recovery", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
});

test("anonymous visitors are redirected away from the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
});

test("demo accounts see navigation appropriate to their role", async ({ page }) => {
  const cases = [
    { email: "admin@campusos.demo", required: ["Events", "Audit log"], forbidden: ["Explore events", "Judge workspace"] },
    { email: "organizer@campusos.demo", required: ["Events", "Audit log"], forbidden: ["Explore events", "Judge workspace"] },
    { email: "participant14@campusos.demo", required: ["Explore events", "My events"], forbidden: ["Events", "Judge workspace", "Audit log"] },
    { email: "judge1@campusos.demo", required: ["Judge workspace"], forbidden: ["Events", "Explore events", "Audit log"] },
  ];

  for (const account of cases) {
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill("Demo@1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (const label of account.required) {
      await expect(page.getByRole("navigation").getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    for (const label of account.forbidden) {
      await expect(page.getByRole("navigation").getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
  }
});

test("participant14 creates a team and saves a draft submission", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("participant14@campusos.demo");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/explore/pink-city-hack-2026");
  await page.getByLabel("Team name").fill("E2E Campus Builders");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText("E2E Campus Builders")).toBeVisible();

  await page.getByRole("link", { name: "Start submission" }).click();
  await page.getByLabel("Project title").fill("Campus Cooling Map");
  await page.getByLabel("Abstract").fill(
    "A practical campus heat map that helps students find shaded routes and cooler study spaces.",
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
});

test("organizer approves a pending participant and checks them in with their code", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("organizer@campusos.demo");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/events");
  const eventHref = await page.getByRole("link", { name: /Pink City Hack 2026/ }).first().getAttribute("href");
  expect(eventHref).toBeTruthy();
  const eventId = eventHref!.split("/").at(-1)!;
  await page.goto(`/events/${eventId}/participants`);
  const pendingParticipant = page.getByRole("row").filter({ hasText: "participant15@campusos.demo" });
  await pendingParticipant.getByRole("button", { name: "Approve" }).click();
  await expect(pendingParticipant.getByText("Approved")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("participant15@campusos.demo");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/explore/pink-city-hack-2026");
  const code = (await page.locator("p.font-mono").filter({ hasText: /^CO-/ }).innerText()).trim();

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("organizer@campusos.demo");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto(`/events/${eventId}/operations`);
  await page.getByLabel("Check-in code").fill(code);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("participant15@campusos.demo")).toBeVisible();
  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
});

test("judge submits Lightrail scores and the organizer sees Neer flagged for review", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("judge1@campusos.demo");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/judge");
  await page.getByRole("link", { name: /Lightrail/ }).click();
  await expect(page.getByRole("heading", { name: /Lightrail/ })).toBeVisible();
  for (const score of await page.locator('input[type="number"][name^="score_"]').all()) {
    await score.fill("8");
  }
  await page.getByLabel("Written feedback").fill(
    "The project addresses an important problem and gives users a clear, feasible reporting workflow.",
  );
  await page.getByRole("button", { name: "Submit evaluation" }).click();
  await expect(page.getByText("Submitted and locked")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("organizer@campusos.demo");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/events");
  const eventHref = await page.getByRole("link", { name: /Pink City Hack 2026/ }).first().getAttribute("href");
  expect(eventHref).toBeTruthy();
  const eventId = eventHref!.split("/").at(-1)!;
  await page.goto(`/events/${eventId}/fairjudge`);
  await expect(page.getByText(/Neer/).first()).toBeVisible();
});
