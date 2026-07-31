import { Module, Global } from '@nestjs/common';
import { SqlParserService } from './sql-parser.service';
import { SqlLiteralSanitizerService } from './sql-literal-sanitizer.service';

@Global()
@Module({
  providers: [SqlParserService, SqlLiteralSanitizerService],
  exports: [SqlParserService, SqlLiteralSanitizerService],
})
export class SqlParserModule {}
