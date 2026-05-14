import { Injectable, OnModuleInit } from '@nestjs/common';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { DatabaseSchema } from '../common/types/domain.types';

@Injectable()
export class DataStoreService implements OnModuleInit {
  private readonly dataFile = resolve(
    process.cwd(),
    process.env.DATA_FILE ?? 'data/db.json',
  );

  private db: DatabaseSchema | null = null;
  private lock: Promise<void> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  async readData(): Promise<DatabaseSchema> {
    return this.withLock(async () => structuredClone(await this.getDb()));
  }

  async updateData(
    callback: (data: DatabaseSchema) => void | Promise<void>,
  ): Promise<DatabaseSchema> {
    return this.withLock(async () => {
      const db = await this.getDb();
      await callback(db);
      await this.persist(db);
      return structuredClone(db);
    });
  }

  private async withLock<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.lock;
    let releaseLock: () => void = () => undefined;
    this.lock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previous;
    try {
      return await action();
    } finally {
      releaseLock();
    }
  }

  private async getDb(): Promise<DatabaseSchema> {
    if (!this.db) {
      await this.ensureInitialized();
    }

    if (!this.db) {
      throw new Error('Failed to initialize data store.');
    }

    return this.db;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.db) {
      return;
    }

    await mkdir(dirname(this.dataFile), { recursive: true });

    try {
      await access(this.dataFile);
      const rawContent = await readFile(this.dataFile, 'utf-8');
      this.db = this.parseOrSeed(rawContent);
      if (!rawContent.trim()) {
        await this.persist(this.db);
      }
      return;
    } catch {
      const seed = this.createSeedData();
      this.db = seed;
      await this.persist(seed);
    }
  }

  private parseOrSeed(rawContent: string): DatabaseSchema {
    if (!rawContent.trim()) {
      return this.createSeedData();
    }

    try {
      const parsed = JSON.parse(rawContent) as Partial<DatabaseSchema>;
      return {
        users: parsed.users ?? [],
        sessions: parsed.sessions ?? [],
        patients: parsed.patients ?? [],
        ingredients: parsed.ingredients ?? [],
        orders: parsed.orders ?? [],
        auditEvents: parsed.auditEvents ?? [],
      };
    } catch {
      return this.createSeedData();
    }
  }

  private async persist(data: DatabaseSchema): Promise<void> {
    await writeFile(this.dataFile, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }

  private createSeedData(): DatabaseSchema {
    const timestamp = new Date().toISOString();
    return {
      users: [
        {
          id: 'usr_admin_1',
          name: 'Admin FastInBox',
          email: 'admin@fastinbox.local',
          password: 'admin123',
          role: 'admin',
          createdAt: timestamp,
        },
        {
          id: 'usr_nutri_1',
          name: 'Nutricionista Demo',
          email: 'nutri@fastinbox.local',
          password: 'nutri123',
          role: 'nutricionista',
          createdAt: timestamp,
        },
        {
          id: 'usr_cozinha_1',
          name: 'Cozinha Central',
          email: 'cozinha@fastinbox.local',
          password: 'cozinha123',
          role: 'cozinha',
          kitchenId: 'kitchen_main',
          createdAt: timestamp,
        },
        {
          id: 'usr_paciente_1',
          name: 'Paciente Demo',
          email: 'paciente@fastinbox.local',
          password: 'paciente123',
          role: 'paciente',
          patientId: 'pat_seed_1',
          createdAt: timestamp,
        },
      ],
      sessions: [],
      patients: [
        {
          id: 'pat_seed_1',
          ownerNutritionistId: 'usr_nutri_1',
          name: 'Paciente Demo',
          email: 'paciente@fastinbox.local',
          dietaryNotes: 'Sem lactose',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      ingredients: [
        {
          id: 'ing_seed_1',
          name: 'Arroz Integral',
          unit: 'g',
          caloriesPerUnit: 1.3,
          active: true,
          createdAt: timestamp,
        },
      ],
      orders: [],
      auditEvents: [],
    };
  }
}
