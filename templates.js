/* Store templates: pick one and the card is designed for you.
   bg/fg: card and text color. accent: second brand color, used by the banner.
   banner: default banner style (blend, waves, dots, stripes, glow) or null.
   logo: a file in /logos, filled in from the logo files you added.
   Colors are close matches to each brand; a screenshot gives the exact card color. */

window.TEMPLATES = [

  // Around Barkarby
  { group: "Around Barkarby", name: "Lidl Plus", bg: "#0050AA", fg: "#FFFFFF", accent: "#FFF000", banner: "dots", logo: null },
  { group: "Around Barkarby", name: "ICA", bg: "#E3000B", fg: "#FFFFFF", accent: "#FFFFFF", banner: "blend", logo: null },
  { group: "Around Barkarby", name: "ÖoB", bg: "#FFD200", fg: "#111111", accent: "#E30613", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "JYSK", bg: "#143C8C", fg: "#FFFFFF", accent: "#FFFFFF", banner: "waves", logo: null },
  { group: "Around Barkarby", name: "Rusta", bg: "#00529B", fg: "#FFFFFF", accent: "#FFD100", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "Lager 157", bg: "#111111", fg: "#FFFFFF", accent: "#E30613", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "Jula", bg: "#D8232A", fg: "#FFFFFF", accent: "#FFFFFF", banner: "waves", logo: null },
  { group: "Around Barkarby", name: "IKEA Family", bg: "#0058A3", fg: "#FFFFFF", accent: "#FFDA1A", banner: "glow", logo: null },
  { group: "Around Barkarby", name: "Biltema", bg: "#00539F", fg: "#FFFFFF", accent: "#FFD400", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "Bauhaus", bg: "#E30613", fg: "#FFFFFF", accent: "#FFFFFF", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "MediaMarkt", bg: "#DF0000", fg: "#FFFFFF", accent: "#111111", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "Mio", bg: "#1A1A1A", fg: "#FFFFFF", accent: "#C8B8A6", banner: "glow", logo: null },
  { group: "Around Barkarby", name: "Chilli", bg: "#E30613", fg: "#FFFFFF", accent: "#111111", banner: "waves", logo: null },
  { group: "Around Barkarby", name: "Inet", bg: "#1A1A1A", fg: "#FFFFFF", accent: "#FF6A00", banner: "dots", logo: null },
  { group: "Around Barkarby", name: "Clas Ohlson", bg: "#00428C", fg: "#FFFFFF", accent: "#FFFFFF", banner: "blend", logo: null },
  { group: "Around Barkarby", name: "Elgiganten", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#6CB33F", banner: "dots", logo: null },
  { group: "Around Barkarby", name: "Willys", bg: "#D7000F", fg: "#FFFFFF", accent: "#FFFFFF", banner: "dots", logo: null },
  { group: "Around Barkarby", name: "Plantagen", bg: "#00704A", fg: "#FFFFFF", accent: "#8DC63F", banner: "waves", logo: null },
  { group: "Around Barkarby", name: "Stadium", bg: "#111111", fg: "#FFFFFF", accent: "#FF5A00", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "XXL", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#FFD200", banner: "stripes", logo: null },
  { group: "Around Barkarby", name: "Apotek Hjärtat", bg: "#E4002B", fg: "#FFFFFF", accent: "#FFFFFF", banner: "glow", logo: null },
  { group: "Around Barkarby", name: "Stockholm Quality Outlet", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#B8A27A", banner: "blend", logo: null },

  // Groceries
  { group: "Groceries", name: "Coop", bg: "#00AA46", fg: "#FFFFFF", accent: "#FFFFFF", banner: "waves", logo: null },
  { group: "Groceries", name: "Hemköp", bg: "#E2001A", fg: "#FFFFFF", accent: "#FFFFFF", banner: "blend", logo: null },
  { group: "Groceries", name: "City Gross", bg: "#E30613", fg: "#FFFFFF", accent: "#111111", banner: "stripes", logo: null },

  // Pharmacy and beauty
  { group: "Pharmacy and beauty", name: "Apoteket", bg: "#009B3A", fg: "#FFFFFF", accent: "#FFFFFF", banner: "glow", logo: null },
  { group: "Pharmacy and beauty", name: "Kronans Apotek", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#7FB3D5", banner: "blend", logo: null },
  { group: "Pharmacy and beauty", name: "Kicks", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#F4A7C0", banner: "glow", logo: null },
  { group: "Pharmacy and beauty", name: "Lyko", bg: "#111111", fg: "#FFFFFF", accent: "#D9C3B0", banner: "blend", logo: null },
  { group: "Pharmacy and beauty", name: "Åhléns", bg: "#111111", fg: "#FFFFFF", accent: "#FFFFFF", banner: "stripes", logo: null },

  // Fashion and sport
  { group: "Fashion and sport", name: "H&M", bg: "#E50010", fg: "#FFFFFF", accent: "#FFFFFF", banner: "blend", logo: null },
  { group: "Fashion and sport", name: "Lindex", bg: "#111111", fg: "#FFFFFF", accent: "#E8D3C9", banner: "glow", logo: null },
  { group: "Fashion and sport", name: "KappAhl", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#C9D6DF", banner: "waves", logo: null },
  { group: "Fashion and sport", name: "Gina Tricot", bg: "#111111", fg: "#FFFFFF", accent: "#F2C6D1", banner: "glow", logo: null },
  { group: "Fashion and sport", name: "Dressmann", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#9FB1C7", banner: "stripes", logo: null },
  { group: "Fashion and sport", name: "Intersport", bg: "#00338D", fg: "#FFFFFF", accent: "#E30613", banner: "stripes", logo: null },
  { group: "Fashion and sport", name: "Naturkompaniet", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#8BA888", banner: "waves", logo: null },

  // Home and garden
  { group: "Home and garden", name: "Byggmax", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#FFC20E", banner: "stripes", logo: null },
  { group: "Home and garden", name: "Granngården", bg: "#00843D", fg: "#FFFFFF", accent: "#C6E2A9", banner: "waves", logo: null },

  // Electronics, books and hobby
  { group: "Electronics, books and hobby", name: "NetOnNet", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#4DA3FF", banner: "dots", logo: null },
  { group: "Electronics, books and hobby", name: "Webhallen", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#E30613", banner: "dots", logo: null },
  { group: "Electronics, books and hobby", name: "Akademibokhandeln", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#C9A86A", banner: "blend", logo: null },
  { group: "Electronics, books and hobby", name: "Panduro", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#F28C8C", banner: "dots", logo: null },

  // Food and coffee
  { group: "Food and coffee", name: "Espresso House", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#B07A4F", banner: "glow", logo: null },
  { group: "Food and coffee", name: "MAX", bg: "#E30613", fg: "#FFFFFF", accent: "#FFFFFF", banner: "stripes", logo: null },
  { group: "Food and coffee", name: "Pressbyrån", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#E30613", banner: "stripes", logo: null },
  { group: "Food and coffee", name: "7-Eleven", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#F58220", banner: "stripes", logo: null },

  // Fuel and travel
  { group: "Fuel and travel", name: "Circle K", bg: "#EE2E24", fg: "#FFFFFF", accent: "#F58220", banner: "stripes", logo: null },
  { group: "Fuel and travel", name: "OKQ8", bg: "#0057A8", fg: "#FFFFFF", accent: "#E30613", banner: "stripes", logo: null },
  { group: "Fuel and travel", name: "Preem", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#00A651", banner: "blend", logo: null },
  { group: "Fuel and travel", name: "St1", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#E30613", banner: "stripes", logo: null },
  { group: "Fuel and travel", name: "SJ Prio", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#C9A86A", banner: "blend", logo: null },
  { group: "Fuel and travel", name: "Scandic Friends", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#E30613", banner: "glow", logo: null },

  // Pets
  { group: "Pets", name: "Arken Zoo", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#7CC242", banner: "dots", logo: null },
  { group: "Pets", name: "Musti", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#F28C28", banner: "dots", logo: null },

  // Gym and library
  { group: "Gym and library", name: "SATS", bg: "#111111", fg: "#FFFFFF", accent: "#FFFFFF", banner: "stripes", logo: null },
  { group: "Gym and library", name: "Friskis&Svettis", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#F28C28", banner: "waves", logo: null },
  { group: "Gym and library", name: "Library card", bg: "#1C1C1E", fg: "#FFFFFF", accent: "#B79DE8", banner: "blend", logo: null, numberLabel: "Card number" },
];
