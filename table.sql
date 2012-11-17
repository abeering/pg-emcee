DROP TABLE IF EXISTS store;
DROP FUNCTION IF EXISTS store_upsert(akey VARCHAR(1024), avalue TEXT, aflags INT, aexptime INT, abytes INT);

CREATE TABLE store ( key VARCHAR(1024) PRIMARY KEY, value TEXT, flags INT, exptime INT, bytes INT );

-- upsert taken from http://www.postgresql.org/docs/current/static/plpgsql-control-structures.html#PLPGSQL-UPSERT-EXAMPLE
CREATE FUNCTION store_upsert(akey VARCHAR(1024), avalue TEXT, aflags INT, aexptime INT, abytes INT) RETURNS VOID AS
$$
BEGIN
    LOOP
        -- first try to update the key
        UPDATE store SET value = avalue, flags = aflags, exptime = aexptime, bytes = abytes WHERE key = akey;
        IF found THEN
            RETURN;
        END IF;
        -- not there, so try to insert the key
        -- if someone else inserts the same key concurrently,
        -- we could get a unique-key failure
        BEGIN
            INSERT INTO store ( key, value, flags, exptime, bytes ) VALUES ( akey, avalue, aflags, aexptime, abytes );
            RETURN;
        EXCEPTION WHEN unique_violation THEN
            -- do nothing, and loop to try the UPDATE again
        END;
    END LOOP;
END;
$$
LANGUAGE plpgsql;
