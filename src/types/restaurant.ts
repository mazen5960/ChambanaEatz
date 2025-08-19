export type Diet = "halal" | "vegetarian" | "gluten-free" | "vegan";
export type Vibe = "quiet" | "group-friendly" | "date-night" | "lively" | "casual";

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  price: 1 | 2 | 3 | 4; // $ to $$$$
  rating: number; // 0-5
  reviews: number;
  lat: number;
  lon: number;
  address: string;
  hours: string; // simplified display
  isOpenNow: boolean;
  diet: Diet[];
  vibes: Vibe[];
}

export interface Preferences {
  cuisinePref?: string[]; // Changed to array for multiple selections
  mode?: "dine-in" | "delivery";
  dress?: "casual" | "nice";
  diet?: Diet[]; // Added diet preferences
  vibes?: Vibe[]; // Added vibe preferences
  locationRequested?: boolean; // Track if user wants to use their location
}

export interface Filters {
  maxDistance: number; // in miles
  maxPrice: 1 | 2 | 3 | 4 | 5; // allow 5 to mean no-limit
  minRating: number;
  diet: Diet[];
  vibes: Vibe[];
  budgetPerPerson?: number;
}

export function priceToSymbols(price: number) {
  return "$".repeat(price);
}

export function googleMapsLink(r: Restaurant) {
  if (r.address) {
    const address = encodeURIComponent(`${r.name}, ${r.address}`);
    return `https://www.google.com/maps/search/${address}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`;
}

export function appleMapsLink(r: Restaurant) {
  if (r.address) {
    const q = encodeURIComponent(`${r.name}, ${r.address}`);
    return `https://maps.apple.com/?q=${q}`;
  }
  return `https://maps.apple.com/?q=${encodeURIComponent(r.name)}&ll=${r.lat},${r.lon}`;
}

export function wazeLink(r: Restaurant) {
  return `https://www.waze.com/ul?ll=${r.lat},${r.lon}&navigate=yes&zoom=17`;
}

export function uberLink(r: Restaurant) {
  const name = encodeURIComponent(r.name);
  return `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${r.lat}&dropoff[longitude]=${r.lon}&dropoff[nickname]=${name}`;
}

export function doordashSearchLink(r: Restaurant) {
  const q = encodeURIComponent(r.name);
  return `https://www.doordash.com/search/store/${q}`;
}

export function haversineMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}
