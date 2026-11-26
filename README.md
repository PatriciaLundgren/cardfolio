# Cardfolio

A personal member card wallet. Design cards from screenshots of store apps, then add them to Apple Wallet.

## Put it online (free)

1. Create a public repository on GitHub and upload every file in this folder (not the folder itself).
2. Settings > Pages > Deploy from a branch > `main` / `(root)` > Save.
3. Open `https://<username>.github.io/<repo>/` in Safari, tap Share > Add to Home Screen.

To update: upload the changed files and bump `cardfolio-v1` in `sw.js`.

## Apple Wallet

Needs an Apple Developer account. In the app: Settings > Wallet signing, and follow the four steps. The signing key stays on your phone. Back it up from the same screen.

## Files

- `index.html`: app shell
- `styles.css`: design system (tokens at the top) and layout
- `app.js`: screens and flows
- `core.js`: storage, image tools (crop, background removal, colors) and barcodes
- `pkpass.js`: Apple Wallet signing and pass builder
- `templates.js`: store list, easy to extend
- `sw.js`: offline support
