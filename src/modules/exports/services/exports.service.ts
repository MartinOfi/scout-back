import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ColumnDef,
  SheetSpec,
  WorkbookBuilderService,
} from './workbook-builder.service';

import { Persona } from '../../personas/entities/persona.entity';
import { Caja } from '../../cajas/entities/caja.entity';
import { Movimiento } from '../../movimientos/entities/movimiento.entity';
import { Inscripcion } from '../../inscripciones/entities/inscripcion.entity';
import { Cuota } from '../../cuotas/entities/cuota.entity';
import { Campamento } from '../../campamentos/entities/campamento.entity';
import { CampamentoParticipante } from '../../campamentos/entities/campamento-participante.entity';
import { Evento } from '../../eventos/entities/evento.entity';
import { Producto } from '../../eventos/entities/producto.entity';
import { VentaProducto } from '../../eventos/entities/venta-producto.entity';

@Injectable()
export class ExportsService {
  constructor(
    private readonly workbookBuilder: WorkbookBuilderService,
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
    @InjectRepository(Caja)
    private readonly cajaRepo: Repository<Caja>,
    @InjectRepository(Movimiento)
    private readonly movimientoRepo: Repository<Movimiento>,
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepo: Repository<Inscripcion>,
    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,
    @InjectRepository(Campamento)
    private readonly campamentoRepo: Repository<Campamento>,
    @InjectRepository(Evento)
    private readonly eventoRepo: Repository<Evento>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(VentaProducto)
    private readonly ventaProductoRepo: Repository<VentaProducto>,
  ) {}

  generateFilename(now: Date = new Date()): string {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `scout-export-${datePart}-${timePart}.xlsx`;
  }

  async generateXlsx(): Promise<Buffer> {
    const [
      personas,
      cajas,
      movimientos,
      inscripciones,
      cuotas,
      campamentos,
      eventos,
      productos,
      ventas,
    ] = await Promise.all([
      this.personaRepo.find(),
      this.cajaRepo.find(),
      this.movimientoRepo.find(),
      this.inscripcionRepo.find(),
      this.cuotaRepo.find(),
      this.campamentoRepo.find({
        relations: ['participantes', 'participantes.persona'],
      }),
      this.eventoRepo.find(),
      this.productoRepo.find(),
      this.ventaProductoRepo.find(),
    ]);

    const personaNameById = this.indexById(personas, (p) => p.nombre);
    const cajaNameById = this.indexById(cajas, (c) => c.nombre ?? '');
    const eventoNameById = this.indexById(eventos, (e) => e.nombre);
    const productoNameById = this.indexById(productos, (p) => p.nombre);

    const specs: SheetSpec[] = [
      this.buildPersonasSheet(personas),
      this.buildCajasSheet(cajas, personaNameById),
      this.buildMovimientosSheet(movimientos, cajaNameById, personaNameById),
      this.buildInscripcionesSheet(inscripciones, personaNameById),
      this.buildCuotasSheet(cuotas, personaNameById),
      this.buildCampamentosSheet(campamentos),
      this.buildCampamentoParticipantesSheet(campamentos),
      this.buildEventosSheet(eventos),
      this.buildProductosSheet(productos, eventoNameById),
      this.buildVentasProductosSheet(
        ventas,
        eventoNameById,
        productoNameById,
        personaNameById,
      ),
    ];

    return this.workbookBuilder.build(specs);
  }

