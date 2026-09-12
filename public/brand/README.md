# Roof Zeus brand kit v2 — September 2026

Open `index.html` for the visual brand guide, palette, typography, usage rules, and downloads. All assets work offline when this folder stays together.

## Design

The emblem pairs a blue-eyed Zeus with a broad architectural roof. The roof has a central front gable, matched side planes, layered fascia, equal squared eaves, a centered four-pane window, and a straight base. Zeus sits behind the roof; his hair and beard stop above the eaves. The roof receives more visual weight than in v1.

## Files

- `roof-zeus-emblem.png`: 1,254 × 1,254 transparent illustrated master.
- `roof-zeus-logo-dark.*` / `roof-zeus-logo-light.*`: horizontal full logo. Dark/light indicates the intended background. PNG: 2,000 × 480. Website WebP: 800 × 192.
- `roof-zeus-stacked-dark.*` / `roof-zeus-stacked-light.*`: stacked full logo. PNG: 1,920 × 2,000.
- `roof-zeus-wordmark-dark.*` / `roof-zeus-wordmark-light.*`: standalone outlined lettering. PNG: 1,760 × 300.
- `roof-zeus-icon.svg` / `.png`: simplified layered roof and lightning micro mark for browser icons. PNG: 192 × 192.

The logo SVGs contain outlined Georgia Bold lettering and the embedded PNG emblem. They require no fonts or external image files, but the emblem remains raster artwork. Wordmark-only SVGs and the micro mark are true vector assets. Do not describe the full logos as fully vector masters. For large-format printing, commission a manual vector redraw of the approved emblem.

Digital colors: Navy `#081827`, Gold `#D6AC58`, Ivory `#F5F1E8`, Blue `#43C8FF`. Shading in the generated illustration includes other tones. Existing website colors, typography, and content are retained.

## Website integration

Public marketing navigation, mobile menu, footer, and favicon use v2. Versioned asset URLs refresh the previously cached website logo. App assets, authentication pages, organization logos, reports, routes, and workflows remain unchanged. The guide is served at `/brand/index.html` and marked `noindex`.

## Research references

- [99designs roofing logo collection](https://99designs.com/inspiration/logos/roofing): surveyed wordmarks, roof geometry, and combinations of characters and roof symbols.
- [Active Roofing](https://www.activeroofingdublin.com/): reference for a gold residential roof identity with a secondary roof peak.
- [K.H. Roofing](https://www.khroofs.com/): reference for residential roof and window symbolism.

Design inference: layered roof planes, consistent line thickness, and matched eaves make the roofing portion more deliberate and legible. These references informed the architectural vocabulary; their logos were not used as image-generation inputs or copied into the artwork.

## Production

Emblem created with the built-in image-generation tool. Every full-logo variant uses the same emblem, with deterministic outlined lettering and transparent exports. No source font files are distributed.

Final emblem prompt:

> Create a BRAND NEW original Roof Zeus standalone logo emblem. Use case: logo-brand. One centered emblem, no text, on a transparent PNG background. Premium navy, warm gold, ivory and small electric blue eyes. A dignified classical Zeus head in three-quarter view looking right, noble face, flowing ivory hair with large elegant navy negative-space shapes and compact beard, a small gold lightning bolt tucked on left. Zeus should occupy ONLY the upper 60 percent and roughly 65 percent of the overall width. The bottom 40 percent is a prominent roof assembly, broader than Zeus: a precise, beautifully drawn residential roof with a main front-facing central gable and matching lower side roof planes, layered gold fascia bands with consistent thickness, navy triangular gable face, a small ivory four-pane window centered under the peak. The roof is geometrically bilateral and symmetrical; left and right slopes identical pitch, equal horizontal overhangs, identical straight squared vertical terminations at the SAME HEIGHT. No chimney. No pointed eave tips. No curved lower roof edges. Flat continuous straight horizontal baseline. Hair and beard stop behind the top of the roof and do not spill underneath it. Make the roof architectural and confidently constructed, not a single generic chevron. Art style: refined vector-style brand illustration, bold sharp shapes, restrained two-tone shading, no photorealism or metallic bevels. Colors navy #081827, gold #D6AC58, ivory #F5F1E8, eyes #43C8FF. Composition compact and clear, 6 percent margins, square canvas. Return the finished emblem with actual transparent alpha background.
