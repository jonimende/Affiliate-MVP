import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser }) => {
  
  // 1. CAPTURAR URL AL ENTRAR (Punto 3.B)
  analytics.subscribe('page_viewed', async (event) => {
    const urlString = event.context.document.location.href;
    const match = urlString.match(/[?&]ref=([^&]+)/);
    
    if (match) {
      // Usamos localStorage que no es bloqueado tan fácil como las cookies
      await browser.localStorage.setItem("affiliate_ref", match[1]);
    }
  });

  // 2. AVISAR AL CHECKOUT (Punto 3.C)
  analytics.subscribe('checkout_completed', async (event) => {
    const refStored = await browser.localStorage.getItem("affiliate_ref");
    
    if (refStored) {
      const checkout = event.data.checkout;
      const orderTotal = checkout.subtotalPrice?.amount ?? 0;
      const shopDomain = event.context.document.location.hostname;

      const APP_URL = "https://enhancement-sometimes-relief-gaming.trycloudflare.com"; 

      fetch(`${APP_URL}/api/pixel`, {
        method: "POST",
        // Lo mandamos como text/plain para saltar la barrera de seguridad de Shopify
        headers: { "Content-Type": "text/plain" }, 
        body: JSON.stringify({ 
          code: refStored, 
          total: Number(orderTotal), 
          shop: shopDomain 
        }),
        keepalive: true
      });

      // Limpiamos la memoria para que no cobre comisiones de más a futuro
      await browser.localStorage.removeItem("affiliate_ref");
    }
  });
});