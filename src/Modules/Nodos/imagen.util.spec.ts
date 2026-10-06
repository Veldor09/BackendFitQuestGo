import { detectarTipoImagen } from './imagen.util';

const bytes = (...valores: number[]) => Buffer.from(valores);

describe('detectarTipoImagen', () => {
  it('reconoce JPEG por su firma', () => {
    expect(detectarTipoImagen(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe(
      'image/jpeg',
    );
  });

  it('reconoce PNG por su firma', () => {
    expect(
      detectarTipoImagen(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe('image/png');
  });

  it('reconoce WebP (RIFF....WEBP)', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      bytes(0x24, 0, 0, 0),
      Buffer.from('WEBPVP8 '),
    ]);
    expect(detectarTipoImagen(webp)).toBe('image/webp');
  });

  it('no se deja engañar por el nombre: lo que cuenta son los bytes', () => {
    expect(detectarTipoImagen(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(detectarTipoImagen(Buffer.from('%PDF-1.7'))).toBeNull();
  });

  it('rechaza un archivo vacio o demasiado corto', () => {
    expect(detectarTipoImagen(Buffer.alloc(0))).toBeNull();
    expect(detectarTipoImagen(bytes(0xff, 0xd8))).toBeNull();
  });

  it('un RIFF que no es WebP (ej. WAV) no pasa', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      bytes(0x24, 0, 0, 0),
      Buffer.from('WAVEfmt '),
    ]);
    expect(detectarTipoImagen(wav)).toBeNull();
  });
});
