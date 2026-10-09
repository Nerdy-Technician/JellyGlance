# Contributing to JellyGlance

Bugs and feature requests go in the [issue tracker](https://github.com/Nerdy-Technician/JellyGlance/issues). Documentation lives in [JellyGlance/Documentation](https://github.com/JellyGlance/Documentation), and the jellyglance.com website in [JellyGlance/Website](https://github.com/JellyGlance/Website).

## Widget changes: open the Website PR first

The downloadable Homarr widget files on jellyglance.com are generated from the app's widget pack (`apps/web/src/lib/widgetSnippets.js`) and live in JellyGlance/Website under `public/widgets/`. If your change alters them:

1. Clone the website next to this repo: `git clone https://github.com/JellyGlance/Website ../Website`. Or set `JG_WEBSITE_DIR` to an existing checkout.
2. Run `npm run widgets:sync` to regenerate the files, and `npm run widgets:check` to confirm they match.
3. Open the PR in JellyGlance/Website first, then the JellyGlance PR.

The **Widget Files** check runs only when the widget pack or `scripts/widget-files.mjs` changes. It reads Website's `main` and is non-blocking, so it shows a warning until the Website PR is merged.
