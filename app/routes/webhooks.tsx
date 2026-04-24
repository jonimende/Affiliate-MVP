import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  // 1. Esto nos avisa si el túnel está vivo y Shopify nos habla
  console.log(`\nLLEGÓ UN WEBHOOK: ${topic} desde la tienda ${shop}`);

  if (topic === "ORDERS_CREATE") {
    const order = payload as any;
    const discountCodes = order.discount_codes || [];
    
    // 2. Nos muestra qué cupones detectó Shopify en esa compra
    console.log(`🛒 Orden #${order.id} procesada. Cupones detectados:`, discountCodes.map((d: any) => d.code));

    for (const discount of discountCodes) {
      const codeUsed = discount.code;
      console.log(`🔍 Buscando afiliado en base de datos para el código: ${codeUsed}...`);

      const affiliate = await db.affiliate.findFirst({
        where: { code: codeUsed, shop: shop }
      });

      if (affiliate) {
        const subtotal = parseFloat(order.subtotal_price);
        const commissionCalculated = (subtotal * affiliate.commissionRate) / 100;

        try {
          await db.conversionEvent.create({
            data: {
              shop: shop,
              affiliateId: affiliate.id,
              orderId: String(order.id),
              totalAmount: subtotal,
              appCommissionAmount: commissionCalculated,
              idempotencyKey: `${order.id}-${codeUsed}`, 
            }
          });
          console.log(`ÉXITO: Comisión de $${commissionCalculated} guardada para ${codeUsed}`);
        } catch (error) {
          console.error(`ERROR al guardar en la base de datos:`, error);
        }
      } else {
        // 3. Si llega acá, es porque el cupón entró pero no lo reconoció como tuyo
        console.log(`ALERTA: El código ${codeUsed} se usó, pero no está registrado para ningún afiliado en esta tienda.`);
      }
    }
  }

  return new Response(null, { status: 200 });
};