import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { AppModule } from '../../app.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface EndpointResult {
  endpoint: string;
  status: number;
  durationMs: number;
}

async function measureEndpoint(
  app: INestApplication,
  endpoint: string,
): Promise<EndpointResult> {
  const start = Date.now();
  const response = await request(app.getHttpServer()).get(endpoint);
  const durationMs = Date.now() - start;

  return {
    endpoint,
    status: response.status,
    durationMs,
  };
}

function colorize(ms: number, label: string): string {
  const RED = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const GREEN = '\x1b[32m';
  const RESET = '\x1b[0m';

  if (ms > 1000) {
    return `${RED}${label}${RESET}`;
  } else if (ms > 500) {
    return `${YELLOW}${label}${RESET}`;
  }
  return `${GREEN}${label}${RESET}`;
}

function printSummary(results: EndpointResult[]): void {
  const sorted = [...results].sort((a, b) => b.durationMs - a.durationMs);

  console.log('\n========================================');
  console.log('  PERFORMANCE BENCHMARK RESULTS');
  console.log('  (sorted slowest → fastest)');
  console.log('========================================');

  for (const result of sorted) {
    const durationLabel = `${result.durationMs}ms`;
    const coloredDuration = colorize(result.durationMs, durationLabel);
    const statusLabel = `[${result.status}]`;
    const paddedEndpoint = result.endpoint.padEnd(40);

    console.log(`  ${paddedEndpoint} ${statusLabel}  ${coloredDuration}`);
  }

  console.log('========================================');
  console.log('  Legend: >1000ms = RED, >500ms = YELLOW, <=500ms = GREEN');
  console.log('========================================\n');
}

describe('Performance Benchmark - Heavy Endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Mock canActivate to bypass auth for benchmarking
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockReturnValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.setGlobalPrefix('api/v1');

    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('benchmarks all heavy endpoints and prints baseline measurements', async () => {
    const endpoints = [
      '/api/v1/cajas/consolidado',
      '/api/v1/cajas',
      '/api/v1/inscripciones/consolidado',
      '/api/v1/movimientos',
      '/api/v1/inscripciones',
      '/api/v1/personas',
    ];

    const results: EndpointResult[] = [];

    for (const endpoint of endpoints) {
      console.log(`  Measuring ${endpoint}...`);
      const result = await measureEndpoint(app, endpoint);
      results.push(result);
      console.log(`    → ${result.durationMs}ms [${result.status}]`);
    }

    printSummary(results);

    for (const result of results) {
      expect(result.status).toBeLessThan(500);
    }
  }, 60_000);
});
