# NYTC Distance Learning

The public front door for Scratch Coding, Arduino Learning, and Scratch Games.

## Hosting

GitHub Pages target: https://nytc-distance-learning.github.io/nytc-distance-learning/

Publish from `main` and the `/docs` folder. The compiled website is committed in `docs` so Pages does not require an Actions build.

## Development

Use Node.js 22.12+ or 24+. Run `npm ci`, `npm run dev`, and `npm run build`. After changing source, rebuild and commit the source plus `docs` together.

## Domain guardrail

Never change the main NYTC domain `nytc.info`, its DNS, or its hosting configuration. This repository hosts a separate Distance Learning website on GitHub Pages. Do not add a CNAME file or change custom-domain settings without a new explicit request.

## Existing learning experiences

Course links remain as currently published. This migration changes the hub hosting address only.
