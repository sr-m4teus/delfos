---
title: Delfos RAG Orchestrator
emoji: 🔎
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# RAG Orchestrator Component

RAG (Retrieval-Augmented Generation) Orchestrator component for the Delfos project - Gerenciamento de contexto e schemas.

## Responsabilidades

O RAG Orchestrator é responsável por gerenciar contexto através de RAG para fornecer informações relevantes aos agentes de tradução:

- Armazenar schemas de todos os bancos de dados alvo
- Armazenar consultas bem-sucedidas para aprendizado
- Retornar contexto relevante (schemas e consultas relacionadas) baseado na query do usuário
- Armazenar novas consultas bem-sucedidas marcadas pelo usuário
- Refinar contexto com base em histórico de sucessos

## Dados Gerenciados

- Schemas completos dos bancos de dados alvo
- Tabelas e estruturas de dados
- Histórico de consultas bem-sucedidas
- Relacionamentos entre tabelas

## Estrutura

- `src/` - Código fonte Python
- `tests/` - Testes
- `.specify/` - Spec kit para gerenciamento de especificações deste componente

## Getting Started

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the application:
```bash
# A partir do diretório raiz (rag_orchestrator/)
python src/main.py

# Ou usando módulo Python
python -m src.main

# Se estiver dentro do diretório src/, execute a partir do diretório raiz:
cd ..
python src/main.py
```

## Integrações

- **Backend**: API REST para receber solicitações de contexto e retornar schemas/consultas relevantes

## Especificações

Use o spec kit configurado neste componente para criar e gerenciar especificações específicas do RAG Orchestrator:

```bash
# Comandos do spec kit disponíveis aqui
```
