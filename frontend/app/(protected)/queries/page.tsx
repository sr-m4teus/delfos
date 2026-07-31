/**
 * Página de Consultas
 * Interface de chat para consultas em linguagem natural
 */

'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Typography, Spin, Empty, App } from 'antd';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';
import QueryChat from '@/components/queries/QueryChat';
import SqlEditModal from '@/components/queries/SqlEditModal';
import { post } from '@/lib/api/client';
import type { QueryResultResponse } from '@/types/api';
import styles from './queries.module.css';

const { Title } = Typography;
const { TextArea } = Input;

/** Persistência da conversa ao navegar (ex.: /results) e ao recarregar a aba */
const QUERIES_SESSION_KEY = 'delfos_queries_chat_session';

function serializeQueriesSession(
  messages: ChatMessage[],
  lastNaturalLanguageQuery: string,
  inputValue: string,
): string {
  return JSON.stringify({
    messages: messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    })),
    lastNaturalLanguageQuery,
    inputValue,
  });
}

function parseQueriesSession(raw: string): {
  messages: ChatMessage[];
  lastNaturalLanguageQuery: string;
  inputValue: string;
} | null {
  try {
    const p = JSON.parse(raw) as {
      messages?: Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
      lastNaturalLanguageQuery?: string;
      inputValue?: string;
    };
    if (!p || !Array.isArray(p.messages)) {
      return null;
    }
    return {
      messages: p.messages.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      lastNaturalLanguageQuery:
        typeof p.lastNaturalLanguageQuery === 'string' ? p.lastNaturalLanguageQuery : '',
      inputValue: typeof p.inputValue === 'string' ? p.inputValue : '',
    };
  } catch {
    return null;
  }
}

/**
 * Interface para mensagens do chat
 */
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  sqlQuery?: string;
  executionTime?: number;
}

/**
 * Componente QueriesPage
 */
