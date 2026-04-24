# Shopify Affiliate MVP - Technical Challenge

## 🚀 Descripción
Solución integral para la gestión de afiliados en Shopify. La aplicación permite a los comerciantes crear campañas personalizadas, rastrear conversiones mediante Web Pixels (tecnología moderna sin ScriptTags) y automatizar el cobro de tarifas de infraestructura mediante la Billing API de Shopify.

## 🛠️ Stack Tecnológico
- **Framework:** React Router (Remix Engine)
- **Lenguaje:** TypeScript
- **Interfaz:** Shopify Polaris + App Bridge
- **Base de Datos:** SQLite + Prisma ORM
- **Tracking:** Web Pixel Extension API
- **Facturación:** Shopify Billing API (Usage Charges)

## 🎯 Requerimientos Implementados

### A. Panel Administrativo (Punto 3.A)
Dashboard desarrollado con componentes **Polaris** que muestra métricas en tiempo real:
- Total de ventas referidas.
- Comisiones acumuladas para pagar a afiliados.
- **Service Fee:** Cálculo automático de la ganancia de la App (5% sobre ventas).

### B. Tracking de Tráfico y Conversiones (3.B y 3.C)
Se implementó una **Web Pixel Extension** que garantiza precisión y privacidad:
1. **Captura:** Al detectar el parámetro `?ref=` en la URL, el Pixel persiste el ID del afiliado en el `localStorage` del navegador.
2. **Conversión:** Al completarse el evento `checkout_completed`, el Pixel recupera el ID, calcula el total y reporta asincrónicamente al backend mediante un endpoint seguro con soporte **CORS**.

### C. Sistema de Facturación (3.D)
Monetización automatizada mediante **Usage Records**:
- Al iniciar, la app requiere la aprobación de un plan de uso con un **Capped Amount** de $100 USD.
- Por cada venta referida, el backend genera automáticamente un cargo del 5% a través de GraphQL.

## 🏛️ Decisiones de Arquitectura

### 1. Web Pixel vs ScriptTags
Se optó por Web Pixels ya que operan en un sandbox seguro, son el estándar actual de Shopify (evitando la depreciación de ScriptTags) y permiten una suscripción nativa a eventos del checkout sin afectar el rendimiento de la tienda.

### 2. Idempotencia y Seguridad
- Se utiliza una **Idempotency Key** en la base de datos para evitar duplicación de comisiones ante reintentos de red.
- Comunicación backend-to-backend validada para asegurar la integridad de los datos de facturación.

### 3. Escalabilidad Teórica (Alta Concurrencia)
Para soportar +1,000 tiendas y picos como Black Friday:
- **Migración de DB:** Se recomienda pasar de SQLite a **PostgreSQL** con Connection Pooling (ej. Prisma Accelerate).
- **Colas de Mensajes:** Implementar **Redis/BullMQ** para procesar los `UsageRecords` de facturación de forma asíncrona, evitando bloquear el hilo principal durante picos de tráfico.
- **Cache:** Capa de caché para la validación de códigos de afiliados activos.

## 📦 Instalación Local
1. Clonar repositorio.
2. Ejecutar `npm install`.
3. Configurar Scopes en `shopify.app.toml`: `write_products, read_orders, write_pixels, read_customer_events`.
4. Ejecutar `npm run dev`.
5. Instalar en tienda de desarrollo y aceptar el cargo de prueba.

---
**Desarrollado por Jonas Mendelovich**
