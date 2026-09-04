exports.up = async function (knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jf_playback_activity_user_date
    ON public.jf_playback_activity ("UserId", "ActivityDateInserted" DESC);
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.fs_get_user_activity(user_id text, library_ids text[])
    RETURNS TABLE(
        "UserName" text,
        "Title" text,
        "EpisodeCount" bigint,
        "FirstActivityDate" timestamp with time zone,
        "LastActivityDate" timestamp with time zone,
        "TotalPlaybackDuration" bigint,
        "SeasonName" text,
        "MediaType" text,
        "NowPlayingItemId" text
    )
    LANGUAGE plpgsql
    AS $function$
    BEGIN
        RETURN QUERY
        WITH RecentPlayback AS (
            SELECT
                jp."UserName" AS "UserNameCol",
                COALESCE(jp."SeriesName", jp."NowPlayingItemName") AS "TitleCol",
                jp."EpisodeId" AS "EpisodeIdCol",
                jp."ActivityDateInserted" AS "ActivityDateInsertedCol",
                jp."PlaybackDuration" AS "PlaybackDurationCol",
                ls."Name" AS "SeasonNameCol",
                jl."CollectionType" AS "MediaTypeCol",
                jp."NowPlayingItemId" AS "NowPlayingItemIdCol"
            FROM public.jf_playback_activity AS jp
            JOIN public.jf_library_items AS jli ON jp."NowPlayingItemId" = jli."Id"
            JOIN public.jf_libraries AS jl ON jli."ParentId" = jl."Id"
            LEFT JOIN public.jf_library_seasons AS ls ON jp."SeasonId" = ls."Id"
            WHERE jp."UserId" = user_id
              AND (COALESCE(cardinality(library_ids), 0) = 0 OR jl."Id" = ANY(library_ids))
            ORDER BY jp."ActivityDateInserted" DESC
            LIMIT 4000
        ),
        DateDifferences AS (
            SELECT
                "UserNameCol",
                "TitleCol",
                "EpisodeIdCol",
                "ActivityDateInsertedCol",
                "PlaybackDurationCol",
                "SeasonNameCol",
                "MediaTypeCol",
                "NowPlayingItemIdCol",
                LAG("ActivityDateInsertedCol") OVER (PARTITION BY "UserNameCol" ORDER BY "ActivityDateInsertedCol") AS prev_date,
                LAG("TitleCol") OVER (PARTITION BY "UserNameCol" ORDER BY "ActivityDateInsertedCol") AS prev_title
            FROM RecentPlayback
        ),
        GroupedEntries AS (
            SELECT
                "UserNameCol",
                "TitleCol",
                "EpisodeIdCol",
                "ActivityDateInsertedCol",
                "PlaybackDurationCol",
                "SeasonNameCol",
                "MediaTypeCol",
                "NowPlayingItemIdCol",
                CASE
                    WHEN prev_title IS DISTINCT FROM "TitleCol" THEN 1
                    WHEN prev_date IS NULL OR "ActivityDateInsertedCol" > prev_date + INTERVAL '1 month' THEN 1
                    ELSE 0
                END AS new_group
            FROM DateDifferences
        ),
        FinalGroups AS (
            SELECT
                "UserNameCol",
                "TitleCol",
                "EpisodeIdCol",
                "ActivityDateInsertedCol",
                "PlaybackDurationCol",
                "SeasonNameCol",
                "MediaTypeCol",
                "NowPlayingItemIdCol",
                SUM(new_group) OVER (PARTITION BY "UserNameCol" ORDER BY "ActivityDateInsertedCol") AS grp
            FROM GroupedEntries
        )
        SELECT
            "UserNameCol" AS "UserName",
            "TitleCol" AS "Title",
            COUNT(DISTINCT "EpisodeIdCol") AS "EpisodeCount",
            MIN("ActivityDateInsertedCol") AS "FirstActivityDate",
            MAX("ActivityDateInsertedCol") AS "LastActivityDate",
            SUM("PlaybackDurationCol")::bigint AS "TotalPlaybackDuration",
            "SeasonNameCol" AS "SeasonName",
            MAX("MediaTypeCol") AS "MediaType",
            "NowPlayingItemIdCol" AS "NowPlayingItemId"
        FROM FinalGroups
        GROUP BY
            "UserNameCol",
            "TitleCol",
            "SeasonNameCol",
            "NowPlayingItemIdCol",
            grp
        HAVING
            NOT (MAX("MediaTypeCol") = 'Shows' AND "SeasonNameCol" IS NULL)
            AND SUM("PlaybackDurationCol") >= 20
        ORDER BY
            MAX("ActivityDateInsertedCol") DESC;
    END;
    $function$;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS public.idx_jf_playback_activity_user_date;`);
};
