-- Add new columns to restaurants_cache table for Google Reviews analysis
ALTER TABLE public.restaurants_cache 
ADD COLUMN IF NOT EXISTS review_summary jsonb,
ADD COLUMN IF NOT EXISTS review_texts jsonb,
ADD COLUMN IF NOT EXISTS detected_diet jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS detected_vibes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS review_analysis_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS place_attributes jsonb;