import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object);
    if (errors.length > 0) {
      const formattedErrors: Record<string, string[]> = {};
      errors.forEach((error) => {
        const property = error.property;
        const messages = Object.values(error.constraints || {});
        formattedErrors[property] = messages;
      });
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Dados de validação inválidos',
        details: formattedErrors,
      });
    }
    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
