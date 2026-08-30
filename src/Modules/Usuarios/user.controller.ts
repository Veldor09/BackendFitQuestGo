import {Body,Controller,Delete,Get,HttpCode,HttpStatus,Param,ParseIntPipe,Put,Post,UseGuards,} from '@nestjs/common';
import {CreateUserDto,UpdateUserDto,} from './dto/UserDTO';
import { User } from './user.entity';
import { UserService } from './user.service';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { RoleId } from './roles.enum';

@Controller('usuarios')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.findOneUser(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.createUser(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.userService.removeUser(id);
  }
}
