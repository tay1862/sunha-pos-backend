import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createCategorySchema, createItemSchema, updateItemSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { CatalogService } from './catalog.service.js';

type AuthRequest = FastifyRequest & { user: AuthClaims };

@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @RequirePermission('SELL')
  categories(@Req() request: AuthRequest) {
    return this.catalog.listCategories(request.user.tenantId);
  }

  @Get('items')
  @RequirePermission('SELL')
  items(@Req() request: AuthRequest) {
    return this.catalog.listItems(request.user.tenantId);
  }

  @Post('categories')
  @RequirePermission('MANAGE_ITEMS')
  createCategory(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_CATEGORY');
    return this.catalog.createCategory(request.user.tenantId, parsed.data);
  }

  @Post('items')
  @RequirePermission('MANAGE_ITEMS')
  createItem(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_ITEM');
    return this.catalog.createItem(request.user.tenantId, parsed.data);
  }

  @Patch('items/:id')
  @RequirePermission('MANAGE_ITEMS')
  updateItem(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_ITEM');
    return this.catalog.updateItem(request.user.tenantId, id, parsed.data);
  }
}
