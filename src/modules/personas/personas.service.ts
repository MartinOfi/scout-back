import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Persona,
  Protagonista,
  Educador,
  PersonaExterna,
} from './entities/persona.entity';
import { CreateProtagonistaDto } from './dtos/create-protagonista.dto';
import { CreateEducadorDto } from './dtos/create-educador.dto';
import { CreatePersonaExternaDto } from './dtos/create-persona-externa.dto';
import { UpdatePersonaDto } from './dtos/update-persona.dto';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import {
  PersonaType,
  EstadoPersona,
  ConceptoMovimiento,
} from '../../common/enums';

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(Protagonista)
    private readonly protagonistaRepository: Repository<Protagonista>,
    @InjectRepository(Educador)
    private readonly educadorRepository: Repository<Educador>,
    @InjectRepository(PersonaExterna)
    private readonly personaExternaRepository: Repository<PersonaExterna>,
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    private readonly deletionValidator: DeletionValidatorService,
  ) {}

  async findAll(): Promise<Persona[]> {
    return this.personaRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  async findAllByTipo(tipo: PersonaType): Promise<Persona[]> {
    return this.personaRepository.find({
      where: { tipo },
      order: { nombre: 'ASC' },
    });
  }

  async findAllActivos(): Promise<Persona[]> {
    return this.personaRepository.find({
      where: { estado: EstadoPersona.ACTIVO },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene personas con deudas pendientes (incluyendo dados de baja)
   * PRD F1, CU7: Lista incluye protagonistas dados de baja con deuda
   */
  async findConDeudas(): Promise<
    {
      persona: Persona;
      deudaInscripciones: number;
      deudaCuotas: number;
      deudaCampamentos: number;
      totalDeuda: number;
    }[]
  > {
    // Esta lógica requiere consultar inscripciones, cuotas y campamentos
    // Por ahora retorna estructura vacía - se implementará con módulo de reportes
    // o cuando se agreguen las relaciones inversas en las entidades
    const personas = await this.personaRepository.find({
      order: { nombre: 'ASC' },
    });

    // TODO: Implementar cálculo de deudas cuando estén los repos de inscripciones/cuotas
    return personas
      .map((persona) => ({
        persona,
        deudaInscripciones: 0,
        deudaCuotas: 0,
        deudaCampamentos: 0,
        totalDeuda: 0,
      }))
      .filter((p) => p.totalDeuda > 0);
  }

  async findOne(id: string): Promise<Persona> {
    const persona = await this.personaRepository.findOne({
      where: { id },
    });

    if (!persona) {
      throw new NotFoundException(`Persona con ID ${id} no encontrada`);
    }

    return persona;
  }

  async createProtagonista(dto: CreateProtagonistaDto): Promise<Protagonista> {
    const protagonista = this.protagonistaRepository.create({
      ...dto,
      tipo: PersonaType.PROTAGONISTA,
      estado: EstadoPersona.ACTIVO,
    });

    const saved = await this.protagonistaRepository.save(protagonista);

    // Crear caja personal automáticamente
    await this.cajasService.getOrCreateCajaPersonal(saved.id, saved.nombre);

    return saved;
  }

  async createEducador(dto: CreateEducadorDto): Promise<Educador> {
    const { password, ...rest } = dto;

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const educador = this.educadorRepository.create({
      ...rest,
      passwordHash,
      tipo: PersonaType.EDUCADOR,
      estado: EstadoPersona.ACTIVO,
    });

    let saved: Educador;
    try {
      saved = await this.educadorRepository.save(educador);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }

    // Crear caja personal automáticamente
    await this.cajasService.getOrCreateCajaPersonal(saved.id, saved.nombre);

    return saved;
  }

  async createPersonaExterna(
    dto: CreatePersonaExternaDto,
  ): Promise<PersonaExterna> {
    const personaExterna = this.personaExternaRepository.create({
      ...dto,
      tipo: PersonaType.EXTERNA,
      estado: EstadoPersona.ACTIVO,
    });

    return this.personaExternaRepository.save(personaExterna);
  }

  async update(id: string, dto: UpdatePersonaDto): Promise<Persona> {
    const persona = await this.findOne(id);
    Object.assign(persona, dto);
    return this.personaRepository.save(persona);
  }

  /**
   * Da de baja a una persona transfiriendo el saldo de su caja personal a la caja del grupo.
   * - Operación atómica (delegada a MovimientosService.crearTransferencia).
   * - Idempotente: si saldo === 0, no crea movimientos.
   * - NO muta persona.estado: la persona puede volver al grupo más adelante.
   * - PRD F1, RN1
   */
  async darDeBaja(
    id: string,
    registradoPorId?: string,
  ): Promise<{ saldoTransferido: number }> {
    const persona = await this.findOne(id);

    if (
      persona.tipo !== PersonaType.PROTAGONISTA &&
      persona.tipo !== PersonaType.EDUCADOR
    ) {
      return { saldoTransferido: 0 };
    }

    const cajaPersonal = await this.cajasService.findCajaPersonal(id);
    if (!cajaPersonal) {
      return { saldoTransferido: 0 };
    }

    const saldo = await this.movimientosService.calcularSaldo(cajaPersonal.id);
    if (saldo === 0) {
      return { saldoTransferido: 0 };
    }

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.crearTransferencia(
      {
        cajaOrigenId: cajaPersonal.id,
        cajaDestinoId: cajaGrupo.id,
        monto: saldo,
        responsableId: registradoPorId ?? id,
        descripcion: `Transferencia de saldo personal de ${persona.nombre} a caja grupo`,
      },
      ConceptoMovimiento.TRANSFERENCIA_SALDO_PERSONAL,
    );

    return { saldoTransferido: saldo };
  }

  /**
   * Soft delete de persona - solo si no tiene movimientos asociados
   * Para casos normales, usar darDeBaja()
   *
   * Cascada: Si es Protagonista/Educador, también elimina su Caja personal
   */
  async remove(id: string): Promise<void> {
    const persona = await this.findOne(id);

    // Validar que no tenga movimientos asociados
    const check = await this.deletionValidator.canDeletePersona(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    // Cascada: eliminar caja personal si existe (para Protagonista/Educador)
    if (
      persona.tipo === PersonaType.PROTAGONISTA ||
      persona.tipo === PersonaType.EDUCADOR
    ) {
      const cajaPersonal = await this.cajasService.findCajaPersonal(id);
      if (cajaPersonal) {
        // La caja personal se puede eliminar porque ya verificamos que no hay movimientos
        await this.cajasService.remove(cajaPersonal.id);
      }
    }

    await this.personaRepository.softRemove(persona);
  }
}
