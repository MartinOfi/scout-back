import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caja } from './entities/caja.entity';
import { CreateCajaDto } from './dtos/create-caja.dto';
import { CajaType } from '../../common/enums';

@Injectable()
export class CajasService {
  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepository: Repository<Caja>,
  ) {}

  async findAll(): Promise<Caja[]> {
    return this.cajaRepository.find({
      relations: ['propietario'],
      order: { tipo: 'ASC', nombre: 'ASC' },
    });
  }

  async findByTipo(tipo: CajaType): Promise<Caja[]> {
    return this.cajaRepository.find({
      where: { tipo },
      relations: ['propietario'],
    });
  }

  async findOne(id: string): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { id },
      relations: ['propietario'],
    });

    if (!caja) {
      throw new NotFoundException(`Caja con ID ${id} no encontrada`);
    }

    return caja;
  }

  async findCajaGrupo(): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { tipo: CajaType.GRUPO },
    });

    if (!caja) {
      throw new NotFoundException('Caja del grupo no encontrada');
    }

    return caja;
  }

  async findCajaPersonal(propietarioId: string): Promise<Caja | null> {
    return this.cajaRepository.findOne({
      where: { tipo: CajaType.PERSONAL, propietarioId },
      relations: ['propietario'],
    });
  }

  async create(dto: CreateCajaDto): Promise<Caja> {
    // Validaciones de negocio
    if (dto.tipo === CajaType.GRUPO) {
      const existente = await this.cajaRepository.findOne({
        where: { tipo: CajaType.GRUPO },
      });
      if (existente) {
        throw new BadRequestException('Ya existe una caja de grupo');
      }
    }

    if (dto.tipo === CajaType.PERSONAL && !dto.propietarioId) {
      throw new BadRequestException(
        'Las cajas personales requieren un propietario',
      );
    }

    if (dto.tipo === CajaType.PERSONAL && dto.propietarioId) {
      const existente = await this.findCajaPersonal(dto.propietarioId);
      if (existente) {
        throw new BadRequestException(
          'Esta persona ya tiene una caja personal',
        );
      }
    }

    const caja = this.cajaRepository.create(dto);
    return this.cajaRepository.save(caja);
  }

  async remove(id: string): Promise<void> {
    const caja = await this.findOne(id);

    if (caja.tipo === CajaType.GRUPO) {
      throw new BadRequestException('No se puede eliminar la caja del grupo');
    }

    await this.cajaRepository.softRemove(caja);
  }

  async getOrCreateCajaPersonal(propietarioId: string): Promise<Caja> {
    let caja = await this.findCajaPersonal(propietarioId);

    if (!caja) {
      caja = this.cajaRepository.create({
        tipo: CajaType.PERSONAL,
        propietarioId,
      });
      caja = await this.cajaRepository.save(caja);
    }

    return caja;
  }
}
