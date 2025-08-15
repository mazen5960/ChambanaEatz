import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GooglePlacesResponse {
  results: Array<{
    place_id: string
    name: string
    types: string[]
    price_level?: number
    rating?: number
    user_ratings_total?: number
    geometry: {
      location: { lat: number; lng: number }
    }
    formatted_address: string
    opening_hours?: {
      open_now: boolean
    }
    photos?: Array<{ photo_reference: string }>
  }>
  status: string
}

function extractCuisineFromTypes(types: string[]): string {
  const cuisineMap: Record<string, string> = {
    'chinese_restaurant': 'Chinese',
    'japanese_restaurant': 'Japanese',
    'italian_restaurant': 'Italian',
    'mexican_restaurant': 'Mexican',
    'indian_restaurant': 'Indian',
    'thai_restaurant': 'Thai',
    'korean_restaurant': 'Korean',
    'french_restaurant': 'French',
    'greek_restaurant': 'Greek',
    'spanish_restaurant': 'Spanish',
    'american_restaurant': 'American',
    'mediterranean_restaurant': 'Mediterranean',
    'middle_eastern_restaurant': 'Middle Eastern',
    'vietnamese_restaurant': 'Vietnamese',
    'fast_food_restaurant': 'Fast Food',
    'pizza_restaurant': 'Pizza',
    'seafood_restaurant': 'Seafood',
    'steakhouse': 'Steakhouse',
    'vegetarian_restaurant': 'Vegetarian',
    'vegan_restaurant': 'Vegan'
  }

  for (const type of types) {
    if (cuisineMap[type]) {
      return cuisineMap[type]
    }
  }

  // Fallback to restaurant type if specific cuisine not found
  if (types.includes('restaurant')) {
    return 'Restaurant'
  }

  return 'Other'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { city, radius = 5000, type = 'restaurant' } = await req.json()

    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Searching for restaurants in ${city}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if we have cached data for this city (less than 24 hours old)
    const { data: cachedData, error: cacheError } = await supabase
      .from('restaurants_cache')
      .select('*')
      .eq('city', city.toLowerCase())
      .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (cacheError) {
      console.error('Cache error:', cacheError)
    }

    if (cachedData && cachedData.length > 0) {
      console.log(`Using cached data for ${city} (${cachedData.length} restaurants)`)
      
      // Log search for analytics
      await supabase.from('search_history').insert({
        city: city.toLowerCase(),
        search_query: `cached:${type}`,
        results_count: cachedData.length
      })

      return new Response(
        JSON.stringify({ 
          restaurants: cachedData.map(r => ({
            id: r.place_id,
            name: r.name,
            cuisine: r.cuisine || 'Restaurant',
            price: Math.min(r.price_level || 1, 4),
            rating: r.rating || 4.0,
            reviews: r.user_ratings_total || 100,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            address: r.address,
            hours: typeof r.opening_hours === 'object' ? JSON.stringify(r.opening_hours) : 'Hours vary',
            isOpenNow: r.is_open_now ?? true,
            diet: [], // Would need additional API calls to determine
            vibes: ['casual'] // Default vibe
          })),
          source: 'cache'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch fresh data from Google Places API
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      throw new Error('Google Places API key not configured')
    }

    // First, get city coordinates using Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${apiKey}`
    
    console.log('Fetching city coordinates...')
    const geocodeResponse = await fetch(geocodeUrl)
    const geocodeData = await geocodeResponse.json()

    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const location = geocodeData.results[0].geometry.location
    const country = geocodeData.results[0].address_components.find((comp: any) => 
      comp.types.includes('country'))?.long_name || 'Unknown'

    // Search for restaurants using Places API Nearby Search
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${type}&key=${apiKey}`
    
    console.log('Fetching restaurants from Google Places...')
    const placesResponse = await fetch(placesUrl)
    const placesData: GooglePlacesResponse = await placesResponse.json()

    if (placesData.status !== 'OK') {
      console.error('Places API error:', placesData.status)
      return new Response(
        JSON.stringify({ error: `Google Places API error: ${placesData.status}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Process and cache the results
    const restaurants = placesData.results
      .filter(place => place.types.includes('restaurant') || place.types.includes('food'))
      .map(place => ({
        place_id: place.place_id,
        name: place.name,
        cuisine: extractCuisineFromTypes(place.types),
        price_level: place.price_level || 2,
        rating: place.rating || 4.0,
        user_ratings_total: place.user_ratings_total || 100,
        lat: place.geometry.location.lat,
        lon: place.geometry.location.lng,
        address: place.formatted_address,
        opening_hours: place.opening_hours ? { open_now: place.opening_hours.open_now } : null,
        is_open_now: place.opening_hours?.open_now ?? true,
        photos: place.photos?.map(p => p.photo_reference) || [],
        city: city.toLowerCase(),
        country: country
      }))

    // Cache the results in Supabase
    if (restaurants.length > 0) {
      const { error: insertError } = await supabase
        .from('restaurants_cache')
        .upsert(restaurants, { 
          onConflict: 'place_id',
          ignoreDuplicates: false 
        })

      if (insertError) {
        console.error('Error caching restaurants:', insertError)
      } else {
        console.log(`Cached ${restaurants.length} restaurants for ${city}`)
      }
    }

    // Log search for analytics
    await supabase.from('search_history').insert({
      city: city.toLowerCase(),
      search_query: `fresh:${type}`,
      results_count: restaurants.length
    })

    // Transform to match frontend format
    const transformedRestaurants = restaurants.map(r => ({
      id: r.place_id,
      name: r.name,
      cuisine: r.cuisine,
      price: Math.min(r.price_level, 4),
      rating: r.rating,
      reviews: r.user_ratings_total,
      lat: r.lat,
      lon: r.lon,
      address: r.address,
      hours: r.opening_hours ? JSON.stringify(r.opening_hours) : 'Hours vary',
      isOpenNow: r.is_open_now,
      diet: [], // Would need additional processing
      vibes: ['casual'] // Default vibe
    }))

    return new Response(
      JSON.stringify({ 
        restaurants: transformedRestaurants,
        source: 'google_places',
        city: city,
        total: transformedRestaurants.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in search-restaurants function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})