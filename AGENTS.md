
- Studio Hero v2 (identity sheet + locked recipe) is benchmarked via the Super Admin-only `studio-hero-benchmark` function, which never writes vehicle_photos; a recipe/model only replaces the live `render-studio-hero` setup after scoring at least as well on the fixed benchmark cars — prevents prompt regressions.
