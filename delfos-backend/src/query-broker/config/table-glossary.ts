/**
 * Glossário de negócio por tabela: descrição curta em linguagem natural (português),
 * usada para enriquecer o texto indexado no RAG (schema_tables collection).
 *
 * Chave: "<catalog>.<schema>.<table>" (mesmo formato de FQN usado pelo rag_orchestrator).
 *
 * Motivação: o embedding de schema originalmente só concatenava nome/tipo de coluna
 * (texto tipo DDL), o que produz baixa similaridade e má separação em relação a
 * perguntas em linguagem natural (ver Seção de avaliação de contexto na monografia).
 * Descrições de negócio elevam substancialmente o score e a discriminação relevante/ruído.
 */
export const TABLE_GLOSSARY: Record<string, string> = {
  // db_crm
  'supabase_targets.db_crm.cliente':
    'Cadastro de clientes (pessoa física ou jurídica) contratantes de serviços de transporte, com CPF/CNPJ, segmento e status.',
  'supabase_targets.db_crm.endereco_cliente':
    'Endereços de cobrança e entrega vinculados a cada cliente.',
  'supabase_targets.db_crm.contato_cliente':
    'Contatos (pessoas) de cada cliente, indicando quem é o decisor comercial.',
  'supabase_targets.db_crm.contrato':
    'Contratos comerciais firmados com clientes, com vigência, valor total e forma de pagamento.',
  'supabase_targets.db_crm.aditivo_contrato':
    'Aditivos que alteram vigência ou valor de um contrato existente.',
  'supabase_targets.db_crm.tabela_preco':
    'Tabelas de preço por rota e modal, vinculadas a um contrato.',
  'supabase_targets.db_crm.sla_contrato':
    'Acordos de nível de serviço (prazos de entrega) vinculados a um contrato.',

  // db_estoque
  'supabase_targets.db_estoque.armazem':
    'Cadastro de armazéns e centros de distribuição, com localização e capacidade.',
  'supabase_targets.db_estoque.zona_armazem':
    'Zonas dentro de um armazém (ex.: refrigerada, seca).',
  'supabase_targets.db_estoque.posicao_armazenagem':
    'Posições físicas de armazenagem (rua/coluna/nível) dentro de uma zona de armazém.',
  'supabase_targets.db_estoque.item_estoque':
    'Catálogo de itens e mercadorias armazenáveis, com peso, volume e classificação.',
  'supabase_targets.db_estoque.saldo_estoque':
    'Saldo atual de quantidade de cada item de estoque por armazém e posição.',
  'supabase_targets.db_estoque.movimentacao_estoque':
    'Movimentações de entrada, saída e transferência de itens no estoque.',
  'supabase_targets.db_estoque.lote_carga':
    'Lotes de carga recebidos ou expedidos em um armazém.',
  'supabase_targets.db_estoque.item_lote':
    'Itens de estoque que compõem um lote de carga.',

  // db_financeiro
  'supabase_targets.db_financeiro.centro_custo':
    'Centros de custo usados para classificar despesas e receitas da empresa.',
  'supabase_targets.db_financeiro.fatura':
    'Faturas emitidas para clientes referentes a contratos de transporte.',
  'supabase_targets.db_financeiro.item_fatura':
    'Itens de serviço detalhados dentro de uma fatura.',
  'supabase_targets.db_financeiro.cobranca':
    'Registros de tentativas e ações de cobrança de faturas em aberto.',
  'supabase_targets.db_financeiro.pagamento':
    'Pagamentos recebidos referentes a faturas.',
  'supabase_targets.db_financeiro.nota_debito_credito':
    'Notas de débito ou crédito emitidas para ajuste de faturas.',
  'supabase_targets.db_financeiro.conta_pagar':
    'Contas a pagar a fornecedores da empresa, com valor, vencimento e status de pagamento.',
  'supabase_targets.db_financeiro.lancamento_contabil':
    'Lançamentos contábeis (débito/crédito) vinculados a centros de custo.',

  // db_frota
  'supabase_targets.db_frota.modal':
    'Modais de transporte (rodoviário, ferroviário, aéreo) usados pela frota.',
  'supabase_targets.db_frota.categoria_veiculo':
    'Categorias de veículos dentro de um modal de transporte (ex.: caminhão, vagão).',
  'supabase_targets.db_frota.veiculo':
    'Cadastro de veículos da frota (caminhões, vagões, aeronaves), com status operacional e capacidade de carga.',
  'supabase_targets.db_frota.composicao_ferroviaria':
    'Composições de trens formadas por uma locomotiva e vagões.',
  'supabase_targets.db_frota.composicao_vagao':
    'Vagões que integram uma composição ferroviária, com sua posição no trem.',
  'supabase_targets.db_frota.aeronave_detalhe':
    'Dados específicos de veículos do tipo aeronave.',
  'supabase_targets.db_frota.documento_veiculo':
    'Documentos obrigatórios (licenciamento etc.) de um veículo.',
  'supabase_targets.db_frota.seguro_veiculo':
    'Apólices de seguro vinculadas a um veículo da frota.',

  // db_manutencao
  'supabase_targets.db_manutencao.fornecedor_servico':
    'Fornecedores e oficinas terceirizadas de serviços de manutenção.',
  'supabase_targets.db_manutencao.ativo':
    'Ativos físicos sujeitos a manutenção (pode ser um veículo da frota ou outro equipamento).',
  'supabase_targets.db_manutencao.plano_manutencao':
    'Planos preventivos de manutenção definidos para um ativo.',
  'supabase_targets.db_manutencao.ordem_servico':
    'Ordens de serviço de manutenção e reparo de um ativo, com custo total gasto no reparo.',
  'supabase_targets.db_manutencao.item_ordem_servico':
    'Peças e serviços detalhados dentro de uma ordem de serviço de manutenção.',
  'supabase_targets.db_manutencao.checklist_inspecao':
    'Checklists de inspeção realizados em um ativo.',
  'supabase_targets.db_manutencao.item_checklist':
    'Itens individuais verificados dentro de um checklist de inspeção.',

  // db_operacoes
  'supabase_targets.db_operacoes.terminal':
    'Terminais e pontos operacionais de origem, destino ou parada de rotas de transporte.',
  'supabase_targets.db_operacoes.rota':
    'Rotas de transporte entre dois terminais.',
  'supabase_targets.db_operacoes.rota_trecho':
    'Trechos intermediários que compõem uma rota de transporte.',
  'supabase_targets.db_operacoes.ordem_transporte':
    'Ordens de transporte solicitadas por clientes, vinculadas a contrato e rota.',
  'supabase_targets.db_operacoes.item_ordem_transporte':
    'Mercadorias detalhadas dentro de uma ordem de transporte.',
  'supabase_targets.db_operacoes.viagem':
    'Viagens realizadas para cumprir uma ordem de transporte, com veículo e operadores envolvidos.',
  'supabase_targets.db_operacoes.parada_viagem':
    'Paradas realizadas em terminais durante uma viagem.',
  'supabase_targets.db_operacoes.ocorrencia_viagem':
    'Ocorrências e incidentes registrados durante uma viagem.',

  // db_rh
  'supabase_targets.db_rh.departamento':
    'Departamentos da estrutura organizacional da empresa.',
  'supabase_targets.db_rh.cargo':
    'Cargos vinculados a um departamento, com faixa salarial.',
  'supabase_targets.db_rh.operador':
    'Cadastro de funcionários e operadores (motoristas, técnicos etc.), com cargo, departamento e status.',
  'supabase_targets.db_rh.habilitacao':
    'Habilitações e licenças (ex.: CNH) de um operador.',
  'supabase_targets.db_rh.certificacao_operador':
    'Certificações profissionais obtidas por um operador.',
  'supabase_targets.db_rh.modal_habilitado':
    'Modais de transporte que um operador está habilitado a operar.',
  'supabase_targets.db_rh.jornada_trabalho':
    'Registros de jornada de trabalho (horas trabalhadas) de um operador.',
  'supabase_targets.db_rh.ferias_afastamento':
    'Períodos de férias ou afastamento de um operador.',

  // db_telemetria (MongoDB)
  'mongodb_telemetria.db_telemetria.dispositivo_iot':
    'Dispositivos IoT instalados em veículos para captura de telemetria.',
  'mongodb_telemetria.db_telemetria.posicao_gps':
    'Posições de GPS capturadas de um veículo ou viagem ao longo do tempo.',
  'mongodb_telemetria.db_telemetria.telemetria_veiculo':
    'Leituras de sensores (velocidade, combustível etc.) de um veículo.',
  'mongodb_telemetria.db_telemetria.alerta':
    'Alertas de telemetria gerados por um veículo ou dispositivo, com nível de severidade.',
  'mongodb_telemetria.db_telemetria.cercamento_virtual':
    'Cercas virtuais (geofences) configuradas para monitoramento de veículos.',
  'mongodb_telemetria.db_telemetria.evento_cercamento':
    'Eventos de entrada ou saída de um veículo em uma cerca virtual.',
  'mongodb_telemetria.db_telemetria.configuracao_sensor':
    'Configurações de sensores de um dispositivo IoT.',
};

/**
 * Busca a descrição de negócio de uma tabela pelo catálogo e nome completo (schema.table).
 */
export function getTableDescription(catalog: string, schemaAndTable: string): string | undefined {
  return TABLE_GLOSSARY[`${catalog}.${schemaAndTable}`];
}
