-- Hasura run_sql args.read_only=true mellett; csak darabszám és időpont.
WITH events AS MATERIALIZED (
 SELECT id,payload,delivered,created_at FROM hdb_catalog.event_log
 WHERE trigger_name='messages--insert'
 AND created_at >= '2026-11-03T00:00:00' AND created_at < '2026-11-11T00:00:00'
 AND created_at::time >= '17:00:00' AND created_at::time < '17:01:00'
), cohort AS (
 SELECT m.id,to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day
 FROM public.messages m JOIN public.threads t ON t.id=m.thread_id
 WHERE t.channel='channex' AND m.sender='property'
 AND m.created_at >= '2026-11-03T00:00:00Z' AND m.created_at < '2026-11-11T00:00:00Z'
 AND (m.created_at AT TIME ZONE 'UTC')::time >= '17:00:00'
 AND (m.created_at AT TIME ZONE 'UTC')::time < '17:01:00'
)
SELECT c.day,count(DISTINCT c.id) AS messages,count(e.id) AS insert_events,
 count(e.id) FILTER(WHERE e.delivered) AS delivered_events,
 sum(v.attempts) AS attempts,sum(v.rate_limited) AS rate_limited_attempts,
 count(e.id) FILTER(WHERE v.first_success < (c.day || 'T17:05:00')::timestamp) AS succeeded_by_1705,
 max(v.first_success) AS last_first_success
FROM cohort c LEFT JOIN events e ON e.payload#>>'{data,new,id}'=c.id::text
LEFT JOIN LATERAL (
 SELECT count(*) AS attempts,
 count(*) FILTER(WHERE i.response::text LIKE '%http_too_many_requests%' OR i.response::text LIKE '%Too Many Requests%') AS rate_limited,
 min(i.created_at) FILTER(WHERE i.status=200) AS first_success
 FROM hdb_catalog.event_invocation_logs i WHERE i.event_id=e.id
) v ON true GROUP BY c.day ORDER BY c.day;
