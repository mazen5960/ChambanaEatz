import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  price_level?: number;
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
  photos?: Array<{
    photo_reference: string;
  }>;
  opening_hours?: {
    open_now: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, lat, lng, radius = 5000 } = await req.json();
    
    if (!city && (!lat || !lng)) {
      throw new Error('Either city name or coordinates (lat, lng) are required');
    }

    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Places API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first if we have city name
    let cachedResults = [];
    if (city) {
      console.log(`Checking cache for city: ${city}`);
      const { data: cached } = await supabase
        .from('restaurants_cache')
        .select('*')
        .ilike('city', city)
        .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // 24 hours cache

      if (cached && cached.length > 0) {
        console.log(`Found ${cached.length} cached results for ${city}`);
        return new Response(JSON.stringify({ restaurants: cached, source: 'cache' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get coordinates if we only have city name
    let searchLat = lat;
    let searchLng = lng;
    let searchCity = city;

    if (city && (!lat || !lng)) {
      console.log(`Getting coordinates for city: ${city}`);
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${googleApiKey}`
      );
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.results && geocodeData.results.length > 0) {
        const location = geocodeData.results[0].geometry.location;
        searchLat = location.lat;
        searchLng = location.lng;
        searchCity = geocodeData.results[0].address_components.find((comp: any) => 
          comp.types.includes('locality') || comp.types.includes('administrative_area_level_1')
        )?.long_name || city;
      } else {
        throw new Error(`Could not find coordinates for city: ${city}`);
      }
    }

    // Search Google Places API
    console.log(`Searching restaurants near ${searchLat}, ${searchLng} with radius ${radius}m`);
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}&radius=${radius}&type=restaurant&key=${googleApiKey}`
    );

    const placesData = await placesResponse.json();
    
    if (placesData.status !== 'OK') {
      throw new Error(`Google Places API error: ${placesData.status} - ${placesData.error_message || 'Unknown error'}`);
    }

    // Transform and cache results
    const restaurants = placesData.results.map((place: PlaceResult) => {
      // Simple cuisine detection based on place types and name
      let cuisine = 'American';
      const placeTypes = place.types.join(' ').toLowerCase();
      const placeName = place.name.toLowerCase();

      if (placeTypes.includes('chinese') || placeName.includes('chinese')) cuisine = 'Chinese';
      else if (placeTypes.includes('italian') || placeName.includes('italian') || placeName.includes('pizza')) cuisine = 'Italian';
      else if (placeTypes.includes('mexican') || placeName.includes('mexican') || placeName.includes('taco')) cuisine = 'Mexican';
      else if (placeName.includes('sushi') || placeName.includes('japanese')) cuisine = 'Japanese';
      else if (placeName.includes('indian') || placeName.includes('curry')) cuisine = 'Indian';
      else if (placeName.includes('thai')) cuisine = 'Asian';
      else if (placeName.includes('mediterranean') || placeName.includes('greek')) cuisine = 'Greek';

      return {
        place_id: place.place_id,
        name: place.name,
        cuisine,
        price_level: place.price_level || 2,
        rating: place.rating || 4.0,
        user_ratings_total: place.user_ratings_total || 0,
        lat: place.geometry.location.lat,
        lon: place.geometry.location.lng,
        address: place.vicinity || '',
        opening_hours: place.opening_hours || {},
        is_open_now: place.opening_hours?.open_now || true,
        photos: place.photos?.map(p => p.photo_reference) || [],
        city: searchCity,
        country: 'Unknown'
      };
    });

    // Cache results in Supabase
    if (restaurants.length > 0) {
      console.log(`Caching ${restaurants.length} restaurants for ${searchCity}`);
      const { error: cacheError } = await supabase
        .from('restaurants_cache')
        .upsert(restaurants, { onConflict: 'place_id' });

      if (cacheError) {
        console.error('Cache error:', cacheError);
      }

      // Log search for analytics
      await supabase
        .from('search_history')
        .insert({
          city: searchCity,
          search_query: `${searchLat},${searchLng}`,
          results_count: restaurants.length
        });
    }

    return new Response(JSON.stringify({ restaurants, source: 'api' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-restaurants function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      restaurants: [],
      source: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});