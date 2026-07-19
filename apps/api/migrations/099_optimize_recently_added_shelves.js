exports.up = async function (knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jf_library_items_recent_shelves
    ON public.jf_library_items ("ParentId", "DateCreated" DESC)
    WHERE archived=false AND "Type" != 'Series' AND "DateCreated" IS NOT NULL;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jf_library_episodes_recent_shelves
    ON public.jf_library_episodes ("SeriesId", "DateCreated" DESC)
    WHERE archived=false AND "DateCreated" IS NOT NULL;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jf_libraries_active
    ON public.jf_libraries ("Id")
    WHERE archived=false;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS public.idx_jf_libraries_active;`);
  await knex.raw(`DROP INDEX IF EXISTS public.idx_jf_library_episodes_recent_shelves;`);
  await knex.raw(`DROP INDEX IF EXISTS public.idx_jf_library_items_recent_shelves;`);
};
