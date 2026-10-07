import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../../config/environment';

config({ path: [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')] });
const environment = validateEnvironment(process.env);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: environment.DATABASE_HOST,
  port: environment.DATABASE_PORT,
  username: environment.DATABASE_USER,
  password: environment.DATABASE_PASSWORD,
  database: environment.DATABASE_NAME,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/infrastructure/database/migrations/*.ts'],
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
