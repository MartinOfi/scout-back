import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function ValidarMontoSaldoPersonal(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'validarMontoSaldoPersonal',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const montoConSaldoPersonal =
            typeof value === 'number' ? value : 0;
          const montoPagado =
            typeof obj.montoPagado === 'number' ? obj.montoPagado : 0;
          return montoConSaldoPersonal <= montoPagado;
        },
        defaultMessage() {
          return 'El monto de saldo personal no puede superar el monto pagado';
        },
      },
    });
  };
}
