import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onCitySearch: (city: string, restaurants: any[]) => void;
  isLoading: boolean;
}

const CityInput = ({ onCitySearch, isLoading }: Props) => {
  const [city, setCity] = useState("");
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!city.trim()) {
      toast({
        title: "Please enter a city name",
        description: "Enter the name of a city to search for restaurants",
        variant: "destructive"
      });
      return;
    }

    try {
      await onCitySearch(city.trim(), []);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: "Unable to search for restaurants. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch();
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Search Any City
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter city name (e.g., New York, Tokyo, Paris)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button 
            onClick={handleSearch} 
            disabled={isLoading || !city.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Search for restaurants in any city worldwide using real-time data
        </p>
      </CardContent>
    </Card>
  );
};

export default CityInput;