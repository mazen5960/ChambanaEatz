import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { appleMapsLink, doordashSearchLink, priceToSymbols, uberLink, Restaurant } from "@/types/restaurant";
import { MapPin, Star, ShoppingBag, Car, Heart, HeartOff } from "lucide-react";

interface Props {
  items: (Restaurant & { distance?: number; busyNow?: boolean; waitMins?: number })[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}

const RecommendationsList = ({ items, favorites, onToggleFavorite }: Props) => {
  if (!items.length) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        No matches yet. Try adjusting filters or preferences.
      </div>
    );
  }

  return (
    <section aria-label="Smart Recommendations" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((r) => (
        <Card key={r.id} className="relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{r.name}</span>
              <button
                aria-label={favorites.has(r.id) ? "Remove favorite" : "Save favorite"}
                className="rounded-md p-1 hover:bg-accent"
                onClick={() => onToggleFavorite(r.id)}
              >
                {favorites.has(r.id) ? (
                  <HeartOff className="text-destructive" />
                ) : (
                  <Heart className="text-primary" />
                )}
              </button>
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {r.cuisine} • {priceToSymbols(r.price)} • {r.isOpenNow ? "Open" : "Closed"}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <Star className="text-primary" />
                <span>{r.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({r.reviews}{r.reviews === 0 ? " - unreliable" : ""})
                </span>
              </div>
              {typeof r.distance === "number" && (
                <div className="flex items-center gap-1"><MapPin className="text-primary" /><span>{r.distance.toFixed(1)} mi</span></div>
              )}
              {r.waitMins ? (
                <div className="text-xs rounded-full bg-secondary px-2 py-1">~{r.waitMins} min wait</div>
              ) : null}
              {r.busyNow ? (
                <div className="text-xs rounded-full bg-accent px-2 py-1">Busy now</div>
              ) : null}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">{r.address}</div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={appleMapsLink(r)} target="_blank" rel="noopener noreferrer"><MapPin /> Maps</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={uberLink(r)} target="_blank" rel="noopener noreferrer"><Car /> Uber</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={doordashSearchLink(r)} target="_blank" rel="noopener noreferrer"><ShoppingBag /> DoorDash</a>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </section>
  );
};

export default RecommendationsList;
