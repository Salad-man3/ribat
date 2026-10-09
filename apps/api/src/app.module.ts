import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { GuardiansModule } from './guardians/guardians.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PrayerTimesModule } from './prayer-times/prayer-times.module';
import { MaterialsModule } from './materials/materials.module';
import { CoursesModule } from './courses/courses.module';
import { JobsQueueModule } from './jobs/jobs-queue.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    // ponytail: in-memory throttler storage; switch to Redis if API scales out.
    // Only `default` is registered globally. Named login/setup limits belong on those routes via @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 10_000 }],
    }),
    ConfigModule,
    LoggingModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    HealthModule,
    OrganizationsModule,
    MembershipsModule,
    GuardiansModule,
    MembersModule,
    PrayerTimesModule,
    JobsQueueModule,
    MaterialsModule,
    CoursesModule,
    JobsModule,
    AuthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule { }
