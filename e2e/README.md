# Browser tests

Playwright tests of the built site, at a computer's width (1440) and a phone's (390), in Danish. They never touch the live backend: the build talks to a made-up Supabase project, and every call is answered by a fake backend in the test.

- `world.ts`: the made-up data. Mia, three linked accounts, two groups, an invitation, and an event in each of My events' sections, all fixed to one moment (Wednesday 7 October 2026, 10:00 Danish time). Typed with the site's own types from `src/api`, so a changed API shape fails the type check.
- `backend.ts`: answers each Edge Function and action from that world, and remembers changes (accepting, leaving, answering a vote). A call it doesn't know fails the test, as does an error thrown in the page.
- `fixtures.ts`: the fake session, the frozen clock and fixed "random" numbers. Import `test` and `expect` from here.
- `*.spec.ts`: the behaviour tests; `screenshots.spec.ts` compares whole pages with `__screenshots__/`.

## Running

```bash
npm run e2e                          # everything (screenshots are skipped on a Mac)
npx playwright test e2e/events.spec.ts --project=phone
npx playwright test --ui             # watch it run, step by step
```

The first run downloads Chromium once: `npx playwright install chromium`.

## Screenshots

Fonts render differently on a Mac and on Linux, so the reference images are made on Linux only, in Playwright's Docker image, like CI's. A Mac skips the comparison.

When a change moves pixels on purpose, make new reference images in one of two ways:

- push a commit whose message contains `[screenshots]`, or
- start "Update screenshots" from the Actions tab on the branch (once the workflow is on main).

The workflow runs the whole browser suite, behaviour tests included, and commits the new images to the branch; pull them and look at the diff before merging. It is where a `[screenshots]` commit's browser tests run: CI's browser job skips that commit, and the workflow's own commit starts no CI (GitHub doesn't run workflows on commits made by a workflow). `npm run finish` waits for it and takes its commit.

When CI's comparison fails, download the `browser-test-results` artifact and open `playwright-report/index.html`: each failed screenshot shows the expected, actual and diff images.

## Adding to it

- New data a page needs goes in `world.ts`, typed with the site's own type.
- A new function or action goes in `backend.ts`, changing the world the way the real one changes the database.
- Prefer roles and visible text (`getByRole("button", { name: "Accepter" })`) to CSS classes.
