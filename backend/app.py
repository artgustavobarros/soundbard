"""API de processamento e servidor da interface local do Soundbard."""

import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.media import MediaService, ffmpeg_path, normalize_youtube_url

FRONTEND = Path(__file__).resolve().parent.parent / "dist" / "client"
MAX_UPLOAD = 256 * 1024 * 1024
LOCAL_ORIGINS = {"http://localhost:3000", "http://127.0.0.1:3000"}


class VideoInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    url: str = Field(max_length=2048)

    @field_validator("url")
    @classmethod
    def youtube_video(cls, value: str) -> str:
        return normalize_youtube_url(value)


class ClipInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    start: float = Field(default=0, ge=0, le=28800, allow_inf_nan=False)
    end: float | None = Field(default=None, gt=0, le=28800, allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered_bounds(self):
        if self.end is not None and self.end <= self.start:
            raise ValueError("O fim precisa ser maior que o início do trecho.")
        return self


class DownloadInput(VideoInput, ClipInput):
    purpose: Literal["clip", "preview"] = "clip"


@asynccontextmanager
async def lifespan(application: FastAPI):
    with tempfile.TemporaryDirectory(prefix="soundbard-") as directory:
        application.state.uploads = Path(directory) / "uploads"
        application.state.uploads.mkdir()
        application.state.media = MediaService(Path(directory) / "jobs")
        try:
            yield
        finally:
            await run_in_threadpool(application.state.media.close)


def create_app(frontend: Path = FRONTEND) -> FastAPI:
    application = FastAPI(title="Soundbard local", version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]"]
    )

    @application.middleware("http")
    async def local_requests(request: Request, call_next):
        is_api = request.url.path.startswith("/api/")
        origin = request.headers.get("origin")
        if is_api and origin is not None and origin not in LOCAL_ORIGINS:
            return JSONResponse(
                {"detail": "A API aceita apenas a interface local do Soundbard."},
                status_code=403,
                headers={"Cache-Control": "no-store"},
            )
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store" if is_api else "no-cache"
        return response

    @application.exception_handler(ValueError)
    async def invalid_input(_request: Request, error: ValueError):
        return JSONResponse({"detail": str(error)}, status_code=422)

    @application.exception_handler(LookupError)
    async def missing_job(_request: Request, _error: LookupError):
        return JSONResponse({"detail": "Esta tarefa não está mais disponível."}, status_code=404)

    @application.get("/api/health")
    def health():
        try:
            available = Path(ffmpeg_path()).is_file()
        except (OSError, RuntimeError):
            available = False
        return {"status": "ok", "ffmpeg": available, "youtube": True}

    @application.post("/api/youtube/metadata")
    async def metadata(data: VideoInput, request: Request):
        return await run_in_threadpool(request.app.state.media.metadata, data.url)

    @application.post("/api/audio-jobs", status_code=202)
    def download(data: DownloadInput, request: Request):
        return request.app.state.media.create_download(
            data.url, data.name, data.start, data.end, data.purpose
        )

    @application.post("/api/audio-jobs/upload", status_code=202)
    async def clip(
        request: Request,
        file: Annotated[UploadFile, File()],
        name: Annotated[str, Form(min_length=1, max_length=200)],
        start: Annotated[float, Form(ge=0, le=28800)] = 0,
        end: Annotated[float | None, Form(gt=0, le=28800)] = None,
        purpose: Annotated[Literal["clip", "preview"], Form()] = "clip",
    ):
        # A extensão seleciona os formatos aceitos; o FFmpeg verifica o conteúdo real.
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in {".mp3", ".wav", ".ogg"}:
            raise HTTPException(422, "Envie um arquivo MP3, WAV ou OGG.")
        if file.size is not None and file.size > MAX_UPLOAD:
            raise HTTPException(413, "O arquivo deve ter no máximo 256 MB.")
        ClipInput(name=name, start=start, end=end)
        temporary: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=request.app.state.uploads, suffix=suffix, delete=False
            ) as target:
                temporary = Path(target.name)
                size = 0
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_UPLOAD:
                        raise HTTPException(413, "O arquivo deve ter no máximo 256 MB.")
                    target.write(chunk)
            if not size:
                raise HTTPException(422, "O arquivo está vazio.")
            return await run_in_threadpool(
                request.app.state.media.create_clip, temporary, name.strip(), start, end, purpose
            )
        finally:
            await file.close()
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    @application.get("/api/audio-jobs/{job_id}")
    def job(job_id: str, request: Request):
        return request.app.state.media.get(job_id)

    @application.get("/api/audio-jobs/{job_id}/file")
    def audio_file(job_id: str, request: Request):
        service = request.app.state.media
        current = service.get(job_id)
        if current["status"] != "ready":
            raise HTTPException(409, "O áudio ainda não está pronto para importar.")
        return FileResponse(
            service.file(job_id), media_type="audio/mpeg", filename=current["filename"]
        )

    @application.get("/api/audio-jobs/{job_id}/waveform")
    def waveform(job_id: str, request: Request):
        return request.app.state.media.waveform(job_id)

    @application.post("/api/audio-jobs/{job_id}/clips", status_code=202)
    def clip_preview(job_id: str, data: ClipInput, request: Request):
        return request.app.state.media.clip_preview(job_id, data.name, data.start, data.end)

    @application.delete("/api/audio-jobs/{job_id}", status_code=204)
    def delete_job(job_id: str, request: Request):
        request.app.state.media.delete(job_id)
        return Response(status_code=204)

    @application.get("/{path:path}", include_in_schema=False)
    def frontend_file(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Rota de API não encontrada.")
        candidate = (frontend / path).resolve()
        if not candidate.is_relative_to(frontend.resolve()):
            raise HTTPException(404, "Arquivo não encontrado.")
        if not candidate.is_file():
            if Path(path).suffix:
                raise HTTPException(404, "Arquivo não encontrado.")
            candidate = frontend / "index.html"
        if not candidate.is_file():
            raise HTTPException(503, "Compile a interface com pnpm build antes de iniciar.")
        return FileResponse(candidate)

    return application


app = create_app()
