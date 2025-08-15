import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CitySearchProps {
  onCitySearch: (restaurants: any[], city: string) => void;
  currentCity?: string;
}

const CitySearch = ({ onCitySearch, currentCity }: CitySearchProps) => {
  const [city, setCity] = useState(currentCity || "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!city.trim()) {
      toast({
        title: "Please enter a city name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    console.log('Starting search for city:', city.trim());
    
    try {
      console.log('Calling supabase function...');
      const { data, error } = await supabase.functions.invoke('search-restaurants', {
        body: { city: city.trim() }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      const { restaurants, source } = data;
      
      if (restaurants.length === 0) {
        toast({
          title: "No restaurants found",
          description: `No restaurants found in ${city}. Try a different city.`,
          variant: "destructive",
        });
        return;
      }

      // Transform cached restaurant data to match our Restaurant interface
      const transformedRestaurants = restaurants.map((r: any) => ({
        id: r.place_id,
        name: r.name,
        cuisine: r.cuisine,
        price: r.price_level || 2,
        rating: r.rating || 4.0,
        reviews: r.user_ratings_total || 0,
        lat: r.lat,
        lon: r.lon,
        address: r.address,
        hours: "Various", // Simplified for now
        isOpenNow: r.is_open_now ?? true,
        diet: [], // Default empty array
        vibes: ["casual"] // Default casual vibe
      }));

      onCitySearch(transformedRestaurants, city.trim());
      
      toast({
        title: `Found ${restaurants.length} restaurants in ${city}`,
        description: source === 'cache' ? 'Results loaded from cache' : 'Fresh results from Google Places',
      });

    } catch (error: any) {
      console.error('City search error:', error);
      toast({
        title: "Search failed",
        description: error.message || "Failed to search restaurants. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Enter city name (e.g., New York, Paris, Tokyo)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10"
          disabled={loading}
        />
      </div>
      <Button 
        onClick={handleSearch} 
        disabled={loading || !city.trim()}
        size="default"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Search
      </Button>
    </div>
  );
};

export default CitySearch;