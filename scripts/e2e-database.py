"""Manage only UUID-named schemas owned by an E2E run."""

import os
import re
import sys

import psycopg
from psycopg import sql


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in {"create", "drop"}:
        raise SystemExit("Use create ou drop com o schema E2E.")
    action, schema = sys.argv[1:]
    if not re.fullmatch(r"soundbard_e2e_[a-f0-9]{32}", schema):
        raise SystemExit("Schema E2E inválido; nenhuma operação executada.")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Configure DATABASE_URL para executar o E2E.")
    statement = "create schema {}" if action == "create" else "drop schema if exists {} cascade"
    try:
        with psycopg.connect(database_url, autocommit=True, connect_timeout=5) as connection:
            connection.execute(sql.SQL(statement).format(sql.Identifier(schema)))
    except psycopg.Error:
        raise SystemExit("Falha ao preparar ou limpar o schema E2E no PostgreSQL.") from None


if __name__ == "__main__":
    main()
