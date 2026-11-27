# 0011. AI writes content ahead of time through OpenRouter, and a grown-up reviews it

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants AI to keep the questions fresh and to voice the host, like their other apps (Crayon Box and colors use
OpenRouter). LLMs get facts wrong and misjudge ages, and a wrong "fact" taught to a 4-year-old is worse than no question.

## Decision
- **All AI goes through OpenRouter** with one key, `OPENROUTER_API_KEY`, held by the server only. Models are server settings
  (`AI_TEXT_MODEL`, `AI_CHECK_MODEL`, `AI_IMAGE_MODEL`, `AI_VOICE_MODEL`), and the admin page shows OpenRouter's list to
  change them, as Crayon Box ADR 0033 does.
- **Nothing AI-made is generated during a game.** Jobs run on a schedule or from the admin page and write to the
  bank as `review`. Games use only `live` content, and the one exception is ADR 0013's optional live lines.
- **The question pipeline:**
  1. **Write:** ask the text model for N questions for a band and category, in a strict JSON schema.
  2. **Check:** a second model (`AI_CHECK_MODEL`, different from the writer) answers each question blind and rates its
     age fit and how clear it is. Questions where its answer doesn't match, or that it's unsure about, are dropped or flagged.
  3. **De-duplicate** against the bank, using normalised text plus a similarity check.
  4. **Review queue** on `/admin`: approve, edit or reject, with keyboard shortcuts so it goes quickly. **Little and Kids
     questions always need a grown-up's approval.** For Tweens and up, the owner can choose auto-approve when the checker
     agrees (off by default).
- **Pictures** for Little questions come from the image model in one consistent style (flat, chunky outline, matching
  the design guide), and are reviewed with their question. Stored as files, keyed by id.
- **Cost guard:** each job has a budget, and the admin page shows what has been spent (OpenRouter returns usage per call).

## Consequences
- Fresh content without the owner writing it, in exchange for review time. Approving in batches keeps that to minutes a week.
- The check pass doubles the cost of the text calls. It's cheap next to voice and images.

## Alternatives
Generate questions live in the game: slow, uncontrolled and unreviewed. Hand-written only: the bank stays small and gets stale.

## Revised 2026-11-27: the generator, and auto-publish (owner's ask)
The owner asked for an admin tool where you type a topic ("make a group of kids questions based on Paw Patrol") and the AI
"researches, makes the questions and publishes them". Built as **admin > Generate** (`apps/server/src/generator.ts`):
- **Write** with web search on (OpenRouter's `web` plugin), default `anthropic/claude-sonnet-5.5` (`AI_TEXT_MODEL`), in a
  strict JSON schema, per age band with band rules (Littles: picture kind, 2-3 one-word answers).
- **Check** blind with another family, default `openai/gpt-5.6-terra` (`AI_CHECK_MODEL`): it picks its own answer, a
  confidence, and clear/age-fit flags. It's never told the answer.
- **De-duplicate** (word overlap of 75% or more against every prompt in the library), strip citations, validate.
- **Publish:** with "publish" on (the default), a question goes **live** when the checker agrees (same answer, at least 70% sure,
  clear, age fits); otherwise it goes to **review** with the checker's note. **This replaces "Little and Kids always need a
  grown-up's approval"** for generated batches, on the owner's say-so. The blind check is the safeguard, and the owner can
  untick publish.
- **Budget:** `AI_JOB_BUDGET_USD` (default $1) per batch. One batch at a time. The first real batch (9 Paw Patrol questions,
  3 ages) took 32 s and cost $0.065.
- **Voice:** new live questions are recorded in every room voice (`SALTY_VOICES`, `voiceRunner.ts`), one run at a time.

## Where it lives
`packages/content/` (prompts, schemas, jobs), `apps/server/src/ai.ts`, the `/admin` review queue.
