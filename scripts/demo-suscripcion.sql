-- SOLO PARA LA BASE LOCAL, para ensayar y demostrar "destacar" sin pasar por el
-- flujo completo de solicitud -> aprobacion del admin (ADM-09A). NO es una
-- migracion y no debe correr nunca en Render.
--
-- Usa las tablas REALES de ADM-09A (migracion 1792900000000-PlanesYSuscripciones):
-- no crea ninguna tabla, asi que primero hay que correr las migraciones. Si en
-- esta base quedo la tabla `suscripciones` de la version anterior de este script
-- (la de solo cinco columnas), borrala antes de migrar:
--   DROP TABLE IF EXISTS suscripciones;
--
-- Hace tres cosas, todas repetibles sin duplicar nada:
--   1. crea el plan "Plan Mensual" (30 dias) con precio en CRC, USD y EUR, si no
--      hay ningun plan;
--   2. le da una suscripcion `Activa` de 30 dias a `usuario@gmail.com` y a todas
--      las cuentas Empresa (rol 2) que no tengan una activa ni una solicitud
--      pendiente;
--   3. muestra como quedo.
-- Como `administrador_id` es obligatorio en una suscripcion activa, la deja a
-- nombre del primer administrador (rol 3); si no hay ninguno, avisa y no inserta.
--
-- Uso (desde la carpeta del backend, con la base arriba):
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < scripts/demo-suscripcion.sql
--
-- Para ensayar el vencimiento:
--   UPDATE suscripciones SET vence_en = now() - interval '1 minute' WHERE estado = 'Activa';
-- y para renovar:
--   UPDATE suscripciones SET vence_en = now() + interval '30 days' WHERE estado = 'Activa';

INSERT INTO planes_patrocinio (nombre, duracion_dias)
SELECT 'Plan Mensual', 30
WHERE NOT EXISTS (SELECT 1 FROM planes_patrocinio);

INSERT INTO precios_patrocinio (plan_id, moneda, importe)
SELECT p.id, m.moneda, m.importe
FROM (SELECT id FROM planes_patrocinio ORDER BY id LIMIT 1) p
CROSS JOIN (VALUES ('CRC', 10000.00), ('USD', 20.00), ('EUR', 18.00)) AS m(moneda, importe)
ON CONFLICT (plan_id, moneda) DO NOTHING;

INSERT INTO suscripciones
  (usuario_id, plan_id, estado, pais, moneda, precio_aplicado, inicia_en, vence_en, administrador_id)
SELECT
  u.id,
  (SELECT id FROM planes_patrocinio ORDER BY id LIMIT 1),
  'Activa',
  'CR',
  'CRC',
  (SELECT importe FROM precios_patrocinio
    WHERE plan_id = (SELECT id FROM planes_patrocinio ORDER BY id LIMIT 1) AND moneda = 'CRC'),
  now() - interval '1 day',
  now() + interval '30 days',
  (SELECT id FROM usuarios WHERE idrol = 3 ORDER BY id LIMIT 1)
FROM usuarios u
WHERE (u.email_user = 'usuario@gmail.com' OR u.idrol = 2)
  AND EXISTS (SELECT 1 FROM usuarios WHERE idrol = 3)
  AND EXISTS (SELECT 1 FROM planes_patrocinio)
  AND NOT EXISTS (
    SELECT 1 FROM suscripciones s
    WHERE s.usuario_id = u.id AND s.estado IN ('Solicitada', 'Activa')
  );

SELECT s.id, u.email_user, p.nombre AS plan, s.estado, s.inicia_en, s.vence_en
FROM suscripciones s
JOIN usuarios u ON u.id = s.usuario_id
JOIN planes_patrocinio p ON p.id = s.plan_id
ORDER BY s.id;
