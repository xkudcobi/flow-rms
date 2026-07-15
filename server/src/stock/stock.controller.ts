import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class ItemDto {
  @IsString() name: string;
  @IsOptional() @IsString() unit?: string;
  // Hammadde grubu; null = gruplanmamış ("Diğer").
  @IsOptional() @IsString() group?: string | null;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsNumber() criticalLevel?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class MovementDto {
  @IsString() type: string; // GIRIS | FIRE | SAYIM
  @IsNumber() quantity: number;
  @IsOptional() @IsString() note?: string;
}
class RecipeLineDto {
  @IsString() stockItemId: string;
  @IsNumber() quantity: number;
}
class RecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  items: RecipeLineDto[];
}

// Okuma tüm giriş yapmışlara açık; yazma PATRON/MÜDÜR.
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('items')
  listItems(@Query('all') all?: string) {
    return this.stock.listItems(all === 'true');
  }

  @Get('alerts')
  alerts() {
    return this.stock.alerts();
  }

  @Get('items/:id/movements')
  movements(@Param('id') id: string) {
    return this.stock.movements(id);
  }

  @Get('recipe/:productId')
  getRecipe(@Param('productId') productId: string) {
    return this.stock.getRecipe(productId);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('items')
  createItem(@Body() dto: ItemDto) {
    return this.stock.createItem(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: ItemDto) {
    return this.stock.updateItem(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.stock.removeItem(id);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('items/:id/movement')
  movement(
    @Param('id') id: string,
    @Body() dto: MovementDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.stock.addMovement(id, dto, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Put('recipe/:productId')
  setRecipe(@Param('productId') productId: string, @Body() dto: RecipeDto) {
    return this.stock.setRecipe(productId, dto.items);
  }
}
