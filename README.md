# PoC Starbucks CABA (Supabase + React/Vite + deck.gl + Vercel)
1. `npm install`
2. `npm run geocode` -> genera data/locales_sbx_caba_geo.csv (completar a mano las filas sin coordenadas)
3. Supabase: ejecutar supabase.sql e importar el CSV geocodificado en la tabla `puntos`
4. Copiar .env.example a .env y cargar URL y clave anon
5. `npm run dev` para probar
6. Subir a GitHub e importar en Vercel; cargar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Settings > Environment Variables
