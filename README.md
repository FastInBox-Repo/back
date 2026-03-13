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

## Ambiente local

- API: `http://localhost:4001`
- Frontend esperado: `http://localhost:3001`
- Postgres Docker: porta `5451`
- Redis Docker: porta `6380`

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
