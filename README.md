# Shopify Affiliate MVP - Technical Challenge

## Descripción
Solución integral para la gestión de afiliados en Shopify. La aplicación permite a los comerciantes crear campañas personalizadas, rastrear eventos mediante Web Pixels (tecnología moderna sin ScriptTags) y automatizar el cobro de tarifas de infraestructura mediante la Billing API de Shopify.

## Stack Tecnológico
- **Framework:** React Router (Remix Engine)
- **Lenguaje:** TypeScript
- **Interfaz:** Shopify Polaris + App Bridge
- **Base de Datos:** SQLite (Local/Dev) + Prisma ORM
- **Tracking:** Web Pixel Extension API
- **Facturación:** Shopify Billing API (Usage Charges)

## Requerimientos Implementados

### A. Panel Administrativo (Punto 3.A)
Dashboard desarrollado con componentes **Polaris** que muestra métricas en tiempo real:
- Total de ventas referidas.
- Deuda acumulada para pagar a afiliados (cálculo dinámico basado en la comisión de cada afiliado).
- **Service Fee:** Cálculo automático de la ganancia de la App (5% sobre ventas).

### B. Tracking de Tráfico y Eventos (3.B y 3.C)
Se implementó una **Web Pixel Extension** que garantiza precisión y privacidad:
1. **Captura:** Al detectar el parámetro `?ref=` en la URL, el Pixel persiste el ID del afiliado en el entorno local del navegador.
2. **Conversión:** Al completarse el evento `checkout_completed`, el Pixel recupera el ID, calcula el total y reporta asincrónicamente al backend mediante un endpoint seguro con soporte **CORS**.

### C. Sistema de Facturación (3.D)
Monetización automatizada mediante **Usage Records**:
- Al iniciar, la app requiere la aprobación de un plan de uso con un **Capped Amount** de $100 USD.
- Por cada evento de venta referido, el backend genera automáticamente un cargo del 5% a través de GraphQL.

---

## Decisiones de Arquitectura

### 1. Web Pixel vs Alternativas
- **Elección:** Web Pixels API. Operan en un sandbox seguro, no bloquean el renderizado del checkout y son el estándar actual de Shopify.
- **Alternativas descartadas:** Se descartaron los **ScriptTags** por estar depreciados y presentar riesgos de seguridad (XSS). Se descartó el uso de **Webhooks** (`orders/create`) para la atribución de afiliados porque dependen de que el cliente haya ingresado un código de descuento, lo cual rompe la fricción cero del link `?ref=`.

### 2. Consistencia y Manejo de Asincronía (Pixel vs Billing)
Para garantizar la consistencia entre el evento reportado por el Pixel y la creación del cargo de facturación en Shopify, se implementó:
- **Idempotency Keys:** Cada evento entrante genera un hash único (`pixel-timestamp-code`). Si Shopify o la red fallan y el Pixel reintenta el envío, la base de datos rechaza el duplicado, evitando cobrarle dos veces al comerciante.
- **Estrategia para Producción:** En un entorno de alta concurrencia, el endpoint del Pixel no debe esperar a la respuesta de la Billing API. El evento se guarda en la BD inmediatamente, y la llamada a Shopify se delega a una **cola de tareas en segundo plano (ej. Redis/BullMQ)** con políticas de reintento (Retries & Dead Letter Queues).

---

## Sustentación de Base de Datos

### Esquema Actual (SQLite)
El modelo relacional vincula `Affiliate` (1) con `Events` (N). Se utilizan identificadores únicos universales (UUIDs) para evitar colisiones de IDs distribuidos. 

### Estrategia de Escalamiento (Millones de Eventos)
Ante picos de tráfico (ej. Black Friday) y para soportar alta concurrencia, SQLite resulta insuficiente por sus bloqueos de escritura. La estrategia de migración es:
1. **Motor SQL Robusto:** Migración a **PostgreSQL**.
2. **Connection Pooling:** Implementación de PgBouncer o Prisma Accelerate para evitar agotar las conexiones a la BD cuando miles de Pixels disparen eventos en simultáneo.
3. **Indexación Estratégica:** Creación de índices compuestos en `(shop, code)` dentro de la tabla de afiliados para consultas de validación en tiempo constante (O(1)), y en `(affiliateId, createdAt)` para acelerar la renderización del Dashboard.
4. **Particionamiento:** Implementar "Table Partitioning" en PostgreSQL por rango de fechas (mes a mes) para la tabla de `Events`, manteniendo las tablas activas pequeñas y las consultas rápidas.

---

## DevOps: Gestión de Entornos y Despliegue

### 1. Gestión del Ciclo de Vida (Entornos)
- **Development:** Ejecución local con SQLite, túneles con Cloudflare/Ngrok y una App de desarrollo en el Partner Dashboard.
- **Staging:** Base de datos réplica anonimizada. Se utiliza una "App Custom" separada en el Partner Dashboard instalada en tiendas de prueba cerradas para QA.
- **Production:** App pública aprobada en la App Store. Base de datos productiva (PostgreSQL).

### 2. Pipelines de CI/CD (GitHub Actions)
Un workflow seguro antes de hacer merge a la rama `main` incluye:
1. **Linter & Formatter:** Verificación estática con ESLint/Prettier.
2. **Testing:** Ejecución de tests unitarios (Vitest) sobre la lógica de cálculo de comisiones.
3. **Build Check:** Compilación de la app de Remix.
4. **Database Migration:** Ejecución de `prisma migrate deploy` en el entorno de Staging.
5. **Deploy Automático:** Si los pasos anteriores pasan, se hace push de la imagen o código al proveedor de nube.

### 3. Estrategia de Despliegue (Infraestructura)
Dada la naturaleza de Node.js, Remix y Prisma, plataformas como **Render**, **Railway** o VPS tradicionales (ej. DigitalOcean) son ideales:
- **Dockerización:** La app se empaqueta en un contenedor Docker multi-stage para asegurar paridad entre entornos y un peso reducido.
- **Manejo de Secretos:** Variables críticas (`SHOPIFY_API_SECRET`, `DATABASE_URL`) no se versionan. Se inyectan en tiempo de ejecución utilizando el Secrets Manager del proveedor Cloud. Para la **rotación de secretos**, se configura la App en Shopify para emitir nuevas claves, actualizando el Secrets Manager y reiniciando los contenedores de forma escalonada (Zero-Downtime Deployment).
- **Monitoreo (Health Checks):** Se expone un endpoint `/api/health` que verifica la conectividad a la base de datos y memoria. El balanceador de carga del proveedor consulta este endpoint cada 10 segundos para reiniciar contenedores "colgados".

---

## Instrucciones de Instalación Local
1. Clonar el repositorio.
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno `.env` con las credenciales del Partner Dashboard.
4. Actualizar Scopes en `shopify.app.toml`: `write_products, read_orders, write_pixels, read_customer_events`.
5. Levantar el entorno de desarrollo: `npm run dev`
6. Instalar en tienda de desarrollo (Development Store) y aprobar el cargo de prueba inicial.

---
**Desarrollado por Jonas Mendelovich**
