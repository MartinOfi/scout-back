import { PickType } from '@nestjs/swagger';
import { DeudaQueryDto } from './deuda-query.dto';

/** Filtros del consolidado: solo el alcance (rama y año), nunca el origen. */
export class DeudaConsolidadoQueryDto extends PickType(DeudaQueryDto, [
  'rama',
  'ano',
] as const) {}
