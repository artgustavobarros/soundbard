"""Contratos HTTP para a biblioteca persistida no servidor."""

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from psycopg import Error as DatabaseError
from psycopg_pool import PoolTimeout
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from backend.library_models import LibraryManifest
from backend.library_store import LibraryConflict

router = APIRouter(prefix="/api/library")
MAX_MANIFEST_BYTES = 16 * 1024 * 1024


def store(request: Request):
    value = request.app.state.library_store
    if value is None:
        raise HTTPException(503, "Configure DATABASE_URL para abrir a biblioteca do servidor.")
    return value


@router.get("")
def read_library(request: Request):
    try:
        return store(request).read()
    except (DatabaseError, PoolTimeout) as error:
        raise HTTPException(503, "A biblioteca do servidor está indisponível.") from error


@router.put("")
async def save_library(
    request: Request,
    library: Annotated[str, Form()],
    files: Annotated[list[UploadFile] | None, File()] = None,
):
    uploads = files or []
    try:
        target = store(request)
        if len(library.encode("utf-8")) > MAX_MANIFEST_BYTES:
            raise HTTPException(413, "O manifesto da biblioteca é grande demais.")
        try:
            manifest = LibraryManifest.model_validate_json(library)
        except ValidationError as error:
            raise HTTPException(422, "Organização inválida da biblioteca.") from error
        if len({file.filename for file in uploads}) != len(uploads):
            raise HTTPException(422, "Há arquivos repetidos no envio.")
        if any(not file.filename for file in uploads):
            raise HTTPException(422, "Identificador de arquivo ausente.")
        return await run_in_threadpool(
            target.commit, manifest, {file.filename: file.file for file in uploads}
        )
    except LibraryConflict as error:
        raise HTTPException(409, str(error)) from error
    except (DatabaseError, PoolTimeout) as error:
        raise HTTPException(503, "A biblioteca do servidor está indisponível.") from error
    finally:
        for file in uploads:
            await file.close()


@router.get("/files/{identifier}")
def library_file(identifier: str, request: Request):
    try:
        file, mime = store(request).file(identifier)
    except LookupError as error:
        raise HTTPException(404, "Áudio não encontrado.") from error
    except (DatabaseError, PoolTimeout) as error:
        raise HTTPException(503, "A biblioteca do servidor está indisponível.") from error
    return FileResponse(file, media_type=mime, headers={"X-Content-Type-Options": "nosniff"})
