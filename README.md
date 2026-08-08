<div align="center">

# My Wardrobe

### Turn the clothes you actually own into considered, Wada colour-led outfits.

A local-first AI wardrobe with a **Wada Look Builder** at its heart. Start from any garment, explore colour combinations from Sanzo Wada's _A Dictionary of Color Combinations Vol. 1_, then build and save a wearable look from your own wardrobe.

[![License: MIT](https://img.shields.io/badge/license-MIT-191919?style=flat-square)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-22%2B-191919?style=flat-square)](package.json)

</div>

![A local wardrobe gallery](docs/screenshots/my-wardrobe-gallery.png)

## The Wada Look Builder

Most wardrobe apps stop at cataloguing. This fork is about the much more interesting next question: **what should I wear with this?**

Choose an **Anchor Piece** and the app identifies its primary **Anchor Colour**. It finds relevant Wada reference combinations that your real wardrobe can cover, then offers **Pairing Options** by garment role. You remain in control: choose the pieces, switch between colour combinations, and only save once the result is a complete, wearable outfit.

It is intentionally more than colour matching. The builder applies clothing-context gates before ranking colours, so a technically compatible colour is not allowed to produce an impractical pairing. Neutral pieces can support a palette without taking over it, and the app makes the required garment roles clear as you build.

![The Wada Look Builder showing an Anchor Piece, three candidate combinations, and wearable pairing options](docs/screenshots/wada-look-builder.png)

### From a colour combination to an outfit you can wear

1. Pick an existing garment as the Anchor Piece.
2. Review the suggested Wada Reference Combinations and switch between them without losing valid selections.
3. Select a Wearable Core: a top and bottom (or one-piece) plus footwear. Add optional accessories or layers.
4. Save the Complete Look. The app creates an outfit name and description, generates a Modeled Preview, and checks that preview for identity, framing, and garment fidelity.
5. Keep, rename, retry, or delete a Saved Outfit. Deleting an outfit never removes the wardrobe pieces it uses.

![A saved outfit and its modeled preview from the local wardrobe](docs/screenshots/my-outfit-preview.png)

## What this fork adds

- **Dictionary-guided Wada Look Builder** — the main feature: real Vol. 1 combinations, candidate coverage, Anchor Colour matching, and flexible combination switching.
- **Wearable, context-aware pairings** — role-based suggestions that avoid nonsensical combinations before colour ranking begins.
- **Complete Looks and Saved Outfits** — assemble an outfit from your own pieces, then rename or delete it without affecting the source wardrobe.
- **Modeled Preview with review** — optional full-look generation followed by a fidelity check before a preview is shown as ready.
- **Local-first personal data** — your wardrobe, reference image, generated assets, and API key remain on your machine.

## Bring your own wardrobe

- Import clothes from a photo, then approve the detected garment and its cut-out.
- Edit names, categories, colours, and detail tags when the initial detection needs help.
- Use the Wada Look Builder to turn those pieces into a look you would actually put on.
- Browse Curated Looks for additional inspiration alongside the looks you save yourself.

## Quick start

### Prerequisites

- Node.js 22 or newer
- An OpenAI API key
- A PNG identity reference photo for modeled previews

### Install and run locally

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

Image generation can take a little while because the app performs high-quality image generation and a separate fidelity review. The UI keeps the state visible while the job is generating, reviewing, ready, or needs a retry.

## Privacy: local by default

Do not commit or share these files:

- `.env` and API keys
- `data/`, including `data/model-reference.png`
- Original wardrobe photos and generated outfit images

They are ignored by Git in this repository. Treat a modeled image as personal data whenever it contains your likeness. The README screenshots are intentionally committed examples from the maintainer's local wardrobe; replace them with your own only if you are happy for those images to be public.

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
```

Before opening a pull request, keep personal files out of the commit and run the relevant checks above.

## Credits and inspiration

This project began as an adaptation of [Open Wardrobe](https://github.com/tandpfun/open-wardrobe), created by [Thijs](https://github.com/tandpfun). Thank you to Thijs for the original open-source project and inspiration. See the [original launch post](https://x.com/cdngdev/status/2076812846793650485).

This fork expands the original with the Dictionary-guided Wada Look Builder, context-aware pairings, Saved Outfits, full-look Modeled Previews with fidelity review, generated names and descriptions, and saved-outfit deletion.

## License

[MIT](LICENSE)
