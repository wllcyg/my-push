import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [R2StorageService],
  exports: [R2StorageService],
})
export class StorageModule {}
