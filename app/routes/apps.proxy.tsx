import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Validamos que el request venga del Proxy de Shopify de forma segura
  const { session } = await authenticate.public.appProxy(request);
  
  if (!session) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { code, total, shop } = body;

  if (code && total) {
    // Buscamos al afiliado
    const affiliate = await db.affiliate.findFirst({
      where: { code: code, shop: shop }
    });

    if (affiliate) {
      const commissionCalculated = (total * affiliate.commissionRate) / 100;

      // Guardamos la conversión
      await db.conversionEvent.create({
        data: {
          shop: shop,
          affiliateId: affiliate.id,
          orderId: `pixel-${Date.now()}`, // Usamos timestamp como ID único temporal
          totalAmount: total,
          appCommissionAmount: commissionCalculated,
          idempotencyKey: `pixel-${Date.now()}-${code}`, 
        }
      });
      
      return Response.json({ success: true, commission: commissionCalculated });
    }
  }

  return Response.json({ success: false }, { status: 400 });
};