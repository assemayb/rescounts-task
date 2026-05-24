\set ON_ERROR_STOP on

CREATE DATABASE rescounts_test;

\connect rescounts
\i /docker-entrypoint-initdb.d/schema.template

\connect rescounts_test
\i /docker-entrypoint-initdb.d/schema.template
