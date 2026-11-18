## What changed

<!-- One paragraph: what this changes, and which user-visible behaviour it affects. -->

## Why

<!-- The problem this solves, the issue it closes, or the behaviour that was wrong. -->

## Checks

- [ ] `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` all green
- [ ] `lib/` rebuilt and committed — a fresh `npm run build` leaves `git status` clean
- [ ] New user-visible strings added to **both** dictionaries in `src/client/locales.ts`
- [ ] A regression test accompanies the change when this fixes a bug
- [ ] Client guards and the host route still agree through `src/shared/`, and the HTTP route and `/enhance` command still both go through `src/orchestrate.ts`

## Notes for reviewers

<!-- Tradeoffs, follow-ups, screenshots, anything else a reviewer should know. -->
