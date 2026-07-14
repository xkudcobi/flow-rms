import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

class CategoryDto {
  @IsString() name: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class ProductDto {
  @IsString() name: string;
  @IsNumber() @Min(0) price: number;
  @IsString() categoryId: string;
  @IsOptional() @IsString() station?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// Güncellemede tüm alanlar opsiyonel (ör. yalnız "86" için { active }).
class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() station?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// Kategori güncellemede de tüm alanlar opsiyonel.
class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  // Okuma: tüm giriş yapmış kullanıcılar (adisyon için gerekli).
  @Get('categories')
  listCategories(@Query('all') all?: string) {
    return this.menu.listCategories(all === 'true');
  }

  @Get('products')
  listProducts(@Query('all') all?: string) {
    return this.menu.listProducts(all === 'true');
  }

  // Kârlılık & menü mühendisliği (PATRON/MÜDÜR).
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get('profitability')
  profitability(@Query('from') from?: string, @Query('to') to?: string) {
    return this.menu.profitability(from, to);
  }

  // Yazma: yalnızca PATRON / MÜDÜR.
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.menu.createCategory(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.menu.updateCategory(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.menu.removeCategory(id);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('products')
  createProduct(@Body() dto: ProductDto) {
    return this.menu.createProduct(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.menu.updateProduct(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete('products/:id')
  removeProduct(@Param('id') id: string) {
    return this.menu.removeProduct(id);
  }
}
