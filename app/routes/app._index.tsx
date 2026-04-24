import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineGrid,
  TextField,
  DataTable,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate, PLAN_NAME } from "../shopify.server"; 
import prisma from "../db.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);

  // 1. Facturación (Comentado por restricción de cuenta Partner - Punto 3.D)
  /*
  try {
    await billing.require({
      plans: [PLAN_NAME],
      isTest: true,
      onFailure: async () => {
        throw await billing.request({
          plan: PLAN_NAME,
          isTest: true,
          returnUrl: `https://${session.shop}/admin/apps/affiliate-mvp`,
        });
      },
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Error Facturación:", error);
  }
  */

  // 2. Auto-Instalador del Pixel (Punto 3.C)
  try {
    const pixelReq = await admin.graphql(`
      mutation {
        webPixelCreate(webPixel: { settings: "{\\"accountID\\":\\"12345\\"}" }) {
          userErrors { message }
          webPixel { id }
        }
      }
    `);
    const pixelRes = await pixelReq.json();
    if (pixelRes.data?.webPixelCreate?.webPixel) {
      console.log("Pixel verificado.");
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Error Pixel:", error);
  }

  // 3. Métricas y Datos (Punto 3.A)
  // Usamos parallel fetching para máxima velocidad
  const [affiliates, allConversions] = await Promise.all([
    prisma.affiliate.findMany({
      where: { shop: session.shop },
      include: { 
        events: true 
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.conversionEvent.findMany({
      where: { shop: session.shop }
    })
  ]);

  // Calculamos la deuda específica de cada afiliado para la tabla
  const affiliatesWithStats = affiliates.map(aff => {
    const debt = aff.events.reduce((sum: number, conv: any) => {
      return sum + (conv.totalAmount * aff.commissionRate / 100);
    }, 0);
    
    return { ...aff, debt: debt.toFixed(2) };
  });

  // Estadísticas Generales del Dashboard
  const totalDebt = affiliatesWithStats.reduce((sum: number, aff: any) => sum + parseFloat(aff.debt), 0);
  const totalAppProfit = allConversions.reduce((sum: number, c: any) => sum + c.appCommissionAmount, 0);

  const stats = {
    ventasReferidas: allConversions.length,
    comisionesAfiliados: totalDebt.toFixed(2),
    gananciaApp: totalAppProfit.toFixed(2)
  };

  return { affiliates: affiliatesWithStats, stats };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const code = formData.get("code");
  const commissionRate = formData.get("commissionRate");

  if (code && commissionRate) {
    await prisma.affiliate.create({
      data: {
        shop: session.shop,
        code: String(code).toUpperCase().trim(),
        commissionRate: parseFloat(String(commissionRate)),
      },
    });
  }
  return { success: true };
};

export default function Index() {
  const { affiliates, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [code, setCode] = useState("");
  const [commission, setCommission] = useState("");

  const handleCreate = () => {
    const formData = new FormData();
    formData.append("code", code);
    formData.append("commissionRate", commission);
    fetcher.submit(formData, { method: "post" });
    setCode("");
    setCommission("");
  };

  const rows = affiliates.map((a: any) => [
    a.code,
    `${a.commissionRate}%`,
    `$${a.debt}`,
    new Date(a.createdAt).toLocaleDateString('es-AR'),
  ]);

  return (
    <Page title="Administración de Afiliados">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <InlineGrid columns={3} gap="400">
              <Card>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">Ventas Referidas</Text>
                  <Text as="p" variant="headingXl">{stats.ventasReferidas}</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">Deuda Total Afiliados</Text>
                  <Text as="p" variant="headingXl" tone="critical">${stats.comisionesAfiliados}</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">Ganancia App (5%)</Text>
                  <Text as="p" variant="headingXl" tone="success">${stats.gananciaApp}</Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Registrar Nuevo Afiliado</Text>
                <InlineGrid columns={2} gap="400">
                  <TextField label="Código (Ej: UTN2026)" value={code} onChange={setCode} autoComplete="off" />
                  <TextField label="Comisión (%)" type="number" value={commission} onChange={setCommission} autoComplete="off" suffix="%" />
                </InlineGrid>
                <Button onClick={handleCreate} variant="primary" loading={fetcher.state === "submitting"}>
                  Crear Afiliado
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Lista de Afiliados y Deuda</Text>
                {affiliates.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric', 'text']}
                    headings={['Código', 'Tasa %', 'Deuda Acumulada', 'Fecha']}
                    rows={rows}
                  />
                ) : (
                  <Text as="p" variant="bodyMd">No hay afiliados registrados.</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}