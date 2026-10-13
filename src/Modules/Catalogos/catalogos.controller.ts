
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { RoleId } from '../Usuarios/roles.enum';
import {
  CrearCatalogoItemDto,
  EditarCatalogoItemDto,
} from './catalogos.dto';
import { CatalogosService } from './catalogos.service';

@Controller('catalogos')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class CatalogosController {
  constructor(
    private readonly catalogosService: CatalogosService,
  ) {}

  @Get()
  listarCatalogos() {
    return this.catalogosService.listarCatalogos();
  }

  @Get(':catalogo')
  listarItems(@Param('catalogo') catalogo: string) {
    return this.catalogosService.listarItems(catalogo);
  }

  @Post(':catalogo')
  crearItem(
    @Param('catalogo') catalogo: string,
    @Body() dto: CrearCatalogoItemDto,
  ) {
    return this.catalogosService.crearItem(
      catalogo,
      dto.clave,
      dto.nombre,
    );
  }

  @Patch(':catalogo/:id')
  editarItem(
    @Param('catalogo') catalogo: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCatalogoItemDto,
  ) {
    return this.catalogosService.editarItem(
      catalogo,
      id,
      dto.nombre,
      dto.activo,
    );
  }
}
