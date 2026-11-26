# Cardfolio

A personal member card wallet. Design cards from screenshots of store apps, then add them to Apple Wallet.

## Put it online (free)

1. Create a public repository on GitHub and upload every file in this folder (not the folder itself).
2. Settings > Pages > Deploy from a branch > `main` / `(root)` > Save.
3. Open `https://<username>.github.io/<repo>/` in Safari, tap Share > Add to Home Screen.

To update: upload the changed files and bump `cardfolio-v1` in `sw.js`.

## Brand

Lilac (`#B79DE8`) on aubergine (`#0F0B14`), with plum, mint, peach, cream and coral from the logo. Open `brand.html` for the full guide. Design tokens live at the top of `styles.css`.

## Apple Wallet (free)

Tap Add to Apple Wallet on a card. Cardfolio sends the design to a small relay (`worker/worker.js`, a free Cloudflare Worker), which asks the free walletmcppass.com service to sign it. Safari then shows Apple's Add to Apple Wallet screen.

Limits: about 30 passes a day, while the service is free in beta. The card's text, barcode and logo pass through the service, which deletes the pass file after an hour. Banners aren't included in Wallet passes.

If the relay isn't set up, Add to Apple Wallet falls back to a guide for Wallet's own Create a Pass (iOS 27).

## Files

- `index.html`: app shell
- `styles.css`: design system (tokens at the top) and layout
- `app.js`: screens and flows
- `core.js`: storage, image tools (crop, background removal, colors) and barcodes
- `templates.js`: store list, easy to extend
- `sw.js`: offline support
- `worker/worker.js`: the signing relay (deploy on Cloudflare Workers, free plan)
- `logo.svg`, `mark.svg`: app icon and mark
- `brand.html`: brand guide
