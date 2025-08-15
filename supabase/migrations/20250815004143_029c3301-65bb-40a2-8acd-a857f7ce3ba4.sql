-- Create table for caching restaurant data from Google Places API
CREATE TABLE public.restaurants_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cuisine TEXT,
  price_level INTEGER, -- 0-4 (Google's price level)
  rating DECIMAL(2,1),
  user_ratings_total INTEGER,
  lat DECIMAL(10,8) NOT NULL,
  lon DECIMAL(11,8) NOT NULL,
  address TEXT,
  opening_hours JSONB,
  is_open_now BOOLEAN,
  photos TEXT[], -- array of photo references
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient city searches
CREATE INDEX idx_restaurants_cache_city ON public.restaurants_cache(city);
CREATE INDEX idx_restaurants_cache_location ON public.restaurants_cache(lat, lon);
CREATE INDEX idx_restaurants_cache_cached_at ON public.restaurants_cache(cached_at);

-- Enable Row Level Security (make data public for this use case)
ALTER TABLE public.restaurants_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access to restaurant cache" 
ON public.restaurants_cache 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_restaurants_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_restaurants_cache_updated_at
  BEFORE UPDATE ON public.restaurants_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurants_cache_updated_at();

-- Create table for user search history (optional - for analytics)
CREATE TABLE public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  search_query TEXT,
  results_count INTEGER,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for search history
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Allow public insert for analytics
CREATE POLICY "Allow public insert to search history" 
ON public.search_history 
FOR INSERT 
WITH CHECK (true);