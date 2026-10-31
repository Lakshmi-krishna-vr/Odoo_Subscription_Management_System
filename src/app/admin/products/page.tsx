import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { tax: true, variants: true },
  });

  return (
    <Shell role="admin">
      <PageHeader
        title="Products"
        subtitle="Catalogue of what Brightloop sells, with variants and the tax each line attracts."
        right={
          <div className="flex items-center gap-3">
            <Badge>{products.length} in catalogue</Badge>
            <a
              href="/admin/products/new"
              className="rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8]"
            >
              New product
            </a>
          </div>
        }
      />

      <Card title="Catalogue" description="Prices are stored in paise and shown in rupees.">
        <p className="mb-3 text-sm text-[var(--muted)]">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th className="num">Sales price</th>
              <th className="num">Cost price</th>
              <th>Tax</th>
              <th>Variants</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-sm text-[var(--muted)]">
                  No products yet.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <span className="font-medium">{product.name}</span>
                    {product.isAddon ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">add-on</span>
                    ) : null}
                  </td>
                  <td className="capitalize">{product.type}</td>
                  <td className="num tabular-nums">{formatINR(product.salesPrice)}</td>
                  <td className="num tabular-nums">{formatINR(product.costPrice)}</td>
                  <td>{product.tax ? product.tax.name : "—"}</td>
                  <td className="text-sm">
                    {product.variants.length === 0 ? (
                      "—"
                    ) : (
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {product.variants.map((variant) => (
                          <span key={variant.id}>
                            {variant.attribute}: {variant.value}
                            {variant.extraPrice !== 0 ? (
                              <span className="text-[var(--muted)]">
                                {" "}
                                (+{formatINR(variant.extraPrice)})
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>
                    <Badge>{product.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
