import { Injectable } from '@nestjs/common';

import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../common/domain-errors';
import { newId, nowUtc } from '../../common/ids';
import type { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  private readonly patients = new Map<string, Patient>();

  create(input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Patient {
    if (!isValidCpf(input.cpf)) {
      throw new ValidationDomainError(
        'PATIENT_CPF_INVALID',
        'CPF informado invalido',
      );
    }
    const duplicated = [...this.patients.values()].find(
      (p) =>
        !p.deletedAt &&
        p.clinicId === input.clinicId &&
        stripDigits(p.cpf) === stripDigits(input.cpf),
    );
    if (duplicated) {
      throw new ConflictDomainError(
        'PATIENT_CPF_TAKEN',
        'CPF ja cadastrado nesta clinica',
      );
    }
    const now = nowUtc();
    const patient: Patient = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    this.patients.set(patient.id, patient);
    return patient;
  }

  findById(id: string): Patient {
    const p = this.patients.get(id);
    if (!p || p.deletedAt) throw new NotFoundDomainError('PATIENT_NOT_FOUND');
    return p;
  }

  list(filter: {
    clinicId: string;
    nutritionistId?: string;
    q?: string;
    includeArchived?: boolean;
  }): Patient[] {
    return [...this.patients.values()]
      .filter((p) => p.clinicId === filter.clinicId)
      .filter((p) => filter.includeArchived || !p.deletedAt)
      .filter(
        (p) =>
          !filter.nutritionistId || p.nutritionistId === filter.nutritionistId,
      )
      .filter(
        (p) =>
          !filter.q ||
          p.fullName.toLowerCase().includes(filter.q.toLowerCase()),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  update(
    id: string,
    actor: { userId: string; role: string; clinicId?: string },
    patch: Partial<Patient>,
  ): Patient {
    const p = this.findById(id);
    if (actor.role !== 'admin' && actor.clinicId !== p.clinicId) {
      throw new ForbiddenDomainError('PATIENT_FOREIGN_TENANT');
    }
    const next: Patient = {
      ...p,
      ...patch,
      id: p.id,
      clinicId: p.clinicId,
      createdAt: p.createdAt,
      updatedAt: nowUtc(),
    };
    this.patients.set(id, next);
    return next;
  }

  softDelete(id: string, actor: { role: string; clinicId?: string }): Patient {
    const p = this.findById(id);
    if (actor.role !== 'admin' && actor.clinicId !== p.clinicId) {
      throw new ForbiddenDomainError('PATIENT_FOREIGN_TENANT');
    }
    const next: Patient = { ...p, deletedAt: nowUtc(), updatedAt: nowUtc() };
    this.patients.set(id, next);
    return next;
  }

  restore(id: string): Patient {
    const p = this.patients.get(id);
    if (!p) throw new NotFoundDomainError('PATIENT_NOT_FOUND');
    const next: Patient = { ...p, deletedAt: undefined, updatedAt: nowUtc() };
    this.patients.set(id, next);
    return next;
  }
}

function stripDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

function isValidCpf(value: string): boolean {
  const digits = stripDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return true;
}
