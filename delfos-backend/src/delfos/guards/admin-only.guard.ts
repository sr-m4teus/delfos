import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Verificar se o usuário é admin
    // O userType vem do JWT payload
    if (user.userType !== 'admin') {
      throw new ForbiddenException(
        'Apenas administradores podem editar queries',
      );
    }

    return true;
  }
}
