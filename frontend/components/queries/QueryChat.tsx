/**
 * Componente QueryChat - Mensagens do chat de consultas
 */

'use client';

import { Typography, Tag, Card, Button } from 'antd';
import { UserOutlined, RobotOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import type { ChatMessage } from '@/app/(protected)/queries/page';
import styles from './QueryChat.module.css';

const { Text, Paragraph } = Typography;

interface MessageProps {
  message: ChatMessage;
  onEditSql?: (sql: string) => void;
  onViewResults?: (sql: string) => void;
}

/**
 * Componente de mensagem do usuário
 */
function UserMessage({ message }: MessageProps) {
  return (
    <div className={styles.messageWrapper}>
      <div className={`${styles.message} ${styles.userMessage}`}>
        <div className={styles.messageHeader}>
          <UserOutlined className={styles.userIcon} />
          <Text strong>Você</Text>
          <Text type="secondary" className={styles.timestamp}>
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </div>
        <Paragraph className={styles.messageContent} style={{ margin: 0 }}>
          {message.content}
        </Paragraph>
      </div>
    </div>
  );
}

/**
 * Componente de mensagem do assistente
 */
function AssistantMessage({ message, onEditSql, onViewResults }: MessageProps) {
  return (
    <div className={styles.messageWrapper}>
      <div className={`${styles.message} ${styles.assistantMessage}`}>
        <div className={styles.messageHeader}>
          <RobotOutlined className={styles.assistantIcon} />
          <Text strong>Delfos</Text>
          <Text type="secondary" className={styles.timestamp}>
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </div>
        <Paragraph className={styles.messageContent} style={{ margin: '0 0 16px 0' }}>
          {message.content}
        </Paragraph>
        {message.sqlQuery && (
          <Card size="small" className={styles.sqlCard}>
            <div className={styles.sqlHeader}>
              <Text type="secondary" style={{ fontSize: 12 }}>SQL Gerado:</Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {onEditSql && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onEditSql(message.sqlQuery!)}
                    className={styles.editButton}
                  >
                    Editar
                  </Button>
                )}
                {onViewResults && message.executionTime !== undefined && (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onViewResults(message.sqlQuery!)}
                    className={styles.viewResultsButton}
                  >
                    Ver Resultados
                  </Button>
                )}
              </div>
            </div>
            <pre className={styles.sqlCode}>{message.sqlQuery}</pre>
          </Card>
        )}
        {message.executionTime !== undefined && (
          <div className={styles.metadata}>
            <Tag color="blue">Tempo: {message.executionTime.toFixed(3)}s</Tag>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente de mensagem de erro
 */
function ErrorMessage({ message }: MessageProps) {
  return (
    <div className={styles.messageWrapper}>
      <div className={`${styles.message} ${styles.errorMessage}`}>
        <div className={styles.messageHeader}>
          <CloseCircleOutlined className={styles.errorIcon} />
          <Text strong>Erro</Text>
          <Text type="secondary" className={styles.timestamp}>
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </div>
        <Paragraph className={styles.messageContent} style={{ margin: 0 }}>
          {message.content}
        </Paragraph>
      </div>
    </div>
  );
}

/**
 * Componente principal QueryChat
 */
const QueryChat = {
  Message: ({ message, onEditSql, onViewResults }: MessageProps) => {
    switch (message.type) {
      case 'user':
        return <UserMessage message={message} />;
      case 'assistant':
        return <AssistantMessage message={message} onEditSql={onEditSql} onViewResults={onViewResults} />;
      case 'error':
        return <ErrorMessage message={message} />;
      default:
        return null;
    }
  },
};

export default QueryChat;
