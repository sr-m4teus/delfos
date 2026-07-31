-- Create the initial admin user.
--
-- Sem credencial hardcoded: email e senha vem do ambiente do container
-- (ADMIN_EMAIL / ADMIN_PASSWORD, declarados no docker-compose.yml e preenchidos
-- no .env). Se qualquer um faltar, o script NAO cria usuario nenhum e segue.
--
-- Definir em postgresql/.env antes do primeiro `docker compose up -d`:
--   ADMIN_EMAIL=admin@delfos.local
--   ADMIN_PASSWORD=<senha forte>
--
-- Roda so na criacao do volume. Para recriar: docker compose down -v (APAGA OS DADOS).
-- Para criar/trocar o admin depois, sem derrubar o banco:
--   docker compose exec postgres psql -U delfos_user -d delfos \
--     -c "UPDATE delfos.users SET password_hash = crypt('<nova-senha>', gen_salt('bf')) WHERE email = '<email>';"

SET search_path TO delfos, public;

-- Default vazio: \getenv nao altera a variavel quando a env nao existe,
-- entao o pre-set garante que a interpolacao abaixo sempre resolve.
\set admin_email ''
\set admin_password ''
\getenv admin_email ADMIN_EMAIL
\getenv admin_password ADMIN_PASSWORD

SELECT CASE
         WHEN :'admin_email' <> '' AND :'admin_password' <> '' THEN 'true'
         ELSE 'false'
       END AS create_admin \gset

\if :create_admin
    -- Hash bcrypt gerado no proprio banco (pgcrypto): a senha em claro nao e persistida.
    INSERT INTO delfos.users (email, name, password_hash, role, is_active)
    VALUES (
        :'admin_email',
        'Administrator',
        crypt(:'admin_password', gen_salt('bf')),
        'admin',
        TRUE
    )
    ON CONFLICT (email) DO NOTHING;

    \echo 'Admin user criado a partir de ADMIN_EMAIL/ADMIN_PASSWORD.'
\else
    \warning 'ADMIN_EMAIL/ADMIN_PASSWORD vazios -- nenhum usuario admin criado.'
    \warning 'Registre o primeiro usuario via POST /api/auth/register.'
\endif
