
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoItem } from './catalogo-item.entity';

export const CATALOGOS_PERMITIDOS = [
  'alertas',
  'nodos',
  'actividades',
] as const;

export type TipoCatalogo = (typeof CATALOGOS_PERMITIDOS)[number];

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(CatalogoItem)
    private readonly catalogoRepository: Repository<CatalogoItem>,
  ) {}

  private validarCatalogo(catalogo: string): asserts catalogo is TipoCatalogo {
    if (!CATALOGOS_PERMITIDOS.includes(catalogo as TipoCatalogo)) {
      throw new BadRequestException('El catálogo solicitado no es válido');
    }
  }

  private validarClave(clave: string): string {
    if (typeof clave !== 'string') {
      throw new BadRequestException('La clave debe ser un texto');
    }

    const claveNormalizada = clave.trim().toLowerCase();

    if (!/^[a-z][a-z0-9_]*$/.test(claveNormalizada)) {
      throw new BadRequestException(
        'La clave solo admite letras minúsculas, números y guiones bajos',
      );
    }

    if (claveNormalizada.length > 50) {
      throw new BadRequestException('La clave admite máximo 50 caracteres');
    }

    return claveNormalizada;
  }

  private validarNombre(nombre: string): string {
    if (typeof nombre !== 'string') {
      throw new BadRequestException('El nombre debe ser un texto');
    }

    const nombreNormalizado = nombre.trim();

    if (!nombreNormalizado || nombreNormalizado.length > 100) {
      throw new BadRequestException(
        'El nombre debe contener entre 1 y 100 caracteres',
      );
    }

    return nombreNormalizado;
  }

  async listarCatalogos(): Promise<
    { catalogo: TipoCatalogo; cantidad: number }[]
  > {
    const resultados = await Promise.all(
      CATALOGOS_PERMITIDOS.map(async (catalogo) => ({
        catalogo,
        cantidad: await this.catalogoRepository.count({
          where: { catalogo },
        }),
      })),
    );

    return resultados;
  }

  async listarItems(catalogo: string): Promise<CatalogoItem[]> {
    this.validarCatalogo(catalogo);

    return this.catalogoRepository.find({
      where: { catalogo },
      order: { id: 'ASC' },
    });
  }

  async crearItem(
    catalogo: string,
    clave: string,
    nombre: string,
  ): Promise<CatalogoItem> {
    this.validarCatalogo(catalogo);

    const claveNormalizada = this.validarClave(clave);
    const nombreNormalizado = this.validarNombre(nombre);

    const existente = await this.catalogoRepository.findOne({
      where: {
        catalogo,
        clave: claveNormalizada,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Ya existe un elemento con esa clave en el catálogo',
      );
    }

    const item = this.catalogoRepository.create({
      catalogo,
      clave: claveNormalizada,
      nombre: nombreNormalizado,
      activo: true,
    });

    try {
      return await this.catalogoRepository.save(item);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'Ya existe un elemento con esa clave en el catálogo',
        );
      }

      throw error;
    }
  }

  async editarItem(
    catalogo: string,
    id: number,
    nombre: string,
    activo?: boolean,
  ): Promise<CatalogoItem> {
    this.validarCatalogo(catalogo);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('El identificador no es válido');
    }

    const item = await this.catalogoRepository.findOne({
      where: { id, catalogo },
    });

    if (!item) {
      throw new NotFoundException('El elemento del catálogo no existe');
    }

    item.nombre = this.validarNombre(nombre);

    if (activo !== undefined) {
      if (typeof activo !== 'boolean') {
        throw new BadRequestException('El estado activo debe ser booleano');
      }

      item.activo = activo;
    }

    return this.catalogoRepository.save(item);
  }

  async existeClaveActiva(
    catalogo: string,
    clave: string,
  ): Promise<boolean> {
    this.validarCatalogo(catalogo);

    return this.catalogoRepository.existsBy({
      catalogo,
      clave,
      activo: true,
    });
  }
}
