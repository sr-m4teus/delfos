import { ApiProperty } from '@nestjs/swagger';

export class QueryHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  natural_language_query: string;

  @ApiProperty()
  sql_query: string;

  @ApiProperty({ type: String, format: 'date-time' })
  validated_at: string;

  @ApiProperty({ required: false, type: [String] })
  tables?: string[];

  @ApiProperty({ required: false })
  catalog?: string;

  @ApiProperty({ required: false })
  schema?: string;
}

export class QueryHistoryListResponseDto {
  @ApiProperty({ type: [QueryHistoryItemDto] })
  items: QueryHistoryItemDto[];

  @ApiProperty()
  total_returned: number;
}
