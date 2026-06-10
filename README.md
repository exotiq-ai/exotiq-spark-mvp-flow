# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/40709742-522b-4267-a142-c1816d02a8a5

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/40709742-522b-4267-a142-c1816d02a8a5) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Testing & CI

```sh
npm test          # run the full Vitest suite once
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit against tsconfig.app.json
npm run lint       # eslint
npm run build      # production build
```

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and push
to `main`: **lint** (currently informational/non-blocking while the inherited
`no-explicit-any` backlog is paid down), **typecheck**, the **full test suite**,
and **build**. Typecheck, tests, and build are gating — a PR must keep them green.

The suite is a smoke harness focused on the highest-risk logic: booking-conflict
detection, fee/payout/platform-fee math, auth-form validation, and routing. It is
not exhaustive coverage; it is the "tests pass ⇒ the core works" baseline. Tests
live next to the code (`*.test.ts(x)`, `src/**/__tests__/`) with shared setup in
`src/test/setup.ts`.

> Note: the app talks to a hosted Supabase project (Lovable-managed). There is no
> committed local Supabase stack wired into CI, so tests mock the Supabase client
> rather than hitting a database. RLS/edge-function behavior is not exercised by CI.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/40709742-522b-4267-a142-c1816d02a8a5) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
