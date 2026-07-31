import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { FileParserService } from './parser/file-parser.service';
import { DocumentEntity } from './entities/document.entity';
import { DocumentChunkEntity } from './entities/document-chunk.entity';
import {
  DocumentContent,
  DocumentContentSchema,
} from './schemas/document-content.schema';
import { DocumentParseConsumer } from './consumers/document-parse.consumer';
import { DocumentVectorConsumer } from './consumers/document-vector.consumer';
import { DocumentChunkingService } from './parser/utils/document-chunking.service';
import { EmbeddingService } from './services/embedding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, DocumentChunkEntity]),
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
  ],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    FileParserService,
    DocumentChunkingService,
    EmbeddingService,
    DocumentParseConsumer,
    DocumentVectorConsumer,
  ],
  exports: [
    DocumentService,
    FileParserService,
    DocumentChunkingService,
    EmbeddingService,
  ],
})
export class DocumentModule {}

