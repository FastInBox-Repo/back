import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  OrderItemRecord,
  OrderRecord,
  SafeUser,
} from '../../common/types/domain.types';
import { createId } from '../../common/utils/id.util';
import { DataStoreService } from '../../infra/data-store.service';
import { AuditService } from '../audit/audit.service';

interface CreateOrderInput {
  patientId?: string;
  kitchenId?: string;
  items?: OrderItemRecord[];
  notes?: string;
}

interface UpdateOrderStatusInput {
  status?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataStoreService: DataStoreService,
    private readonly auditService: AuditService,
  ) {}

  async createOrder(
    nutritionist: SafeUser,
    payload: CreateOrderInput,
  ): Promise<OrderRecord> {
    if (!payload.patientId || !payload.kitchenId) {
      throw new BadRequestException('patientId e kitchenId sao obrigatorios.');
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new BadRequestException('items deve conter ao menos um ingrediente.');
    }

    const now = new Date().toISOString();
    const data = await this.dataStoreService.readData();
    const patient = data.patients.find((item) => item.id === payload.patientId);
    if (!patient) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    if (patient.ownerNutritionistId !== nutritionist.id) {
      throw new ForbiddenException('Somente o nutricionista dono pode criar pedido.');
    }

    const code = this.generateUniqueOrderCode(data.orders.map((order) => order.code));
    const order: OrderRecord = {
      id: createId('ord'),
      code,
      createdByNutritionistId: nutritionist.id,
      patientId: payload.patientId,
      kitchenId: payload.kitchenId,
      status: 'created',
      items: payload.items,
      notes: payload.notes?.trim(),
      confirmedByPatient: false,
      statusHistory: [
        {
          status: 'created',
          changedAt: now,
          changedByUserId: nutritionist.id,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStoreService.updateData((db) => {
      db.orders.push(order);
    });

    await this.auditService.logEvent({
      type: 'order_created',
      actorUserId: nutritionist.id,
      metadata: { orderId: order.id, code: order.code },
    });

    return order;
  }

  async listOrdersByProfile(user: SafeUser): Promise<OrderRecord[]> {
    const data = await this.dataStoreService.readData();
    switch (user.role) {
      case 'admin':
        return data.orders;
      case 'nutricionista':
        return data.orders.filter(
          (order) => order.createdByNutritionistId === user.id,
        );
      case 'paciente':
        if (!user.patientId) {
          return [];
        }
        return data.orders.filter((order) => order.patientId === user.patientId);
      case 'cozinha':
        if (!user.kitchenId) {
          return [];
        }
        return data.orders.filter((order) => order.kitchenId === user.kitchenId);
      default:
        return [];
    }
  }

  async getOrderByCodeSafe(code: string): Promise<{
    code: string;
    status: string;
    statusHistory: OrderRecord['statusHistory'];
    confirmedByPatient: boolean;
    createdAt: string;
    updatedAt: string;
  }> {
    const data = await this.dataStoreService.readData();
    const order = data.orders.find((item) => item.code === code);
    if (!order) {
      throw new NotFoundException('Pedido nao encontrado para o codigo informado.');
    }

    return {
      code: order.code,
      status: order.status,
      statusHistory: order.statusHistory,
      confirmedByPatient: order.confirmedByPatient,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async updateStatus(
    orderId: string,
    actor: SafeUser,
    payload: UpdateOrderStatusInput,
  ): Promise<OrderRecord> {
    const nextStatus = payload.status?.trim();
    if (!nextStatus) {
      throw new BadRequestException('status e obrigatorio.');
    }

    const updatedData = await this.dataStoreService.updateData((db) => {
      const order = db.orders.find((item) => item.id === orderId);
      if (!order) {
        throw new NotFoundException('Pedido nao encontrado.');
      }

      if (actor.role === 'cozinha' && actor.kitchenId !== order.kitchenId) {
        throw new ForbiddenException(
          'Cozinha so pode alterar pedidos da propria kitchenId.',
        );
      }

      order.status = nextStatus;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: nextStatus,
        changedAt: order.updatedAt,
        changedByUserId: actor.id,
      });
    });

    const order = updatedData.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new NotFoundException('Pedido nao encontrado apos atualizacao.');
    }

    await this.auditService.logEvent({
      type: 'order_status_changed',
      actorUserId: actor.id,
      metadata: { orderId, status: order.status },
    });

    return order;
  }

  async confirmOrder(orderId: string, patientUser: SafeUser): Promise<OrderRecord> {
    const updatedData = await this.dataStoreService.updateData((db) => {
      const order = db.orders.find((item) => item.id === orderId);
      if (!order) {
        throw new NotFoundException('Pedido nao encontrado.');
      }

      if (!patientUser.patientId || order.patientId !== patientUser.patientId) {
        throw new ForbiddenException('Paciente so pode confirmar o proprio pedido.');
      }

      order.confirmedByPatient = true;
      order.status = 'confirmed_by_patient';
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: 'confirmed_by_patient',
        changedAt: order.updatedAt,
        changedByUserId: patientUser.id,
      });
    });

    const order = updatedData.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new NotFoundException('Pedido nao encontrado apos confirmacao.');
    }

    await this.auditService.logEvent({
      type: 'order_status_changed',
      actorUserId: patientUser.id,
      metadata: { orderId, status: order.status },
    });

    return order;
  }

  private generateUniqueOrderCode(existingCodes: string[]): string {
    let code = '';
    do {
      const token = Math.random().toString(36).slice(2, 8).toUpperCase();
      code = `FIB-${token}`;
    } while (existingCodes.includes(code));
    return code;
  }
}
