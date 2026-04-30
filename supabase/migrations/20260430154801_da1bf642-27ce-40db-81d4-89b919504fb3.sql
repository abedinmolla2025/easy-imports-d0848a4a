-- Add new columns to hadiths
ALTER TABLE public.hadiths
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS urdu TEXT,
  ADD COLUMN IF NOT EXISTS explanation_bn TEXT,
  ADD COLUMN IF NOT EXISTS lessons_bn TEXT[],
  ADD COLUMN IF NOT EXISTS topic_bn TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS hadiths_slug_unique_idx ON public.hadiths (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS hadiths_book_number_idx ON public.hadiths (book_key, hadith_number);

-- Auto-slug function
CREATE OR REPLACE FUNCTION public.auto_set_hadith_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  suffix INT := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND length(trim(NEW.slug)) > 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.book_key IS NOT NULL AND NEW.hadith_number IS NOT NULL THEN
    base_slug := lower(regexp_replace(NEW.book_key, '[^a-z0-9]+', '-', 'g')) || '-' || NEW.hadith_number::text;
  ELSE
    base_slug := 'hadith-' || substr(NEW.id::text, 1, 8);
  END IF;

  candidate := base_slug;
  WHILE EXISTS (
    SELECT 1 FROM public.hadiths WHERE slug = candidate AND id <> NEW.id
  ) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_set_hadith_slug_trg ON public.hadiths;
CREATE TRIGGER auto_set_hadith_slug_trg
  BEFORE INSERT OR UPDATE OF book_key, hadith_number, slug ON public.hadiths
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_hadith_slug();

-- Backfill existing rows
UPDATE public.hadiths
SET slug = lower(regexp_replace(book_key, '[^a-z0-9]+', '-', 'g')) || '-' || hadith_number::text
WHERE slug IS NULL AND book_key IS NOT NULL AND hadith_number IS NOT NULL;