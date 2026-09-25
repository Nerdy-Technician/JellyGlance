# JellyGlance Site

Source for the JellyGlance product site at [jellyglance.com](https://jellyglance.com), built with VitePress. Install and configuration guides live separately at [docs.jellyglance.com](https://docs.jellyglance.com) ([source](https://github.com/JellyGlance/Documentation)).

This folder is its own npm project and is not part of the app workspaces or the Docker image.

## Local development

```sh
cd site
npm install
npm run dev      # http://localhost:5174
npm run build    # outputs site/.vitepress/dist
```

Release notes, stars and downloads are fetched from GitHub at build time. Set `GITHUB_TOKEN` to avoid rate limits.

## Adding a press mention

Add a card to the top of the `press-grid` in `press.md`, and put any image in `public/press/`.

## Deploying

`.github/workflows/pages.yml` publishes to GitHub Pages when anything under `site/` changes on `main`, and once a day so release notes and the roadmap stay current. `public/CNAME` holds the `jellyglance.com` domain.
