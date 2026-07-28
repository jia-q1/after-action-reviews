# After Action Review Library

A shared library of After Action Reviews (AARs) — browse and search approved
reviews, or draft a new one with AI-assisted generation, reviewed and
approved by a human editor before it joins the library.

Built with [Next.js](https://nextjs.org) (App Router) and Tailwind CSS.

## Getting Started

Install dependencies, then run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project structure

- `src/app/page.tsx` — library home: search and filter reviews by theme/status.
- `src/app/reviews/[slug]/page.tsx` — individual review detail page.
- `src/app/new/page.tsx` — draft-a-new-review flow (survey input + AI-assisted draft generation, currently mocked).
- `src/data/reviews.ts` — review data model and sample review records.
- `src/components/` — shared UI (review cards, header/footer, status badges).
- `legacy-static-prototype/` — original static HTML/CSS/JS prototype, kept for reference.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
