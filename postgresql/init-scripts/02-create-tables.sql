-- Create tables for Delfos system
-- This script creates the initial database schema

-- Set schema
SET search_path TO delfos, public;

-- Users table
CREATE TABLE IF NOT EXISTS delfos.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'common' CHECK (role IN ('common', 'admin', 'db-manager')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON delfos.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON delfos.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON delfos.users(is_active);

-- Query history table (stores successful queries for RAG learning)
CREATE TABLE IF NOT EXISTS delfos.query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES delfos.users(id) ON DELETE CASCADE,
    natural_language_query TEXT NOT NULL,
    sql_query TEXT NOT NULL,
    executed_sql TEXT, -- SQL that was actually executed (may differ if edited by admin)
    was_edited BOOLEAN NOT NULL DEFAULT FALSE,
    was_successful BOOLEAN NOT NULL DEFAULT TRUE,
    execution_time_ms INTEGER,
    result_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    marked_as_successful BOOLEAN NOT NULL DEFAULT FALSE -- For RAG learning
);

-- Indexes for query_history
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON delfos.query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON delfos.query_history(created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_successful ON delfos.query_history(marked_as_successful);
CREATE INDEX IF NOT EXISTS idx_query_history_user_successful ON delfos.query_history(user_id, marked_as_successful);

-- Full text search index for natural language queries
CREATE INDEX IF NOT EXISTS idx_query_history_nl_query_fts ON delfos.query_history USING gin(to_tsvector('portuguese', natural_language_query));

-- Database connections table (stores connection info for target databases)
CREATE TABLE IF NOT EXISTS delfos.database_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('mysql', 'postgresql', 'oracle', 'sqlserver', 'mongodb', 'other')),
    connection_string TEXT, -- Encrypted connection string
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES delfos.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for database_connections
CREATE INDEX IF NOT EXISTS idx_db_connections_active ON delfos.database_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_db_connections_type ON delfos.database_connections(connection_type);

-- Audit log table (for security and compliance)
CREATE TABLE IF NOT EXISTS delfos.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES delfos.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON delfos.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON delfos.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON delfos.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON delfos.audit_log(resource_type, resource_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION delfos.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON delfos.users
    FOR EACH ROW
    EXECUTE FUNCTION delfos.update_updated_at_column();

CREATE TRIGGER update_database_connections_updated_at
    BEFORE UPDATE ON delfos.database_connections
    FOR EACH ROW
    EXECUTE FUNCTION delfos.update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA delfos TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA delfos TO CURRENT_USER;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA delfos TO CURRENT_USER;

-- Log table creation
DO $$
BEGIN
    RAISE NOTICE 'Delfos tables created successfully';
END $$;
