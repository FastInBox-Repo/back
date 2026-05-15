import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ClinicsService } from './modules/clinics/clinics.service';
import { IngredientsService } from './modules/ingredients/ingredients.service';
import { OrdersService } from './modules/orders/orders.service';
import { PatientsService } from './modules/patients/patients.service';
import { UsersService } from './modules/users/users.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly users: UsersService,
    private readonly clinics: ClinicsService,
    private readonly patients: PatientsService,
    private readonly catalog: IngredientsService,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit() {
    if (process.env.SEED_DATA === 'false') return;
    this.run();
  }

  private run() {
    const clinic = this.clinics.create({
      slug: 'fastinbox-demo',
      name: 'FastInBox Clinica Demo',
      cnpj: '00.000.000/0001-00',
      logoUrl: 'https://placehold.co/120x40/000/fff?text=FASTINBOX',
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
    });

    const admin = this.users.create({
      email: 'admin@fastinbox.test',
      password: 'fastinbox123',
      fullName: 'Admin Global',
      role: 'admin',
    });

    const nutritionist = this.users.create({
      email: 'nutri@fastinbox.test',
      password: 'fastinbox123',
      fullName: 'Dra. Nutricionista Demo',
      role: 'nutritionist',
      clinicId: clinic.id,
    });

    const kitchen = this.users.create({
      email: 'cozinha@fastinbox.test',
      password: 'fastinbox123',
      fullName: 'Cozinha Demo',
      role: 'kitchen',
      clinicId: clinic.id,
    });

    const patient = this.users.create({
      email: 'paciente@fastinbox.test',
      password: 'fastinbox123',
      fullName: 'Paciente Demo',
      role: 'patient',
      clinicId: clinic.id,
    });

    const proteinas = [
      { name: 'Frango grelhado', priceCents: 950, baseQty: 120 },
      { name: 'Tilapia grelhada', priceCents: 1380, baseQty: 130 },
      { name: 'Patinho moido', priceCents: 1100, baseQty: 130 },
    ];
    const carbs = [
      { name: 'Arroz integral', priceCents: 480, baseQty: 100 },
      { name: 'Batata doce', priceCents: 520, baseQty: 100 },
      { name: 'Quinoa', priceCents: 720, baseQty: 80 },
    ];
    const veg = [
      { name: 'Brocolis no vapor', priceCents: 380, baseQty: 90 },
      { name: 'Salada verde', priceCents: 320, baseQty: 80 },
      { name: 'Cenoura ralada', priceCents: 280, baseQty: 60 },
    ];

    const allIngredients = [
      ...proteinas.map((p) => ({ ...p, category: 'protein' as const })),
      ...carbs.map((p) => ({ ...p, category: 'carb' as const })),
      ...veg.map((p) => ({ ...p, category: 'vegetable' as const })),
    ];

    const ingredients = allIngredients.map((data) =>
      this.catalog.createIngredient({
        clinicId: clinic.id,
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        category: data.category,
        unitPriceCents: data.priceCents,
        unitOfMeasure: 'g',
        baseQuantity: data.baseQty,
        isAvailable: true,
      }),
    );

    const packaging = this.catalog.createPackaging({
      clinicId: clinic.id,
      name: 'Marmita 800ml padrao',
      capacityMl: 800,
      unitCostCents: 220,
    });

    const composition = this.catalog.createComposition({
      clinicId: clinic.id,
      name: 'Marmita Equilibrio',
      description: 'Composicao equilibrada com proteina, carbo e vegetal',
      basePriceCents: 2200,
      items: [
        {
          ingredientId: ingredients[0].id,
          quantity: 120,
          replaceable: true,
          mandatory: true,
        },
        {
          ingredientId: ingredients[3].id,
          quantity: 100,
          replaceable: true,
          mandatory: true,
        },
        {
          ingredientId: ingredients[6].id,
          quantity: 90,
          replaceable: true,
          mandatory: false,
        },
      ],
    });

    const ana = this.patients.create({
      clinicId: clinic.id,
      nutritionistId: nutritionist.id,
      fullName: 'Ana Souza',
      cpf: '12345678909',
      email: 'ana.souza@example.com',
      phone: '+55 11 99999-0001',
      preferences: ['Sem lactose'],
      restrictions: ['Glutem'],
    });

    const _beto = this.patients.create({
      clinicId: clinic.id,
      nutritionistId: nutritionist.id,
      fullName: 'Beto Lima',
      cpf: '98765432100',
      email: 'beto.lima@example.com',
      phone: '+55 11 99999-0002',
      preferences: ['Maior volume'],
      restrictions: [],
    });

    const sampleOrder = this.orders.create(
      { userId: nutritionist.id, role: 'nutritionist', clinicId: clinic.id },
      {
        patientId: ana.id,
        deliveryWindow: {
          date: tomorrowIso(),
          slot: '12:00-12:30',
          regionCode: '0451',
        },
        items: [
          {
            compositionId: composition.id,
            packagingId: packaging.id,
            quantity: 4,
          },
        ],
      },
    );
    this.orders.submit(
      { userId: nutritionist.id, role: 'nutritionist', clinicId: clinic.id },
      sampleOrder.id,
    );

    this.logger.log(
      `Seed completed. clinic=${clinic.id} admin=${admin.email} nutri=${nutritionist.email} kitchen=${kitchen.email} patient=${patient.email} demoOrderCode=${sampleOrder.code}`,
    );
  }
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
