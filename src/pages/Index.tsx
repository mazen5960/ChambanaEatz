import { useEffect, useMemo, useState } from "react";

import QuickPreferences from "@/components/QuickPreferences";
import RecommendationsList from "@/components/RecommendationsList";
import WheelOfFood from "@/components/WheelOfFood";
import CitySearch from "@/components/CitySearch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { sampleRestaurants, sampleTrendingTop5 } from "@/data/restaurants";
import { Diet, Filters, Preferences, Restaurant, haversineMiles } from "@/types/restaurant";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, SlidersHorizontal, RotateCcw } from "lucide-react";

const defaultFilters: Filters = {
  maxDistance: 50,
  maxPrice: 5,
  minRating: 3,
  diet: [],
  vibes: [],
};


const Index = () => {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [useLiveSignals, setUseLiveSignals] = useState(false);
  
  // Privacy-first: location requested only via explicit action
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  
  // New state for worldwide restaurant search
  const [searchedRestaurants, setSearchedRestaurants] = useState<Restaurant[]>([]);
  const [currentCity, setCurrentCity] = useState<string>("");
  const [dataSource, setDataSource] = useState<'local' | 'global'>('local');

  useEffect(() => {
    const favs = localStorage.getItem("illinieatz:favorites");
    if (favs) setFavorites(new Set(JSON.parse(favs)));
  }, []);

  useEffect(() => {
    localStorage.setItem("illinieatz:favorites", JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const shortlist = useMemo(() => {
    // Use either searched restaurants or sample restaurants
    const restaurantsToUse = dataSource === 'global' ? searchedRestaurants : sampleRestaurants;
    
    // Compute base score by prefs + trending + filters
    const base = restaurantsToUse.map((r) => {
      let score = 0;
      // prefs boost
      if (prefs?.cuisinePref && prefs.cuisinePref !== "surprise") {
        const prefMap: Record<string, string[]> = {
          asian: ["Japanese", "Chinese", "Vietnamese", "Thai", "Korean"],
          mexican: ["Mexican"],
          italian: ["Italian"],
          greek: ["Greek"],
          "middle-eastern": ["Middle Eastern", "Turkish"],
          chinese: ["Chinese"],
          japanese: ["Japanese"],
          latin: ["Mexican", "Latin"],
          indian: ["Indian"],
          american: ["American"],
          surprise: [],
        };
        if (prefMap[prefs.cuisinePref].includes(r.cuisine)) score += 2;
      }
      if (prefs?.dress === "nice" && r.price >= 3) score += 1;
      if (prefs?.dress === "casual" && r.price <= 2) score += 1;

      // trending boost
      const tIndex = sampleTrendingTop5.findIndex((c) => c === r.cuisine);
      if (tIndex >= 0) score += (5 - tIndex) * 0.5; // top trending gets larger boost

      // diet & vibes match boost
      if (filters.diet.length && filters.diet.every((d) => r.diet.includes(d))) score += 1;
      if (filters.vibes.length && filters.vibes.every((v) => r.vibes.includes(v))) score += 1;

      // distance
      let distance: number | undefined = undefined;
      if (userLoc) distance = haversineMiles(userLoc, { lat: r.lat, lon: r.lon });

      // filter out by filters (less restrictive)
      if (filters.maxPrice < 5 && r.price > filters.maxPrice) score = -1e9; // exclude
      if (r.rating < filters.minRating) score = -1e9;
      // Only apply distance filter if location is set
      if (userLoc && typeof distance === "number" && distance > filters.maxDistance) score -= 10; // penalize instead of exclude
      // Make diet/vibes optional - only apply if specifically selected
      if (filters.diet.length && !filters.diet.some((d) => r.diet.includes(d))) score -= 5;
      if (filters.vibes.length && !filters.vibes.some((v) => r.vibes.includes(v))) score -= 5;

      // budget mapping (rough): $~15, $$~30, $$$~50, $$$$>50
      if (filters.budgetPerPerson) {
        const maxByPrice = [0, 15, 30, 50, 80][r.price];
        if (maxByPrice > filters.budgetPerPerson + 5) score = -1e9;
      }

      // live signals (simulated)
      const busyNow = useLiveSignals ? Math.random() < 0.35 : undefined;
      const waitMins = useLiveSignals ? Math.floor(Math.random() * 25) : undefined;

      return { ...r, score, distance, busyNow, waitMins } as Restaurant & { score: number; distance?: number; busyNow?: boolean; waitMins?: number };
    });

    return base
      .filter((r) => r.score > -1e6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [prefs, filters, userLoc, useLiveSignals, searchedRestaurants, dataSource]);

  const wheelItems = useMemo(() => shortlist.map((r) => r.name), [shortlist]);

  const onToggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location not available", description: "Your browser doesn't support geolocation." });
      return;
    }
    
    toast({ title: "Requesting location...", description: "Please allow location access in your browser." });
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        toast({ title: "Location found!", description: `Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}` });
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({ title: "Location access denied", description: "Please allow location access or enter your city manually." });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSearch = () => {
    toast({ title: "Searching...", description: "Finding restaurants based on your preferences." });
    // The shortlist will automatically update due to the dependency array
  };

  // Handler for city search
  const handleCitySearch = (restaurants: any[], city: string) => {
    setCurrentCity(city);
    setSearchedRestaurants(restaurants);
    setDataSource('global');
  };

  const resetAll = () => {
    setPrefs(null);
    setFilters(defaultFilters);
    setUserLoc(null);
    setSearchedRestaurants([]);
    setCurrentCity("");
    setDataSource('local');
  };

  const scrollToSpinner = () => {
    document.getElementById("spinner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden">
        <div className="container py-10">
          <nav className="flex items-center justify-between">
            <a href="#" className="text-xl font-bold text-gradient-primary">IlliniEatz</a>
            <Button variant="outline" size="sm" onClick={resetAll}><RotateCcw className="mr-2" /> Reset</Button>
          </nav>
        </div>
        <div className="container grid lg:grid-cols-2 gap-8 items-center pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Crush decision fatigue. Find where to eat fast.
            </h1>
            <p className="mt-4 text-muted-foreground max-w-prose">
              Quick prefs, trending cuisines in your city, smart recommendations with deep links to Maps, Uber, and DoorDash — plus a fun Wheel of Food.
            </p>
            <div className="mt-6" />
          </div>
          <div className="relative hidden">
            {/* Hero image removed as requested */}
          </div>
        </div>
      </header>

      <main className="container space-y-10 pb-16">
        {!prefs ? (
          <QuickPreferences onComplete={(p) => setPrefs(p)} />
        ) : (
          <section className="grid gap-8">
            {/* City Search & Location */}
            <Card className="p-5">
              <div className="grid lg:grid-cols-4 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Search Any City</h3>
                  <CitySearch onCitySearch={handleCitySearch} currentCity={currentCity} />
                  {currentCity && (
                    <div className="mt-2 text-xs">
                      <span className="text-primary">Showing results for: {currentCity}</span>
                      <Button variant="link" size="sm" className="h-auto p-0 ml-2" onClick={() => {
                        setDataSource('local');
                        setCurrentCity("");
                        setSearchedRestaurants([]);
                      }}>
                        Back to local data
                      </Button>
                    </div>
                  )}
                </div>
            
            {/* Location & filters */}
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Location (Optional)</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={requestLocation}><MapPin className="mr-1" /> Use my location</Button>
                    {userLoc && (
                      <Button variant="outline" size="sm" onClick={() => setUserLoc(null)}>Clear location</Button>
                    )}
                  </div>
                  {userLoc && (
                    <p className="mt-1 text-xs text-green-600">Location set: {userLoc.lat.toFixed(4)}, {userLoc.lon.toFixed(4)}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Click "Use my location" to let us access your current location.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><SlidersHorizontal /> Filters</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <Label htmlFor="price">Max price</Label>
                      <Select value={String(filters.maxPrice)} onValueChange={(v) => setFilters((f) => ({ ...f, maxPrice: Number(v) as any }))}>
                        <SelectTrigger id="price"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">$</SelectItem>
                          <SelectItem value="2">$$</SelectItem>
                          <SelectItem value="3">$$$</SelectItem>
                          <SelectItem value="4">$$$$</SelectItem>
                          <SelectItem value="5">No limit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rating">Min rating</Label>
                      <Select value={String(filters.minRating)} onValueChange={(v) => setFilters((f) => ({ ...f, minRating: Number(v) }))}>
                        <SelectTrigger id="rating"><SelectValue placeholder=">= 4.0" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3.0+</SelectItem>
                          <SelectItem value="3.5">3.5+</SelectItem>
                          <SelectItem value="4">4.0+</SelectItem>
                          <SelectItem value="4.5">4.5+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="distance">Max distance (mi)</Label>
                      <Input id="distance" type="number" min={1} max={50} value={filters.maxDistance}
                        onChange={(e) => setFilters((f) => ({ ...f, maxDistance: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="budget">Budget per person ($)</Label>
                      <Input id="budget" type="number" min={5} max={200} value={filters.budgetPerPerson ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, budgetPerPerson: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Diet & vibes</h3>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {(["halal","vegetarian","gluten-free","vegan"] as Diet[]).map((d) => (
                      <Button key={d} variant={filters.diet.includes(d) ? "hero" : "outline"} size="sm" onClick={() => {
                        setFilters((f) => ({ ...f, diet: f.diet.includes(d) ? f.diet.filter((x) => x !== d) : [...f.diet, d] }));
                      }}>{d}</Button>
                    ))}
                    {(["quiet","group-friendly","date-night","lively","casual"] as const).map((v) => (
                      <Button key={v} variant={filters.vibes.includes(v) ? "hero" : "outline"} size="sm" onClick={() => {
                        setFilters((f) => ({ ...f, vibes: f.vibes.includes(v) ? f.vibes.filter((x) => x !== v) : [...f.vibes, v] }));
                      }}>{v}</Button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Switch id="live" checked={useLiveSignals} onCheckedChange={setUseLiveSignals} />
                    <Label htmlFor="live">Live signals (busy now, wait times)</Label>
                  </div>
                </div>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <Button onClick={handleSearch} className="px-8">
                  🔍 Search Restaurants
                </Button>
              </div>
            </Card>

            {/* Trending */}
            <section aria-label="Trending Cuisines Today" className="rounded-xl border p-5">
              <h3 className="font-semibold">Trending {currentCity ? `in ${currentCity}` : 'in your city'}</h3>
              <p className="text-sm text-muted-foreground">
                {dataSource === 'global' ? `Real-time data from ${currentCity}` : 'Top 5 cuisines people love today'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sampleTrendingTop5.map((c, i) => (
                  <span key={c} className="rounded-full bg-secondary px-3 py-1 text-sm">#{i + 1} {c}</span>
                ))}
              </div>
            </section>

            {/* Can't decide callout */}
            <section className="rounded-xl border p-4 flex items-center justify-between gap-3">
              <p className="text-sm">Can’t decide? Choose your favorites and spin the Food Spinner.</p>
              <Button variant="hero" size="sm" onClick={scrollToSpinner}>Open Spinner</Button>
            </section>

            <RecommendationsList items={shortlist} favorites={favorites} onToggleFavorite={onToggleFavorite} />

            <div id="spinner">
              <WheelOfFood
                items={wheelItems}
                onPick={(name) => toast({ title: "Your pick:", description: name })}
              />
            </div>

            {/* Group Mode placeholder */}
            <section className="rounded-xl border p-5">
              <h3 className="font-semibold mb-1">Group Mode</h3>
              <p className="text-sm text-muted-foreground mb-3">Invite friends to swipe yes/no and we’ll find the best mutual match. Coming soon with realtime rooms.</p>
              <Button variant="outline" disabled>Start a room (coming soon)</Button>
            </section>
          </section>
        )}
      </main>

      {prefs && shortlist.length > 1 && (
        <div className="fixed bottom-4 left-0 right-0 z-40">
          <div className="container">
            <div className="rounded-full border bg-card/90 backdrop-blur px-4 py-3 shadow-elevated flex items-center justify-between gap-3">
              <span className="text-sm">Can’t decide? Pick a few favorites and spin the Food Spinner.</span>
              <Button variant="hero" size="sm" onClick={scrollToSpinner}>Open Spinner</Button>
            </div>
          </div>
        </div>
      )}

      <footer className="container py-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} IlliniEatz. All rights reserved.
      </footer>
    </div>
  );
};

export default Index;
