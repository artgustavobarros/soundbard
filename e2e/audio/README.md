# Áudios de teste

`tone.mp3` e `tone.ogg` são tons senoidais gerados para verificar decodificação e reprodução reais no navegador. Não contêm músicas ou gravações de terceiros.

- MP3: 310 Hz, duração aproximada de 2 segundos.
- OGG/Vorbis: 440 Hz, duração aproximada de 2 segundos.

Com FFmpeg instalado, é possível recriar os arquivos:

```bash
ffmpeg -f lavfi -i sine=frequency=310:duration=2 -codec:a libmp3lame tone.mp3
ffmpeg -f lavfi -i sine=frequency=440:duration=2 -codec:a libvorbis tone.ogg
```

FFmpeg não é uma dependência do Soundbard. Os testes WAV geram seus próprios arquivos em `e2e/fixtures.ts`.
