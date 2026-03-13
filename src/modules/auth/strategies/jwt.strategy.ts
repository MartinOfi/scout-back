import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { JwtPayload } from '../interfaces';
import { Persona } from '../../personas/entities/persona.entity';
import { EstadoPersona } from '../../../common/enums';

/**
 * JWT Strategy for access token validation
 * Extracts token from Authorization Bearer header
 * Validates user exists and is active
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Validate JWT payload and return user
   * Called automatically by Passport after token verification
   */
  async validate(payload: JwtPayload): Promise<Persona> {
    const user = await this.personaRepository.findOne({
      where: {
        id: payload.sub,
        estado: EstadoPersona.ACTIVO,
        deletedAt: IsNull(),
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return user;
  }
}
