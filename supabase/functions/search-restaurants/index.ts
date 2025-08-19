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

interface PlaceDetailsResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  reviews?: Array<{
    text: string;
    rating: number;
    time: number;
  }>;
  types?: string[];
  photos?: Array<{
    photo_reference: string;
  }>;
}

// Diet and vibe detection keywords
const DIET_KEYWORDS = {
  vegetarian: ['vegetarian', 'veggie', 'plant-based', 'vegetarian-friendly', 'vegetarian options', 'veggie options'],
  vegan: ['vegan', 'plant-based', 'dairy-free', 'vegan options', 'vegan menu', 'vegan friendly'],
  halal: ['halal', 'halal certified', 'muslim-friendly', 'no pork', 'halal meat', 'halal food'],
  'gluten-free': ['gluten-free', 'gluten free', 'celiac', 'gf options', 'gluten-free menu', 'no gluten']
};

const VIBE_KEYWORDS = {
  quiet: ['quiet', 'peaceful', 'intimate', 'cozy', 'calm', 'serene', 'tranquil'],
  'group-friendly': ['large groups', 'family-friendly', 'spacious', 'accommodating groups', 'big parties', 'group dining'],
  'date-night': ['romantic', 'intimate', 'perfect for date', 'cozy atmosphere', 'candlelit', 'date spot'],
  lively: ['energetic', 'vibrant', 'bustling', 'lively atmosphere', 'busy', 'upbeat', 'lively'],
  casual: ['casual', 'relaxed', 'laid-back', 'informal', 'comfortable', 'no dress code']
};

function detectAttributesFromReviews(reviews: Array<{text: string, rating: number}>) {
  const detectedDiet: string[] = [];
  const detectedVibes: string[] = [];
  
  const allReviewText = reviews.map(r => r.text.toLowerCase()).join(' ');
  
  // Detect dietary options
  for (const [diet, keywords] of Object.entries(DIET_KEYWORDS)) {
    const matches = keywords.filter(keyword => allReviewText.includes(keyword)).length;
    if (matches >= 1) { // At least 1 mention
      detectedDiet.push(diet);
    }
  }
  
  // Detect vibes
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    const matches = keywords.filter(keyword => allReviewText.includes(keyword)).length;
    if (matches >= 1) { // At least 1 mention
      detectedVibes.push(vibe);
    }
  }
  
  return { detectedDiet, detectedVibes };
}

