# Open questions

Decisions waiting on the owner. Remove an item once it's answered, and record the answer in an ADR or preferences.
_Last updated: 2026-11-26_

1. **Accept the first ADR batch** (0001–0020)? All of them are Proposed.
2. **Name.** Is Smartmouth / Salty OK, or another choice? Candidates are in ADR 0020. The domain is set:
   **`play.303.social`**. Another session passed that on at the owner's request on 2026-11-26, along with the Cloudflare route to port 8470.
   The owner should confirm it here once.
2a. **Who can reach `/admin`?** Cloudflare Access for `/admin` isn't set up yet (ADR 0015). It's needed before the admin
   API exists (milestone 2), not before.
3. **Where the code is hosted.** Public GitHub like colors and WhatsOn, private GitHub, or Gitea only? There's no remote yet.
4. **Which voice for Salty.** Picked by ear from an audition page (ADR 0013), which needs the OpenRouter key on the server.
5. **Captions at Filthy level.** Should spoken swearing be shown bleeped (`★★★★`) or written out in the TV captions? Both are on the mockups.
6. **"Salty can say names"** in grown-ups-only rooms (ADR 0016). Off by default. Does the owner want it at all?
7. **Live roasts** (ADR 0013, optional). Are they worth the latency and cost, or is the line bank enough?
8. **Auto-approve** AI questions for Tweens and up when the checker agrees (ADR 0011)? Off by default.
9. **Choices the mockups made** that the design guide didn't. They're listed at the bottom of the mockups page.
