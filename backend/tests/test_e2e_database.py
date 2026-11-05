import os
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg import sql

from backend.tests.test_library_store import configured_library as configured_library
from backend.tests.test_library_store import library_database as library_database

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "e2e-database.py"


def command(action, schema, database_url):
    return subprocess.run(
        [sys.executable, str(SCRIPT), action, schema],
        env={**os.environ, "DATABASE_URL": database_url},
        capture_output=True,
        text=True,
        timeout=15,
    )


def test_creates_and_removes_only_the_temporary_schema(library_database):
    schema = f"soundbard_e2e_{uuid.uuid4().hex}"
    sentinel = f"sentinel_{uuid.uuid4().hex}"
    with psycopg.connect(library_database, autocommit=True) as connection:
        connection.execute(
            sql.SQL("create table public.{} (value text)").format(sql.Identifier(sentinel))
        )
        try:
            created = command("create", schema, library_database)
            assert created.returncode == 0, created.stderr
            assert (
                connection.execute("select to_regnamespace(%s)", (schema,)).fetchone()[0] == schema
            )
            connection.execute(
                sql.SQL("create table {}.audio (id int)").format(sql.Identifier(schema))
            )
            dropped = command("drop", schema, library_database)
            assert dropped.returncode == 0, dropped.stderr
            assert connection.execute("select to_regnamespace(%s)", (schema,)).fetchone()[0] is None
            assert (
                connection.execute("select to_regclass(%s)", (f"public.{sentinel}",)).fetchone()[0]
                == sentinel
            )
        finally:
            connection.execute(
                sql.SQL("drop schema if exists {} cascade").format(sql.Identifier(schema))
            )
            connection.execute(sql.SQL("drop table public.{}").format(sql.Identifier(sentinel)))


@pytest.mark.parametrize(
    "schema", ["public", "soundbard_e2e_", "soundbard_e2e_bad;drop schema public"]
)
def test_rejects_non_temporary_schemas_before_connecting(schema):
    result = command("drop", schema, "postgresql://127.0.0.1:1/no_connection")
    assert result.returncode != 0
    assert "Schema E2E inválido" in result.stderr


def test_library_fixture_cannot_resolve_tables_from_public(library_database, configured_library):
    database_url, _ = configured_library
    sentinel = f"sentinel_{uuid.uuid4().hex}"
    with psycopg.connect(library_database, autocommit=True) as connection:
        connection.execute(
            sql.SQL("create table public.{} (value text)").format(sql.Identifier(sentinel))
        )
        try:
            with psycopg.connect(database_url) as isolated:
                with pytest.raises(psycopg.errors.UndefinedTable):
                    isolated.execute(sql.SQL("select * from {}").format(sql.Identifier(sentinel)))
        finally:
            connection.execute(sql.SQL("drop table public.{}").format(sql.Identifier(sentinel)))
