import {
  AppDistribution,
  shopifyApp,
  BillingInterval,
} from "@shopify/shopify-app-react-router/server"; // <-- PAQUETE NUEVO
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import prisma from "./db.server";

export const PLAN_NAME = "Tarifa de Infraestructura (Uso)";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: "2024-10" as any, 
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma) as any,
  distribution: AppDistribution.AppStore,
  restResources: restResources as any,
  billing: {
    [PLAN_NAME]: {
      lineItems: [
        {
          amount: 100.0,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: "Cobro del 5% de comisión por cada venta referida",
        }
      ]
    },
  },
  future: {},
});

export default shopify;
export const apiVersion = "2024-10" as any;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;