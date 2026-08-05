import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DocumentModule } from '../document/document.module';
import { EmbeddingService } from '../document/services/embedding.service';
import { RedisMessageStoreService } from './services/redis-message-store.service';
import { ChatHistoryService } from './services/chat-history.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { RerankService } from './services/rerank.service';
import { ChatSessionEntity } from './entities/chat-session.entity';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { createKnowledgeRetrieverTool } from './tools/knowledge-retriever.tool';
import { createBochaWebSearchTool } from './tools/bocha-web-search.tool';

import { SkillRegistryService } from './services/skill-registry.service';
import { AGENT_TOOLS } from './agent.constants';

export { AGENT_TOOLS };

/** Agent 工具箱 Factory Provider 注册 */

export const AgentToolsProvider: Provider = {
  provide: AGENT_TOOLS,
  useFactory: (
    embeddingService: EmbeddingService,
    dataSource: DataSource,
    configService: ConfigService,
    rerankService: RerankService,
  ) => [
    createKnowledgeRetrieverTool(embeddingService, dataSource, rerankService),
    createBochaWebSearchTool(configService),
  ],
  inject: [EmbeddingService, DataSource, ConfigService, RerankService],
};

@Module({
  imports: [
    DocumentModule,
    TypeOrmModule.forFeature([ChatSessionEntity, ChatMessageEntity]),
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentToolsProvider,
    RedisMessageStoreService,
    ChatHistoryService,
    SemanticCacheService,
    SkillRegistryService,
    RerankService,
  ],
  exports: [
    AgentService,
    AGENT_TOOLS,
    RedisMessageStoreService,
    ChatHistoryService,
    SemanticCacheService,
    SkillRegistryService,
    RerankService,
  ],
})
export class AgentModule {}


