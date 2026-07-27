import { Snowflake } from '@sapphire/snowflake';

const epoch = new Date(process.env.SNOWFLAKE_EPOCH ?? '2024-01-01T00:00:00.000Z');
const snowflake = new Snowflake(epoch);

/** 生成雪花 ID（string），对应 Java long / Postgres BIGINT */
export function nextSnowflakeId(): string {
  return snowflake.generate().toString();
}
