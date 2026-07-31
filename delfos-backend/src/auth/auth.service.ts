import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { UsersService } from '../users/users.service';
import { LoginRequestDto } from '../common/dto/login-request.dto';
import { RegisterRequestDto } from '../common/dto/register-request.dto';
import { AuthResponseDto } from '../common/dto/auth-response.dto';
import { UserResponseDto } from '../common/dto/user-response.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async login(loginDto: LoginRequestDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Buscar usuário
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    // Verificar se usuário está ativo
    if (!user.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    // Validar senha
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    // Atualizar último login
    await this.usersService.updateLastLogin(user.id);

    // Gerar token JWT
    const token = await this.generateToken(user);

    // Armazenar sessão no Redis
    await this.redisService.setSession(user.id, token);

    // Retornar resposta
    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600');
    return {
      token,
      user: this.usersService.toUserResponseDto(user),
      expiresIn,
    };
  }

  async register(registerDto: RegisterRequestDto): Promise<AuthResponseDto> {
    const { email, password, passwordConfirmation, name } = registerDto;

    // Validar confirmação de senha
    if (password !== passwordConfirmation) {
      throw new BadRequestException('Confirmação de senha não confere');
    }

    // Criar usuário
    const user = await this.usersService.create(email, password, name);

    // Gerar token JWT
    const token = await this.generateToken(user);

    // Armazenar sessão no Redis
    await this.redisService.setSession(user.id, token);

    // Retornar resposta
    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600');
    return {
      token,
      user: this.usersService.toUserResponseDto(user),
      expiresIn,
    };
  }

  async validateSession(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo');
    }

    return this.usersService.toUserResponseDto(user);
  }

  async logout(userId: string): Promise<void> {
    await this.redisService.deleteSession(userId);
  }

  private async generateToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      userType: user.role,
    };

    // Get expiresIn from env or use default, ensuring it has 's' suffix
    const expiresInRaw = process.env.JWT_EXPIRES_IN || '3600';
    const expiresIn: StringValue = (expiresInRaw.endsWith('s') 
      ? expiresInRaw 
      : `${expiresInRaw}s`) as StringValue;
    
    return this.jwtService.signAsync(payload, { expiresIn });
  }
}
