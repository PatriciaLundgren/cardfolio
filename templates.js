/* Store templates.
   A template sets the store name, its main brand color, text color and field label,
   so the card looks right even before you add a screenshot. When you do add one,
   the exact card color and logo are taken from your screenshot instead.
   Add your own: { group: "Group", name: "Store", bg: "#RRGGBB", fg: "#FFFFFF" } */

const W_ = "#FFFFFF", K_ = "#111111";

window.TEMPLATES = [
  // Around Barkarby
  { group: "Around Barkarby", name: "Lidl Plus", bg: "#0050AA", fg: W_ },
  { group: "Around Barkarby", name: "ICA", bg: "#E3000B", fg: W_ },
  { group: "Around Barkarby", name: "ÖoB", bg: "#FFD200", fg: K_ },
  { group: "Around Barkarby", name: "JYSK", bg: "#143C8C", fg: W_ },
  { group: "Around Barkarby", name: "Rusta", bg: "#00529B", fg: W_ },
  { group: "Around Barkarby", name: "Lager 157", bg: "#111111", fg: W_ },
  { group: "Around Barkarby", name: "Jula", bg: "#D8232A", fg: W_ },
  { group: "Around Barkarby", name: "IKEA Family", bg: "#0058A3", fg: W_ },
  { group: "Around Barkarby", name: "Biltema", bg: "#00539F", fg: W_ },
  { group: "Around Barkarby", name: "Bauhaus", bg: "#E30613", fg: W_ },
  { group: "Around Barkarby", name: "MediaMarkt", bg: "#DF0000", fg: W_ },
  { group: "Around Barkarby", name: "Mio", bg: "#1A1A1A", fg: W_ },
  { group: "Around Barkarby", name: "Chilli", bg: "#E30613", fg: W_ },
  { group: "Around Barkarby", name: "Inet", bg: "#1A1A1A", fg: W_ },
  { group: "Around Barkarby", name: "Clas Ohlson", bg: "#00428C", fg: W_ },
  { group: "Around Barkarby", name: "Elgiganten", bg: "#1C1C1E", fg: W_ },
  { group: "Around Barkarby", name: "Willys", bg: "#D7000F", fg: W_ },
  { group: "Around Barkarby", name: "Plantagen", bg: "#00704A", fg: W_ },
  { group: "Around Barkarby", name: "Stadium", bg: "#111111", fg: W_ },
  { group: "Around Barkarby", name: "XXL", bg: "#1C1C1E", fg: W_ },
  { group: "Around Barkarby", name: "Apotek Hjärtat", bg: "#E4002B", fg: W_ },
  { group: "Around Barkarby", name: "Stockholm Quality Outlet", bg: "#1C1C1E", fg: W_ },

  // Groceries
  { group: "Groceries", name: "Coop", bg: "#00AA46", fg: W_ },
  { group: "Groceries", name: "Hemköp", bg: "#E2001A", fg: W_ },
  { group: "Groceries", name: "City Gross", bg: "#E30613", fg: W_ },

  // Pharmacy and beauty
  { group: "Pharmacy and beauty", name: "Apoteket", bg: "#009B3A", fg: W_ },
  { group: "Pharmacy and beauty", name: "Kronans Apotek", bg: "#1C1C1E", fg: W_ },
  { group: "Pharmacy and beauty", name: "Kicks", bg: "#1C1C1E", fg: W_ },
  { group: "Pharmacy and beauty", name: "Lyko", bg: "#111111", fg: W_ },
  { group: "Pharmacy and beauty", name: "Åhléns", bg: "#111111", fg: W_ },

  // Fashion and sport
  { group: "Fashion and sport", name: "H&M", bg: "#E50010", fg: W_ },
  { group: "Fashion and sport", name: "Lindex", bg: "#111111", fg: W_ },
  { group: "Fashion and sport", name: "KappAhl", bg: "#1C1C1E", fg: W_ },
  { group: "Fashion and sport", name: "Gina Tricot", bg: "#111111", fg: W_ },
  { group: "Fashion and sport", name: "Dressmann", bg: "#1C1C1E", fg: W_ },
  { group: "Fashion and sport", name: "Intersport", bg: "#00338D", fg: W_ },
  { group: "Fashion and sport", name: "Naturkompaniet", bg: "#1C1C1E", fg: W_ },

  // Home and garden
  { group: "Home and garden", name: "Byggmax", bg: "#1C1C1E", fg: W_ },
  { group: "Home and garden", name: "Granngården", bg: "#00843D", fg: W_ },

  // Electronics, books and hobby
  { group: "Electronics, books and hobby", name: "NetOnNet", bg: "#1C1C1E", fg: W_ },
  { group: "Electronics, books and hobby", name: "Webhallen", bg: "#1C1C1E", fg: W_ },
  { group: "Electronics, books and hobby", name: "Akademibokhandeln", bg: "#1C1C1E", fg: W_ },
  { group: "Electronics, books and hobby", name: "Panduro", bg: "#1C1C1E", fg: W_ },

  // Food and coffee
  { group: "Food and coffee", name: "Espresso House", bg: "#1C1C1E", fg: W_ },
  { group: "Food and coffee", name: "MAX", bg: "#E30613", fg: W_ },
  { group: "Food and coffee", name: "Pressbyrån", bg: "#1C1C1E", fg: W_ },
  { group: "Food and coffee", name: "7-Eleven", bg: "#1C1C1E", fg: W_ },

  // Fuel and travel
  { group: "Fuel and travel", name: "Circle K", bg: "#EE2E24", fg: W_ },
  { group: "Fuel and travel", name: "OKQ8", bg: "#0057A8", fg: W_ },
  { group: "Fuel and travel", name: "Preem", bg: "#1C1C1E", fg: W_ },
  { group: "Fuel and travel", name: "St1", bg: "#1C1C1E", fg: W_ },
  { group: "Fuel and travel", name: "SJ Prio", bg: "#1C1C1E", fg: W_ },
  { group: "Fuel and travel", name: "Scandic Friends", bg: "#1C1C1E", fg: W_ },

  // Pets
  { group: "Pets", name: "Arken Zoo", bg: "#1C1C1E", fg: W_ },
  { group: "Pets", name: "Musti", bg: "#1C1C1E", fg: W_ },

  // Gym and library
  { group: "Gym and library", name: "SATS", bg: "#111111", fg: W_ },
  { group: "Gym and library", name: "Friskis&Svettis", bg: "#1C1C1E", fg: W_ },
  { group: "Gym and library", name: "Library card", numberLabel: "Card number", bg: "#1C1C1E", fg: W_ },
];
