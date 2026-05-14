# FastInBox Back

Backend da FastInBox, plataforma SaaS white label para operacao de marmitas personalizadas entre nutricionistas, pacientes, cozinha e administracao.

## Objetivo do MVP

Sustentar o fluxo central do negocio com seguranca, rastreabilidade e separacao clara de responsabilidades:

1. cadastro de pacientes pelo nutricionista
2. criacao de pedidos personalizados
3. geracao de codigo ou link unico por pedido
4. revisao, confirmacao e pagamento pelo paciente
5. encaminhamento do pedido pago para a cozinha
6. atualizacao de status de producao e entrega
7. monitoramento administrativo da operacao

## Responsabilidades esperadas

- autenticacao e separacao de perfis de acesso
- gestao de pacientes, clinicas e configuracoes white label
- orquestracao do ciclo de vida do pedido
- integracao com pagamento e confirmacao de status
- exposicao de filas operacionais para cozinha e administracao
- observabilidade basica, validacao de entrada e tratamento explicito de erros

## Stack

- NestJS 11
- TypeScript
- Jest
- ESLint
- Postgres
- Redis

## Scripts

```bash
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
```

## Variaveis de ambiente minimas

Use o arquivo `.env.example` como base:

- `PORT`: porta HTTP da API (padrao `4001`)
- `FRONTEND_URL`: origem permitida no CORS
- `DATA_FILE`: caminho do JSON de persistencia local (padrao `data/db.json`)

## API Sprint 3 (persistencia em arquivo)

Esta API usa persistencia local em JSON para evidenciar fluxo server-side sem dependencias externas.

- Seed inicial em `data/db.json`
- Sessoes de login persistidas em `sessions` dentro do mesmo arquivo
- Perfis suportados: `admin`, `nutricionista`, `paciente`, `cozinha`

### Rotas principais

- `POST /auth/login`
- `GET /health`
- `GET/POST/PATCH /patients` (com restricao de role e owner)
- `GET/POST /ingredients` (com restricao por role)
- `POST /orders`
- `GET /orders`
- `GET /orders/code/:code` (resposta segura por codigo)
- `PATCH /orders/:id/status`
- `PATCH /orders/:id/confirm`
- `GET /audit` (admin)

## Ambiente local

- API: `http://localhost:4001`
- Frontend esperado: `http://localhost:3001`
- Postgres Docker: porta `5451`
- Redis Docker: porta `6380`

## Sprint 1 - modo deploy unico

Para a entrega da Sprint 1 em um unico deploy na Vercel, o fluxo funcional principal foi consolidado no `front` com persistencia local para demonstracao academica.

Este backend permanece no repositorio para evolucao das proximas sprints (API real, banco e integracoes), mas nao e obrigatorio para rodar a demo da Sprint 1.

## Infra local

```bash
docker compose up -d
```

## Principios de implementacao

- compatibilidade total e zero regressao como prioridade
- regras de negocio isoladas por camada
- mudancas pequenas, testaveis e seguras
- cuidado especial com auth, pagamentos, dados e infraestrutura
- logs adequados, tipagem forte e contratos explicitos