serve(async (req) => {
  console.log('=== Search Restaurants Function Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const { city, lat, lng, radius = 5000 } = requestBody;
    
    if (!city && (!lat || !lng)) {
      throw new Error('Either city name or coordinates (lat, lng) are required');
    }

    // Detailed API key validation
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    console.log('Google API key check:', googleApiKey ? 'API key found' : 'API key NOT found');
    
    if (!googleApiKey) {
      console.error('CRITICAL: Google Places API key not configured in environment variables');
      throw new Error('Google Places API key not configured');
    }

    // Test the API key with a simple request
    console.log('Testing Google API key validity...');
    try {
      const testResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${googleApiKey}`
      );
      const testData = await testResponse.json();
      console.log('API key test response status:', testData.status);
      
      if (testData.status === 'REQUEST_DENIED') {
        console.error('API key is invalid or restricted:', testData.error_message);
        throw new Error(`Google API key error: ${testData.error_message}`);
      }
    } catch (keyTestError) {
      console.error('Failed to validate API key:', keyTestError);
      throw new Error('Google API key validation failed');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (24 hour cache)
    console.log(`Checking cache for ${city || 'coordinates'}`);
    const cacheKey = city || `${lat},${lng}`;
    const { data: cachedResults } = await supabase
      .from('restaurants_cache')
      .select('*')
      .eq('city', cacheKey)
      .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('rating', { ascending: false })
      .limit(20);

    if (cachedResults && cachedResults.length > 0) {
      console.log(`Found ${cachedResults.length} cached restaurants`);
      
      // Log search history
      try {
        await supabase.from('search_history').insert({
          city: cacheKey,
          search_query: 'cached_results',
          results_count: cachedResults.length
        });
      } catch (error) {
        console.log('Analytics logging error (non-fatal):', error);
      }
      
      // Transform cached results to match expected format
      const transformedResults = cachedResults.map(restaurant => ({
        id: restaurant.place_id,
        name: restaurant.name,
        cuisine: restaurant.cuisine || 'Restaurant',
        price: restaurant.price_level || 2,
        rating: Number(restaurant.rating) || 0,
        reviews: restaurant.user_ratings_total || 0,
        lat: Number(restaurant.lat),
        lon: Number(restaurant.lon),
        address: restaurant.address || '',
        hours: 'Call for hours',
        isOpenNow: restaurant.is_open_now || false,
        diet: restaurant.detected_diet || [],
        vibes: restaurant.detected_vibes || []
      }));
      
      return new Response(JSON.stringify({ restaurants: transformedResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      
      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding API error: ${geocodeResponse.status}`);
      }
      
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status === 'ZERO_RESULTS') {
        throw new Error(`No results found for city: ${city}. Please try a different city name or check spelling.`);
      }
      
      if (geocodeData.status !== 'OK') {
        throw new Error(`Geocoding API error: ${geocodeData.status} - ${geocodeData.error_message || 'Unknown error'}`);
      }
      
      if (geocodeData.results && geocodeData.results.length > 0) {
        const location = geocodeData.results[0].geometry.location;
        searchLat = location.lat;
        searchLng = location.lng;
        
        const addressComponents = geocodeData.results[0].address_components;
        searchCity = addressComponents.find((comp: any) => 
          comp.types.includes('locality')
        )?.long_name || city;
        
        console.log(`Found coordinates for ${city}: ${searchLat}, ${searchLng}`);
      } else {
        throw new Error(`Could not find coordinates for city: ${city}`);
      }
    }

    // Search Google Places API
    console.log(`Searching restaurants near ${searchLat}, ${searchLng} with radius ${radius}m`);
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}&radius=${radius}&type=restaurant&key=${googleApiKey}`
    );

    if (!placesResponse.ok) {
      throw new Error(`Google Places API HTTP error: ${placesResponse.status}`);
    }

    const data = await placesResponse.json();
    console.log(`Google Places API response status: ${data.status}`);
    
    if (data.status !== 'OK') {
      console.error('Google Places API error:', data);
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    // Fetch detailed information for each restaurant including reviews
    const detailedResults = [];
    
    for (const place of data.results.slice(0, 20)) {
      try {
        // Fetch place details with reviews
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,rating,user_ratings_total,price_level,opening_hours,reviews,types,photos&key=${googleApiKey}`;
        
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === 'OK' && detailsData.result) {
          const placeDetails: PlaceDetailsResult = detailsData.result;
          
          // Analyze reviews for dietary and vibe information
          let detectedDiet: string[] = [];
          let detectedVibes: string[] = [];
          let reviewTexts: string[] = [];
          
          if (placeDetails.reviews && placeDetails.reviews.length > 0) {
            reviewTexts = placeDetails.reviews.map(review => review.text);
            const analysis = detectAttributesFromReviews(placeDetails.reviews);
            detectedDiet = analysis.detectedDiet;
            detectedVibes = analysis.detectedVibes;
          }
          
          // Simple cuisine detection from place types
          let cuisine = 'Restaurant';
          if (placeDetails.types) {
            if (placeDetails.types.includes('pizza')) cuisine = 'Pizza';
            else if (placeDetails.types.includes('chinese_restaurant')) cuisine = 'Chinese';
            else if (placeDetails.types.includes('italian_restaurant')) cuisine = 'Italian';
            else if (placeDetails.types.includes('mexican_restaurant')) cuisine = 'Mexican';
            else if (placeDetails.types.includes('japanese_restaurant')) cuisine = 'Japanese';
            else if (placeDetails.types.includes('indian_restaurant')) cuisine = 'Indian';
            else if (placeDetails.types.includes('thai_restaurant')) cuisine = 'Thai';
            else if (placeDetails.types.includes('american_restaurant')) cuisine = 'American';
            else if (placeDetails.types.includes('french_restaurant')) cuisine = 'French';
            else if (placeDetails.types.includes('cafe')) cuisine = 'Cafe';
            else if (placeDetails.types.includes('bakery')) cuisine = 'Bakery';
            else if (placeDetails.types.includes('fast_food')) cuisine = 'Fast Food';
          }
          
          detailedResults.push({
            place_id: placeDetails.place_id,
            name: placeDetails.name,
            lat: placeDetails.geometry.location.lat,
            lon: placeDetails.geometry.location.lng,
            address: placeDetails.formatted_address || '',
            rating: placeDetails.rating || 0,
            user_ratings_total: placeDetails.user_ratings_total || 0,
            price_level: placeDetails.price_level || null,
            cuisine: cuisine,
            is_open_now: placeDetails.opening_hours?.open_now || false,
            photos: placeDetails.photos?.map(photo => photo.photo_reference) || [],
            opening_hours: placeDetails.opening_hours?.weekday_text || null,
            city: cacheKey,
            country: 'Unknown',
            review_texts: reviewTexts,
            detected_diet: detectedDiet,
            detected_vibes: detectedVibes,
            review_analysis_date: new Date().toISOString(),
            place_attributes: {
              types: placeDetails.types || [],
              has_reviews: !!placeDetails.reviews?.length
            },
            cached_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.log(`Error fetching details for ${place.place_id}:`, error);
        // Fallback to basic info from nearby search
        let cuisine = 'Restaurant';
        if (place.types) {
          if (place.types.includes('pizza')) cuisine = 'Pizza';
          else if (place.types.includes('chinese_restaurant')) cuisine = 'Chinese';
          else if (place.types.includes('italian_restaurant')) cuisine = 'Italian';
        }
        
        detailedResults.push({
          place_id: place.place_id,
          name: place.name,
          lat: place.geometry.location.lat,
          lon: place.geometry.location.lng,
          address: place.vicinity || '',
          rating: place.rating || 0,
          user_ratings_total: place.user_ratings_total || 0,
          price_level: place.price_level || null,
          cuisine: cuisine,
          is_open_now: place.opening_hours?.open_now || false,
          photos: place.photos?.map(photo => photo.photo_reference) || [],
          opening_hours: null,
          city: cacheKey,
          country: 'Unknown',
          review_texts: [],
          detected_diet: [],
          detected_vibes: [],
          review_analysis_date: new Date().toISOString(),
          place_attributes: { types: place.types || [], has_reviews: false },
          cached_at: new Date().toISOString()
        });
      }
    }

    // Cache the results
    console.log(`Attempting to cache ${detailedResults.length} restaurants for ${cacheKey}`);
    try {
      const { error: cacheError } = await supabase
        .from('restaurants_cache')
        .upsert(detailedResults, { 
          onConflict: 'place_id',
          ignoreDuplicates: false 
        });
      
      if (cacheError) {
        console.log('Cache error (non-fatal):', cacheError);
      } else {
        console.log('Successfully cached restaurant results');
      }
    } catch (error) {
      console.log('Cache error (non-fatal):', error);
    }

    // Log search history
    try {
      await supabase.from('search_history').insert({
        city: cacheKey,
        search_query: `${lat},${lng},${radius}`,
        results_count: detailedResults.length
      });
    } catch (error) {
      console.log('Analytics logging error (non-fatal):', error);
    }

    // Transform to expected frontend format
    const finalResults = detailedResults.map(restaurant => ({
      id: restaurant.place_id,
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      price: restaurant.price_level || 2,
      rating: Number(restaurant.rating),
      reviews: restaurant.user_ratings_total,
      lat: Number(restaurant.lat),
      lon: Number(restaurant.lon),
      address: restaurant.address,
      hours: 'Call for hours',
      isOpenNow: restaurant.is_open_now,
      diet: restaurant.detected_diet,
      vibes: restaurant.detected_vibes
    }));

    return new Response(JSON.stringify({ restaurants: finalResults }), {
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