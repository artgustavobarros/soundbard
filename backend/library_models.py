"""Manifesto versionado da biblioteca compartilhada do Soundbard."""

from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Identifier = Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9_-]{1,100}$")]
AudioIdentifier = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Volume = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
MAX_AUDIO_BYTES = 256 * 1024 * 1024
AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/x-mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    "audio/ogg",
    "application/ogg",
}


class ManifestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Sound(ManifestModel):
    id: AudioIdentifier
    name: Name
    kind: Literal["music", "ambience", "effect"]
    duration: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    size: Annotated[int, Field(gt=0, le=MAX_AUDIO_BYTES)]
    mime: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    volume: Volume
    loop: bool
    tags: list[Tag]

    @model_validator(mode="after")
    def audio_type(self):
        if self.mime not in AUDIO_TYPES:
            raise ValueError("Tipo de áudio não permitido.")
        return self


class Playlist(ManifestModel):
    id: Identifier
    name: Name
    sound_ids: list[Identifier] = Field(alias="soundIds")
    shuffle: bool
    repeat: Literal["off", "one", "all"]


class Layer(ManifestModel):
    sound_id: Identifier = Field(alias="soundId")
    loop: bool
    volume: Volume


class Scene(ManifestModel):
    id: Identifier
    name: Name
    playlist_id: Identifier | None = Field(alias="playlistId")
    layers: list[Layer]
    effect_ids: list[Identifier] = Field(alias="effectIds")
    music_volume: Volume = Field(alias="musicVolume")
    type: Literal["characters", "locations", "combat"] | None = None


class PadGroup(ManifestModel):
    id: Identifier
    name: Name
    pad_ids: list[Annotated[str, StringConstraints(min_length=1, max_length=110)]] = Field(
        alias="padIds"
    )


class LibraryManifest(ManifestModel):
    version: Literal[1]
    revision: Annotated[int, Field(ge=0, le=9007199254740991)]
    master: Volume
    sounds: list[Sound]
    playlists: list[Playlist]
    scenes: list[Scene]
    tags: list[Tag] = Field(default_factory=list)
    pad_groups: list[PadGroup] = Field(default_factory=list, alias="padGroups")
    pad_order: list[Annotated[str, StringConstraints(min_length=1, max_length=110)]] = Field(
        default_factory=list, alias="padOrder"
    )

    @field_validator("version", mode="before")
    @classmethod
    def integer_version(cls, value):
        if type(value) is not int:
            raise ValueError("Versão inválida da biblioteca.")
        return value

    @model_validator(mode="after")
    def references(self):
        for items in [self.sounds, self.playlists, self.scenes, self.pad_groups]:
            if len({item.id for item in items}) != len(items):
                raise ValueError("Identificadores duplicados na biblioteca.")
        sounds = {sound.id: sound.kind for sound in self.sounds}
        playlist_ids = {playlist.id for playlist in self.playlists}
        for playlist in self.playlists:
            if len(set(playlist.sound_ids)) != len(playlist.sound_ids) or any(
                sounds.get(identifier) != "music" for identifier in playlist.sound_ids
            ):
                raise ValueError("Referência de playlist ausente, repetida ou incompatível.")
        for scene in self.scenes:
            if scene.playlist_id is not None and scene.playlist_id not in playlist_ids:
                raise ValueError("Referência de playlist da cena ausente.")
            layer_ids = [layer.sound_id for layer in scene.layers]
            if len(set(layer_ids)) != len(layer_ids) or any(
                sounds.get(identifier) != "ambience" for identifier in layer_ids
            ):
                raise ValueError("Referência de ambiente ausente, repetida ou incompatível.")
            if len(set(scene.effect_ids)) != len(scene.effect_ids) or any(
                sounds.get(identifier) != "effect" for identifier in scene.effect_ids
            ):
                raise ValueError("Referência de efeito ausente, repetida ou incompatível.")
        valid_pads = set(sounds) | {f"playlist:{identifier}" for identifier in playlist_ids}
        if len(set(self.pad_order)) != len(self.pad_order) or any(
            identifier not in valid_pads for identifier in self.pad_order
        ):
            raise ValueError("Ordem de pads com referência ausente ou repetida.")
        for group in self.pad_groups:
            group.pad_ids = list(
                dict.fromkeys(
                    identifier for identifier in group.pad_ids if identifier in valid_pads
                )
            )
        return self


def empty_library():
    return {
        "version": 1,
        "revision": 0,
        "master": 0.8,
        "sounds": [],
        "playlists": [],
        "scenes": [],
        "tags": [],
        "padGroups": [],
        "padOrder": [],
    }
