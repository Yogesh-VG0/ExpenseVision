# Contributing to ExpenseVision

Thanks for your interest! ExpenseVision is a portfolio project, but contributions that improve code quality, fix bugs, or close documented gaps are welcome.

## Getting Started

1. Fork the repository and clone locally
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Supabase + AI keys
4. Apply Supabase migrations (see README)
5. `npm run dev`

## Development Workflow

```bash
npm run dev        # Start dev server
npm test           # Run unit tests
npm run lint       # ESLint
npx tsc --noEmit   # Type check
npm run build      # Production build
```

## Pull Request Guidelines

- One concern per PR
- Run `npm test && npx tsc --noEmit && npm run lint` before submitting
- Include a brief description of what changed and why
- If adding a feature, update DOCUMENTATION.md where relevant

## Code Style

- TypeScript strict mode
- Zod for runtime validation on all API boundaries
- Server-side auth check on every API route (even if middleware covers it)
- Prefer existing patterns and utilities — check `src/lib/` before adding new helpers

## Reporting Issues

Use the GitHub issue templates. Include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS if relevant (especially for PWA features)

## Security Vulnerabilities

See [SECURITY.md](./SECURITY.md) for responsible disclosure instructions.
