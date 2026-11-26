/* Banner styles. Original, abstract artwork drawn in a card's own colors,
   so any template can get a banner without copying anyone's card art. */
(() => {
  "use strict";
  const { Color, Img } = window.W;
  const W = 1125, H = 369;

  const rgba = (hex, a) => { const [r, g, b] = Color.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const shade = (hex, t) => Color.mix(hex, t > 0 ? "#FFFFFF" : "#000000", Math.abs(t));

  const STYLES = {
    // Soft diagonal blend from the card color into its accent
    blend(x, bg, ac) {
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, shade(bg, -0.08)); g.addColorStop(0.55, bg); g.addColorStop(1, Color.mix(bg, ac, 0.55));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      const r = x.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, W * 0.5);
      r.addColorStop(0, rgba(ac, 0.35)); r.addColorStop(1, rgba(ac, 0));
      x.fillStyle = r; x.fillRect(0, 0, W, H);
    },
    // Layered waves rising from the bottom
    waves(x, bg, ac) {
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      [[0.30, 0.55, 0.9], [0.22, 0.68, 1.4], [0.55, 0.80, 2.1]].forEach(([alpha, base, freq], i) => {
        x.beginPath(); x.moveTo(0, H);
        for (let px = 0; px <= W; px += 8) {
          const y = H * base + Math.sin((px / W) * Math.PI * freq + i * 1.3) * H * 0.12;
          x.lineTo(px, y);
        }
        x.lineTo(W, H); x.closePath();
        x.fillStyle = rgba(i === 2 ? ac : shade(bg, 0.25), alpha); x.fill();
      });
    },
    // Halftone dots that fade across the strip
    dots(x, bg, ac) {
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      const step = 30;
      for (let cy = step / 2; cy < H + step; cy += step) for (let cx = step / 2; cx < W + step; cx += step) {
        const t = cx / W;
        const r = (step / 2) * Math.max(0, t - 0.15) * 0.95;
        if (r < 0.6) continue;
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
        x.fillStyle = rgba(ac, 0.55); x.fill();
      }
    },
    // Bold diagonal bands
    stripes(x, bg, ac) {
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      x.save(); x.translate(W * 0.55, 0); x.rotate(-0.5);
      [[0, 90, 0.9], [130, 40, 0.5], [210, 18, 0.35]].forEach(([off, w, a]) => {
        x.fillStyle = rgba(ac, a); x.fillRect(off, -H, w, H * 4);
      });
      x.restore();
    },
    // Soft glowing shapes, like light on glass
    glow(x, bg, ac) {
      x.fillStyle = shade(bg, -0.05); x.fillRect(0, 0, W, H);
      [[0.2, 0.9, 0.55, ac, 0.45], [0.7, 0.2, 0.45, shade(bg, 0.35), 0.5], [0.95, 0.95, 0.5, ac, 0.3]].forEach(([fx, fy, fr, c, a]) => {
        const g = x.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, W * fr);
        g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      });
    },
  };

  const Banners = {
    STYLES: Object.keys(STYLES),
    LABELS: { blend: "Blend", waves: "Waves", dots: "Dots", stripes: "Stripes", glow: "Glow" },
    // Returns a JPEG data URL for the style in these colors
    render(style, bg, accent) {
      const draw = STYLES[style];
      if (!draw) return null;
      const c = Img.canvasOf(W, H);
      const x = c.getContext("2d");
      const ac = accent && accent.toLowerCase() !== bg.toLowerCase() ? accent : (Color.luminance(bg) > 0.5 ? shade(bg, -0.35) : shade(bg, 0.4));
      draw(x, bg, ac);
      return c.toDataURL("image/jpeg", 0.88);
    },
  };

  window.W.Banners = Banners;
})();
