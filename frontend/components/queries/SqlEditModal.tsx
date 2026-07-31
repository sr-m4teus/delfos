/**
 * Modal para edição de SQL
 */

'use client';

import { useState, useEffect } from 'react';
import { Modal, Input, Button, Space, App } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import styles from './SqlEditModal.module.css';

const { TextArea } = Input;

interface SqlEditModalProps {
  open: boolean;
  sql: string;
  onCancel: () => void;
  onValidate: (sql: string) => Promise<void>;
}

/**
 * Componente SqlEditModal
 */
export default function SqlEditModal({
  open,
  sql,
  onCancel,
  onValidate,
}: SqlEditModalProps) {
  const { message } = App.useApp();
  const [editedSql, setEditedSql] = useState(sql);
  const [isValidating, setIsValidating] = useState(false);

  // Atualizar SQL quando o modal abrir com novo SQL
  useEffect(() => {
    if (open) {
      setEditedSql(sql);
    }
  }, [open, sql]);

  const handleValidate = async () => {
    if (!editedSql.trim()) {
      message.warning('Por favor, insira uma consulta SQL válida');
      return;
    }

    setIsValidating(true);
    try {
      await onValidate(editedSql.trim());
      onCancel();
      message.success('Consulta executada com sucesso!');
    } catch (error) {
      onCancel();
      const msg =
        error instanceof Error
          ? error.message
          : 'Erro ao executar a consulta';
      message.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancel = () => {
    setEditedSql(sql); // Resetar para o SQL original
    onCancel();
  };

  return (
    <Modal
      title="Editar Consulta SQL"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={800}
      className={styles.modal}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <TextArea
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            placeholder="Digite ou edite a consulta SQL..."
            rows={10}
            className={styles.sqlEditor}
            style={{ fontFamily: 'Courier New, monospace' }}
          />
        </div>
        <div className={styles.footer}>
          <Button onClick={handleCancel}>Cancelar</Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleValidate}
            loading={isValidating}
          >
            Validar e Executar
          </Button>
        </div>
      </Space>
    </Modal>
  );
}
