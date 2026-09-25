# Hero assets

Every file here is local; nothing in the hero is hotlinked. All source photos are **CC0** on Wikimedia Commons,
and each licence was read from the Commons API (`extmetadata.LicenseShortName`) at download time — not assumed.
The `(Unsplash)` titles are photos uploaded to Commons while Unsplash still published under CC0, before its 2017
licence change; Commons records them as CC0.

| File | Source | Author | Licence | Notes |
| --- | --- | --- | --- | --- |
| `transformations/before-background-{640,1280}.webp` | [Apple watch on side (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Apple_watch_on_side_(Unsplash).jpg) | Jens Kreuter jenskreuter | CC0 | Centre piece, before. Cropped to 4:3 around the watch. |
| `transformations/after-background-{640,1280}.webp` | [Apple watch on side (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Apple_watch_on_side_(Unsplash).jpg) | Jens Kreuter jenskreuter | CC0 | Centre piece, after: cut out with this app's rembg pipeline (`birefnet-general-lite`); reflection specks below the watch cleared. |
| `transformations/detail-sharp.webp` | [Apple watch on side (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Apple_watch_on_side_(Unsplash).jpg) | Jens Kreuter jenskreuter | CC0 | Upscale loupe: the dial from the cut-out, full resolution. |
| `transformations/detail-lowres.webp` | [Apple watch on side (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Apple_watch_on_side_(Unsplash).jpg) | Jens Kreuter jenskreuter | CC0 | Upscale loupe: the same crop, downsampled 4× — the genuine 'before'. |
| `transformations/shoe-cutout.webp` | [Shoe-Blucher-Black with rubber sole.jpg](https://commons.wikimedia.org/wiki/File:Shoe-Blucher-Black_with_rubber_sole.jpg) | Wikipedia-ce | CC0 | Card: cut out with rembg (`isnet-general-use`). |
| `images/watch-denim.webp` | [Gold Watch Denim Cuffs (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Gold_Watch_Denim_Cuffs_(Unsplash).jpg) | AJ Garcia ajgarciaco | CC0 | Card. |
| `images/camera-flatlay.webp` | [Camera keys notebook coffee (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Camera_keys_notebook_coffee_(Unsplash).jpg) | Melinda Pack melindapack | CC0 | Card; also the poster for the video slot. |
| `images/blueberries.webp` | [Handful of Blueberries (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Handful_of_Blueberries_(Unsplash).jpg) | andrew welch andrewwelch3 | CC0 | Card. |
| `images/makeup-kit.webp` | [Make-up kit (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Make-up_kit_(Unsplash).jpg) | Manu Camargo manucmg | CC0 | Card. |

## Deliberately avoided

- **Visible third-party logos** (Nike, Apple, RED, Audio-Technica) — a logo in a hero reads as endorsement.
- **Identifiable people.** CC0 covers copyright, not personality rights, so the brief's "portrait" card is left out.

## Video slot (empty)

No clip ships yet. Pexels, Pixabay and Coverr need an API key or block automated download, and Commons has no
suitable CC0 product footage, so none could be licence-checked automatically. The hero is complete without one.

To add a clip:

1. Confirm its licence permits reuse (Pexels / Pixabay / Coverr licence, or CC0). Never use PhotoRoom media.
2. Keep it short (5–15 s), 1080p or smaller, muted, H.264 MP4 or VP9 WebM — ideally under ~2 MB.
3. Save it as `videos/product-studio-01.mp4` (or `.webm`).
4. In `src/components/landing/heroAssets.ts`, import it and set `video: { src, type: "video/mp4" }` on the
   `camera-flatlay` card. Its image becomes the poster.

`HeroVideo` then mounts the clip only near the viewport, never autoplays under reduced motion, and falls back to
the poster on any load error — so a missing or broken file can't break the layout.
