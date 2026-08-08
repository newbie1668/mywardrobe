<div align="center">

# My Wardrobe

A local-first, AI-assisted wardrobe: import the clothes you own, build complete looks from your real pieces, and review how a saved outfit appears on you.

[![License: MIT](https://img.shields.io/badge/license-MIT-191919?style=flat-square)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-22%2B-191919?style=flat-square)](package.json)

</div>

![Wardrobe gallery](docs/screenshots/gallery.png)

![Wardrobe editor](docs/screenshots/editor.png)

## What it does

- Imports clothes from an uploaded photo, then lets you approve each detected piece.
- Produces clean garment cut-outs and optional modeled item images.
- Suggests context-aware Pairing Options from Sanzo Wada's _A Dictionary of Color Combinations Vol. 1_.
- Lets you assemble a Complete Look yourself, change its Reference Combination, and save it as a Saved Outfit.
- Generates a full-body Modeled Preview for a Saved Outfit, then reviews it for identity, framing, and garment fidelity before showing it.
- Creates a grounded Outfit Name and Description from the pieces you selected.
- Lets you rename or delete Saved Outfits without changing your wardrobe or Curated Looks.

Everything personal stays local by default: photos, generated images, wardrobe data, the identity reference, and API keys are excluded from Git.

## Quick start

### Prerequisites

- Node.js 22 or newer
- An OpenAI API key
- A PNG identity reference photo for modeled previews

### Install and run

```bash
git clone https://github.com/newbie1668/mywardrobe.git
cd mywardrobe
npm ci
cp .env.example .env
```

Add your key to `.env`:

```dotenv
OPENAI_API_KEY=your_key_here
```

Place a PNG reference photo at `data/model-reference.png`, then start the app:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## How to use it

1. Select **Add clothes** and upload, paste, or drag in a wardrobe photo.
2. Review the detected crop, garment cut-out, and modeled item image before approving it.
3. Open a wardrobe piece and choose **Look Builder**.
4. Choose Pairing Options until the Complete Look includes a Wearable Core: a top and bottom (or one-piece) plus footwear.
5. Save the look. Its name, description, and Modeled Preview are prepared asynchronously.
6. Open **Outfits** to rename, retry, or delete a Saved Outfit. Deleting one also removes its local generated-preview record; it never deletes the underlying wardrobe pieces.

Image generation can take a little while because the app performs high-quality image generation and a separate fidelity review. The UI keeps the state visible while the job is generating, reviewing, ready, or needs a retry.

## Privacy and local data

Do not commit or share these files:

- `.env` and API keys
- `data/`, including `data/model-reference.png`
- Original wardrobe photos and generated outfit images

They are ignored by Git in this repository. Treat a modeled image as personal data whenever it contains your likeness.

## Public Vercel demo

Vercel is optional. The included `vercel.json` intentionally builds a **fixture-only public preview**. `.vercelignore` prevents your local data, identity reference, photos, generated assets, and `.env` from being uploaded.

That preview is useful for sharing the interface and Look Builder. It is not a hosted version of your private wardrobe: the importer and personal AI workflow rely on local storage and local server routes.

To build a real hosted multi-user product, add authentication, private object storage for images, a database for wardrobes/jobs, and serverless/background job infrastructure. Keep the OpenAI API key server-side.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | required | Used only by the local server for OpenAI requests. |
| `OPENAI_VISION_MODEL` | `gpt-5.4-mini` | Detects garments and reviews modeled previews. |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` | Generates garment and modeled images. |
| `OPENAI_IMAGE_QUALITY` | `high` | Image-generation quality. |
| `WARDROBE_MODEL_REFERENCE` | `data/model-reference.png` | Local PNG used for modeled images. |
| `WARDROBE_DATA_DIR` | `data` | Local directory for wardrobe data and generated assets. |

## Development and checks

```bash
npm test
npm run test:browser
npm run check
npm run check:public-preview
```

Before opening a pull request, keep personal files out of the commit and run the relevant checks above.

## Credits and inspiration

This project began as an adaptation of [Open Wardrobe](https://github.com/tandpfun/open-wardrobe), created by [Thijs](https://github.com/tandpfun). Thank you to Thijs for the original open-source project and inspiration. See the [original launch post](https://x.com/cdngdev/status/2076812846793650485).

This version adds the Dictionary-guided Look Builder, context-aware pairings, Saved Outfits, full-look Modeled Previews with fidelity review, generated names and descriptions, saved-outfit deletion, privacy-safe public previewing, and expanded test coverage.

## License

[MIT](LICENSE)
