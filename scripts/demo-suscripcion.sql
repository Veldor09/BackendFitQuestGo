-- SOLO PARA LA BASE LOCAL, para ensayar y demostrar "destacar" mientras la
-- tabla real de suscripciones (ADM-09A) no esta desplegada. NO es una
-- migracion y no debe correr nunca en Render.
--
-- Crea la tabla con la forma que asume `SuscripcionesVigentesSql`
-- (id, usuario_id, estado, inicia_en, vence_en) y le da un plan `Activa` de 30
-- dias a `usuario@gmail.com` y a todas las cuentas Empresa locales.
--
-- Uso (desde la carpeta del backend, con la base arriba):
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < scripts/demo-suscripcion.sql
--
-- Para ensayar el vencimiento:
--   UPDATE suscripciones SET vence_en = now() - interval '1 minute';
-- y para renovar:
--   UPDATE suscripciones SET vence_en = now() + interval '30 days';

CREATE TABLE IF NOT EXISTS suscripciones (
  id serial PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado varchar(20) NOT NULL,
  inicia_en timestamptz NOT NULL,
  vence_en timestamptz NOT NULL
);

INSERT INTO suscripciones (usuario_id, estado, inicia_en, vence_en)
SELECT u.id, 'Activa', now() - interval '1 day', now() + interval '30 days'
FROM usuarios u
WHERE (u.email_user = 'usuario@gmail.com' OR u.idrol = 2)
  AND NOT EXISTS (
    SELECT 1 FROM suscripciones s
    WHERE s.usuario_id = u.id AND s.estado = 'Activa'
  );

SELECT s.id, u.email_user, s.estado, s.inicia_en, s.vence_en
FROM suscripciones s
JOIN usuarios u ON u.id = s.usuario_id
ORDER BY s.id;