export default function QueriesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sqlToEdit, setSqlToEdit] = useState<string>('');
  /** NL da última tradução bem-sucedida (para RAG/histórico na execução) */
  const [lastNaturalLanguageQuery, setLastNaturalLanguageQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<any>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Restaurar conversa antes da primeira pintura (evita flash e perda ao voltar de /results)
  useLayoutEffect(() => {
    const raw = sessionStorage.getItem(QUERIES_SESSION_KEY);
    if (!raw) {
      return;
    }
    const parsed = parseQueriesSession(raw);
    if (!parsed) {
      return;
    }
    if (
      parsed.messages.length > 0 ||
      parsed.lastNaturalLanguageQuery ||
      parsed.inputValue
    ) {
      setMessages(parsed.messages);
      setLastNaturalLanguageQuery(parsed.lastNaturalLanguageQuery);
      setInputValue(parsed.inputValue);
    }
  }, []);

  // Manter sessão sincronizada (navegação, refresh)
  useEffect(() => {
    try {
      sessionStorage.setItem(
        QUERIES_SESSION_KEY,
        serializeQueriesSession(messages, lastNaturalLanguageQuery, inputValue),
      );
    } catch {
      // quota ou storage indisponível
    }
  }, [messages, lastNaturalLanguageQuery, inputValue]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focar no textarea quando a página carregar
  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const queryText = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Traduzir consulta em linguagem natural para SQL
      const translateResponse = await post<{ sql_query?: string }>(
        '/api/delfos/translate',
        { natural_language_query: queryText },
        { timeout: 120000 },
      );

      if (translateResponse.error) {
        throw new Error(translateResponse.error.message || 'Erro ao traduzir consulta');
      }

      const sqlQuery = translateResponse.data?.sql_query;
      if (!sqlQuery) {
        throw new Error('Nenhuma query SQL foi gerada');
      }

      setLastNaturalLanguageQuery(queryText);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Consulta traduzida com sucesso! Você pode editar o SQL gerado antes de executar.',
        timestamp: new Date(),
        sqlQuery,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: error instanceof Error ? error.message : 'Erro ao processar consulta',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      message.error('Erro ao traduzir consulta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditSql = (sql: string) => {
    setSqlToEdit(sql);
    setIsEditModalOpen(true);
  };

  const handleValidateSql = async (sql: string) => {
    try {
      // Executar query SQL
      const executeResponse = await post<QueryResultResponse>('/api/delfos/execute', {
        sql_query: sql,
        ...(lastNaturalLanguageQuery.trim()
          ? { natural_language_query: lastNaturalLanguageQuery.trim() }
          : {}),
      });

      if (executeResponse.error) {
        throw new Error(executeResponse.error.message || 'Erro ao executar consulta');
      }

      const result = executeResponse.data;
      if (!result || !result.success) {
        throw new Error(result?.error || 'Erro ao executar consulta');
      }

      setIsEditModalOpen(false);

      const rowCount = result.row_count || 0;
      const executionTime = result.execution_time_ms ? result.execution_time_ms / 1000 : 0;

      const executionMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Consulta SQL executada com sucesso!\n\nResultados: ${rowCount.toLocaleString('pt-BR')} registros encontrados.`,
        timestamp: new Date(),
        sqlQuery: sql,
        executionTime,
      };

      const nextMessages = [...messagesRef.current, executionMessage];
      setMessages(nextMessages);

      if (result.data && result.data.length > 0) {
        try {
          sessionStorage.setItem(
            QUERIES_SESSION_KEY,
            serializeQueriesSession(nextMessages, lastNaturalLanguageQuery, inputValue),
          );
          sessionStorage.setItem(
            'queryResult',
            JSON.stringify({
              sqlQuery: sql,
              catalog: undefined,
              schema: undefined,
            }),
          );
        } catch {
          /* ignore */
        }
        router.push('/results');
      } else {
        message.info('Consulta executada com sucesso, mas não retornou resultados.');
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'error',
        content: error instanceof Error ? error.message : 'Erro ao executar consulta',
        timestamp: new Date(),
        sqlQuery: sql,
      };
      setMessages((prev) => [...prev, errorMessage]);
      throw error;
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Title level={2} style={{ margin: 0, flexShrink: 0 }}>Consultas em Linguagem Natural</Title>
        
        <Card 
          className={styles.chatCard} 
          styles={{ 
            body: { 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: 0,
              overflow: 'hidden'
            } 
          }}
        >
          <div className={styles.chatContainer}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <Empty
                  description="Faça sua primeira consulta em linguagem natural"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <div className={styles.messagesContainer}>
                {messages.map((message) => (
                  <QueryChat.Message
                    key={message.id}
                    message={message}
                    onEditSql={handleEditSql}
                    onViewResults={(sql) => {
                      try {
                        sessionStorage.setItem(
                          QUERIES_SESSION_KEY,
                          serializeQueriesSession(
                            messagesRef.current,
                            lastNaturalLanguageQuery,
                            inputValue,
                          ),
                        );
                        sessionStorage.setItem(
                          'queryResult',
                          JSON.stringify({
                            sqlQuery: sql,
                            catalog: undefined,
                            schema: undefined,
                          }),
                        );
                      } catch {
                        /* ignore */
                      }
                      router.push('/results');
                    }}
                  />
                ))}
                {isLoading && (
                  <div className={styles.loadingMessage}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                    <span>Processando consulta...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className={styles.inputContainer}>
            <div className={styles.inputWrapper}>
              <TextArea
                ref={textAreaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua consulta em linguagem natural... (ex: Mostre todos os clientes que compraram mais de 1000 reais)"
                autoSize={{ minRows: 4, maxRows: 10 }}
                disabled={isLoading}
                className={styles.textArea}
                size="large"
              />
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={isLoading}
                disabled={!inputValue.trim() || isLoading}
                className={styles.sendButton}
                size="large"
              />
            </div>
          </div>
        </Card>

        <SqlEditModal
          open={isEditModalOpen}
          sql={sqlToEdit}
          onCancel={() => setIsEditModalOpen(false)}
          onValidate={handleValidateSql}
        />
      </div>
    </div>
  );
}
