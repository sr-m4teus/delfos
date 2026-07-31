-- Initialize Delfos Database
-- This script runs automatically when the container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create schema for application tables
CREATE SCHEMA IF NOT EXISTS delfos;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA delfos TO CURRENT_USER;

-- Set default search path
ALTER DATABASE delfos SET search_path TO delfos, public;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Delfos database initialized successfully';
END $$;
