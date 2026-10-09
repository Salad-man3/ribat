import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { PrayerLookupService } from './prayer-lookup.service';
import { PrayerTimesController } from './prayer-times.controller';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [PrayerTimesController],
  providers: [PrayerLookupService],
})
export class PrayerTimesModule {}
