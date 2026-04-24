import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import shopify from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const text = await request.text();
    const { code, total, shop } = JSON.parse(text);

    console.log(`\n PIXEL: Procesando venta de $${total} para el código ${code}`);

    if (code && total && shop) {
      const affiliate = await db.affiliate.findFirst({
        where: { code: code, shop: shop }
      });

      if (affiliate) {
        // 1. Cálculo de comisiones
        const affiliateCommission = (total * affiliate.commissionRate) / 100;
        const appFee = (total * 5) / 100; // El 5% obligatorio por el Punto 3.D

        // 2. Persistencia en DB
        await db.conversionEvent.create({
          data: {
            shop: shop,
            affiliateId: affiliate.id,
            orderId: `px-${Date.now()}`,
            totalAmount: total,
            appCommissionAmount: appFee, // Guardamos lo que nosotros ganamos
            idempotencyKey: `px-${Date.now()}-${code}`, 
          }
        });

        // 3. REGISTRO DE COBRO EN SHOPIFY (Punto 3.D - UsageRecord)
        try {
          const { admin } = await shopify.unauthenticated.admin(shop);
          
          const billingResponse = await admin.graphql(`
            mutation {
              appUsageRecordCreate(
                description: "Tarifa de infraestructura 5% - Venta Ref: ${code}",
                price: { amount: ${appFee.toFixed(2)}, currencyCode: USD }
              ) {
                userErrors { message }
                appUsageRecord { id }
              }
            }
          `);

          const billingResult = await billingResponse.json();
          console.log(" Facturación Shopify:", JSON.stringify(billingResult.data));
        } catch (billingError) {
          console.error(" Error al reportar el UsageRecord a Shopify:", billingError);
        }
        
        console.log(` ÉXITO: Venta procesada. Afiliado: $${affiliateCommission} | App Fee: $${appFee}`);
        
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: corsHeaders 
        });
      }
    }
  } catch (e) {
    console.error(" Error crítico en el Pixel endpoint:", e);
  }

  return new Response(JSON.stringify({ success: false }), { 
    status: 400, 
    headers: corsHeaders 
  });
};