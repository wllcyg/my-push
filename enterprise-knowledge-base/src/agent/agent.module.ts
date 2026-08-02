import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DocumentModule } from '../document/document.module';
import { RedisMessageStoreService } from './services/redis-message-store.service';
import { ChatHistoryService } from './services/chat-history.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { ChatSessionEntity } from './entities/chat-session.entity';
import { ChatMessageEntity } from './entities/chat-message.entity';

@Module({
  imports: [
    DocumentModule,
    TypeOrmModule.forFeature([ChatSessionEntity, ChatMessageEntity]),
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    RedisMessageStoreService,
    ChatHistoryService,
    SemanticCacheService,
  ],
  exports: [
    AgentService,
    RedisMessageStoreService,
    ChatHistoryService,
    SemanticCacheService,
  ],
})
export class AgentModule {}
