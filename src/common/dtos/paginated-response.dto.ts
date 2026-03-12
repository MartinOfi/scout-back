import { ApiProperty } from '@nestjs/swagger';

/**
 * Metadatos de paginación incluidos en cada respuesta paginada
 */
export class PaginationMeta {
  @ApiProperty({ description: 'Página actual', example: 1 })
  page: number;

  @ApiProperty({ description: 'Elementos por página', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total de elementos', example: 150 })
  total: number;

  @ApiProperty({ description: 'Total de páginas', example: 8 })
  totalPages: number;

  @ApiProperty({ description: 'Indica si hay página anterior', example: false })
  hasPreviousPage: boolean;

  @ApiProperty({ description: 'Indica si hay página siguiente', example: true })
  hasNextPage: boolean;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = Math.ceil(total / limit);
    this.hasPreviousPage = page > 1;
    this.hasNextPage = page < this.totalPages;
  }
}

/**
 * Respuesta paginada genérica
 * Uso: PaginatedResponseDto<MovimientoResponseDto>
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Lista de elementos de la página actual' })
  data: T[];

  @ApiProperty({ description: 'Metadatos de paginación', type: PaginationMeta })
  meta: PaginationMeta;

  constructor(data: T[], page: number, limit: number, total: number) {
    this.data = data;
    this.meta = new PaginationMeta(page, limit, total);
  }
}