  private indexById<T extends { id: string }>(
    items: T[],
    getName: (item: T) => string,
  ): Map<string, string> {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.id, getName(item));
    }
    return map;
  }

  private buildPersonasSheet(personas: Persona[]): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Nombre', key: 'nombre' },
      { header: 'Estado', key: 'estado' },
      { header: 'Email', key: 'email' },
      { header: 'Email verificado', key: 'emailVerified', type: 'boolean' },
      { header: 'Rama', key: 'rama' },
      { header: 'Cargo', key: 'cargo' },
      {
        header: 'Partida nacimiento',
        key: 'partidaNacimiento',
        type: 'boolean',
      },
      { header: 'DNI', key: 'dni', type: 'boolean' },
      { header: 'DNI padres', key: 'dniPadres', type: 'boolean' },
      {
        header: 'Carnet obra social',
        key: 'carnetObraSocial',
        type: 'boolean',
      },
      { header: 'Contacto', key: 'contacto' },
      { header: 'Notas', key: 'notas' },
      { header: 'Creado', key: 'createdAt', type: 'date' },
      { header: 'Actualizado', key: 'updatedAt', type: 'date' },
    ];

    const rows = personas.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      nombre: p.nombre,
      estado: p.estado,
      email: p.email,
      emailVerified: p.emailVerified,
      rama: (p as { rama?: unknown }).rama ?? null,
      cargo: (p as { cargo?: unknown }).cargo ?? null,
      partidaNacimiento:
        (p as { partidaNacimiento?: unknown }).partidaNacimiento ?? null,
      dni: (p as { dni?: unknown }).dni ?? null,
      dniPadres: (p as { dniPadres?: unknown }).dniPadres ?? null,
      carnetObraSocial:
        (p as { carnetObraSocial?: unknown }).carnetObraSocial ?? null,
      contacto: (p as { contacto?: unknown }).contacto ?? null,
      notas: (p as { notas?: unknown }).notas ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return { name: 'Personas', columns, rows };
  }

  private buildCajasSheet(
    cajas: Caja[],
    personaNameById: Map<string, string>,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Nombre', key: 'nombre' },
      { header: 'Propietario ID', key: 'propietarioId' },
      { header: 'Propietario', key: 'propietarioNombre' },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = cajas.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      nombre: c.nombre,
      propietarioId: c.propietarioId,
      propietarioNombre: c.propietarioId
        ? (personaNameById.get(c.propietarioId) ?? null)
        : null,
      createdAt: c.createdAt,
    }));

    return { name: 'Cajas', columns, rows };
  }

  private buildMovimientosSheet(
    movimientos: Movimiento[],
    cajaNameById: Map<string, string>,
    personaNameById: Map<string, string>,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Fecha', key: 'fecha', type: 'date' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Monto', key: 'monto', type: 'currency' },
      { header: 'Concepto', key: 'concepto' },
      { header: 'Categoría', key: 'categoria' },
      { header: 'Medio de pago', key: 'medioPago' },
      { header: 'Estado de pago', key: 'estadoPago' },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Caja ID', key: 'cajaId' },
      { header: 'Caja', key: 'cajaNombre' },
      { header: 'Responsable ID', key: 'responsableId' },
      { header: 'Responsable', key: 'responsableNombre' },
      {
        header: 'Requiere comprobante',
        key: 'requiereComprobante',
        type: 'boolean',
      },
      {
        header: 'Comprobante entregado',
        key: 'comprobanteEntregado',
        type: 'boolean',
      },
      { header: 'Evento ID', key: 'eventoId' },
      { header: 'Campamento ID', key: 'campamentoId' },
      { header: 'Inscripción ID', key: 'inscripcionId' },
      { header: 'Cuota ID', key: 'cuotaId' },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      monto: Number(m.monto),
      concepto: m.concepto,
      categoria: m.categoria,
      medioPago: m.medioPago,
      estadoPago: m.estadoPago,
      descripcion: m.descripcion,
      cajaId: m.cajaId,
      cajaNombre: cajaNameById.get(m.cajaId) ?? null,
      responsableId: m.responsableId,
      responsableNombre: personaNameById.get(m.responsableId) ?? null,
      requiereComprobante: m.requiereComprobante,
      comprobanteEntregado: m.comprobanteEntregado,
      eventoId: m.eventoId,
      campamentoId: m.campamentoId,
      inscripcionId: m.inscripcionId,
      cuotaId: m.cuotaId,
      createdAt: m.createdAt,
    }));

    return { name: 'Movimientos', columns, rows };
  }

  private buildInscripcionesSheet(
    inscripciones: Inscripcion[],
    personaNameById: Map<string, string>,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Persona ID', key: 'personaId' },
      { header: 'Persona', key: 'personaNombre' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Año', key: 'ano', type: 'number' },
      { header: 'Monto total', key: 'montoTotal', type: 'currency' },
      { header: 'Monto bonificado', key: 'montoBonificado', type: 'currency' },
      {
        header: 'Declaración salud',
        key: 'declaracionDeSalud',
        type: 'boolean',
      },
      {
        header: 'Autorización imagen',
        key: 'autorizacionDeImagen',
        type: 'boolean',
      },
      { header: 'Salidas cercanas', key: 'salidasCercanas', type: 'boolean' },
      {
        header: 'Autorización ingreso',
        key: 'autorizacionIngreso',
        type: 'boolean',
      },
      {
        header: 'Aptitud física',
        key: 'certificadoAptitudFisica',
        type: 'boolean',
      },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = inscripciones.map((i) => ({
      id: i.id,
      personaId: i.personaId,
      personaNombre: personaNameById.get(i.personaId) ?? null,
      tipo: i.tipo,
      ano: i.ano,
      montoTotal: Number(i.montoTotal),
      montoBonificado: Number(i.montoBonificado),
      declaracionDeSalud: i.declaracionDeSalud,
      autorizacionDeImagen: i.autorizacionDeImagen,
      salidasCercanas: i.salidasCercanas,
      autorizacionIngreso: i.autorizacionIngreso,
      certificadoAptitudFisica: i.certificadoAptitudFisica,
      createdAt: i.createdAt,
    }));

    return { name: 'Inscripciones', columns, rows };
  }

  private buildCuotasSheet(
    cuotas: Cuota[],
    personaNameById: Map<string, string>,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Persona ID', key: 'personaId' },
      { header: 'Persona', key: 'personaNombre' },
      { header: 'Nombre', key: 'nombre' },
      { header: 'Año', key: 'ano', type: 'number' },
      { header: 'Monto total', key: 'montoTotal', type: 'currency' },
      { header: 'Monto pagado', key: 'montoPagado', type: 'currency' },
      { header: 'Estado', key: 'estado' },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = cuotas.map((c) => ({
      id: c.id,
      personaId: c.personaId,
      personaNombre: personaNameById.get(c.personaId) ?? null,
      nombre: c.nombre,
      ano: c.ano,
      montoTotal: Number(c.montoTotal),
      montoPagado: Number(c.montoPagado),
      estado: c.estado,
      createdAt: c.createdAt,
    }));

    return { name: 'Cuotas', columns, rows };
  }

  private buildCampamentosSheet(campamentos: Campamento[]): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Nombre', key: 'nombre' },
      { header: 'Fecha inicio', key: 'fechaInicio', type: 'date' },
      { header: 'Fecha fin', key: 'fechaFin', type: 'date' },
      { header: 'Costo por persona', key: 'costoPorPersona', type: 'currency' },
      { header: 'Cuotas base', key: 'cuotasBase', type: 'number' },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = campamentos.map((k) => ({
      id: k.id,
      nombre: k.nombre,
      fechaInicio: k.fechaInicio,
      fechaFin: k.fechaFin,
      costoPorPersona: Number(k.costoPorPersona),
      cuotasBase: k.cuotasBase,
      descripcion: k.descripcion,
      createdAt: k.createdAt,
    }));

    return { name: 'Campamentos', columns, rows };
  }

  private buildCampamentoParticipantesSheet(
    campamentos: Array<
      Campamento & { participantes?: CampamentoParticipante[] }
    >,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'Campamento ID', key: 'campamentoId' },
      { header: 'Campamento', key: 'campamentoNombre' },
      { header: 'Persona ID', key: 'personaId' },
      { header: 'Persona', key: 'personaNombre' },
    ];

    const rows: Record<string, unknown>[] = [];
    for (const camp of campamentos) {
      const participantes = camp.participantes ?? [];
      for (const junction of participantes) {
        rows.push({
          campamentoId: camp.id,
          campamentoNombre: camp.nombre,
          personaId: junction.personaId,
          personaNombre: junction.persona?.nombre ?? '',
        });
      }
    }

    return { name: 'CampamentoParticipantes', columns, rows };
  }

  private buildEventosSheet(eventos: Evento[]): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Nombre', key: 'nombre' },
      { header: 'Fecha', key: 'fecha', type: 'date' },
      { header: 'Tipo', key: 'tipo' },
      { header: 'Destino ganancia', key: 'destinoGanancia' },
      { header: 'Subtipo', key: 'tipoEvento' },
      { header: 'Cerrado', key: 'estaCerrado', type: 'boolean' },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = eventos.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      fecha: e.fecha,
      tipo: e.tipo,
      destinoGanancia: e.destinoGanancia,
      tipoEvento: e.tipoEvento,
      estaCerrado: e.estaCerrado,
      descripcion: e.descripcion,
      createdAt: e.createdAt,
    }));

    return { name: 'Eventos', columns, rows };
  }

  private buildProductosSheet(
    productos: Producto[],
    eventoNameById: Map<string, string>,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Evento ID', key: 'eventoId' },
      { header: 'Evento', key: 'eventoNombre' },
      { header: 'Nombre', key: 'nombre' },
      { header: 'Precio costo', key: 'precioCosto', type: 'currency' },
      { header: 'Precio venta', key: 'precioVenta', type: 'currency' },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = productos.map((p) => ({
      id: p.id,
      eventoId: p.eventoId,
      eventoNombre: eventoNameById.get(p.eventoId) ?? null,
      nombre: p.nombre,
      precioCosto: Number(p.precioCosto),
      precioVenta: Number(p.precioVenta),
      createdAt: p.createdAt,
    }));

    return { name: 'Productos', columns, rows };
  }

  private buildVentasProductosSheet(
    ventas: VentaProducto[],
    eventoNameById: Map<string, string>,
    productoNameById: Map<string, string>,
    personaNameById: Map<string, string>,
  ): SheetSpec {
    const columns: ColumnDef[] = [
      { header: 'ID', key: 'id' },
      { header: 'Evento ID', key: 'eventoId' },
      { header: 'Evento', key: 'eventoNombre' },
      { header: 'Producto ID', key: 'productoId' },
      { header: 'Producto', key: 'productoNombre' },
      { header: 'Vendedor ID', key: 'vendedorId' },
      { header: 'Vendedor', key: 'vendedorNombre' },
      { header: 'Cantidad', key: 'cantidad', type: 'number' },
      { header: 'Movimiento ID', key: 'movimientoId' },
      { header: 'Creado', key: 'createdAt', type: 'date' },
    ];

    const rows = ventas.map((v) => ({
      id: v.id,
      eventoId: v.eventoId,
      eventoNombre: eventoNameById.get(v.eventoId) ?? null,
      productoId: v.productoId,
      productoNombre: productoNameById.get(v.productoId) ?? null,
      vendedorId: v.vendedorId,
      vendedorNombre: personaNameById.get(v.vendedorId) ?? null,
      cantidad: v.cantidad,
      movimientoId: v.movimientoId,
      createdAt: v.createdAt,
    }));

    return { name: 'VentasProductos', columns, rows };
  }
}
