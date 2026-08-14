exports.up = async function (knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jg_seasons_series_id
    ON public.jf_library_seasons ("SeriesId");
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jg_episodes_season_id
    ON public.jf_library_episodes ("SeasonId");
  `);

  await knex.raw(`
    ANALYZE public.jf_library_seasons;
    ANALYZE public.jf_library_episodes;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS public.idx_jg_episodes_season_id;`);
  await knex.raw(`DROP INDEX IF EXISTS public.idx_jg_seasons_series_id;`);
};
