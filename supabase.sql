create table if not exists puntos (
  id bigint generated always as identity primary key,
  cc int, nombre text, direccion text, direccion_geocode text,
  categoria text, valor int, dias text,
  latitud double precision, longitud double precision
);
alter table puntos enable row level security;
create policy "lectura publica" on puntos for select using (true);
-- Luego: Table Editor > puntos > Import data from CSV (data/locales_sbx_caba_geo.csv)
