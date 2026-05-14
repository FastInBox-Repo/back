import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PatientRecord } from '../../common/types/domain.types';
import { createId } from '../../common/utils/id.util';
import { DataStoreService } from '../../infra/data-store.service';
import { AuditService } from '../audit/audit.service';

interface CreatePatientInput {
  name?: string;
  email?: string;
  dietaryNotes?: string;
}

interface UpdatePatientInput {
  name?: string;
  email?: string;
  dietaryNotes?: string;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly dataStoreService: DataStoreService,
    private readonly auditService: AuditService,
  ) {}

  async listByNutritionist(nutritionistId: string): Promise<PatientRecord[]> {
    const data = await this.dataStoreService.readData();
    return data.patients.filter(
      (patient) => patient.ownerNutritionistId === nutritionistId,
    );
  }

  async createPatient(
    nutritionistId: string,
    payload: CreatePatientInput,
  ): Promise<PatientRecord> {
    if (!payload.name || !payload.email) {
      throw new BadRequestException('name e email sao obrigatorios.');
    }

    const now = new Date().toISOString();
    const patient: PatientRecord = {
      id: createId('pat'),
      ownerNutritionistId: nutritionistId,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      dietaryNotes: payload.dietaryNotes?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStoreService.updateData((db) => {
      const emailAlreadyUsed = db.patients.some(
        (existing) => existing.email.toLowerCase() === patient.email.toLowerCase(),
      );
      if (emailAlreadyUsed) {
        throw new BadRequestException('Ja existe paciente com este email.');
      }
      db.patients.push(patient);
    });

    await this.auditService.logEvent({
      type: 'patient_created',
      actorUserId: nutritionistId,
      metadata: {
        patientId: patient.id,
      },
    });

    return patient;
  }

  async updatePatient(
    patientId: string,
    nutritionistId: string,
    payload: UpdatePatientInput,
  ): Promise<PatientRecord> {
    const updatedPatient = await this.dataStoreService.updateData((db) => {
      const patient = db.patients.find((item) => item.id === patientId);
      if (!patient) {
        throw new NotFoundException('Paciente nao encontrado.');
      }

      if (patient.ownerNutritionistId !== nutritionistId) {
        throw new ForbiddenException('Voce so pode editar seus pacientes.');
      }

      if (payload.email) {
        const normalizedEmail = payload.email.trim().toLowerCase();
        const duplicate = db.patients.some(
          (candidate) =>
            candidate.id !== patient.id &&
            candidate.email.toLowerCase() === normalizedEmail,
        );
        if (duplicate) {
          throw new BadRequestException('Ja existe paciente com este email.');
        }
        patient.email = normalizedEmail;
      }

      if (payload.name) {
        patient.name = payload.name.trim();
      }

      if (typeof payload.dietaryNotes === 'string') {
        patient.dietaryNotes = payload.dietaryNotes.trim();
      }

      patient.updatedAt = new Date().toISOString();
    });

    const patient = updatedPatient.patients.find((item) => item.id === patientId);
    if (!patient) {
      throw new NotFoundException('Paciente nao encontrado apos atualizacao.');
    }

    return patient;
  }
}
