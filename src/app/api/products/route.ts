import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser, errorResponse, HttpError } from "@/lib/session";
import { productCreateSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        defaultWarehouse: true,
        _count: { select: { items: true } },
      },
    });

    // Attach current in-warehouse stock per product.
    const stock = await prisma.item.groupBy({
      by: ["productId"],
      where: { status: "IN_WAREHOUSE" },
      _count: { _all: true },
    });
    const stockMap = new Map(stock.map((s) => [s.productId, s._count._all]));

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        inWarehouse: stockMap.get(p.id) ?? 0,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("admin", "manager");
    const data = productCreateSchema.parse(await req.json());

    const exists = await prisma.product.findUnique({ where: { codePrefix: data.codePrefix } });
    if (exists) throw new HttpError(409, `Code prefix "${data.codePrefix}" is already in use.`);

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        unit: data.unit ?? null,
        codePrefix: data.codePrefix,
        defaultWarehouseId: data.defaultWarehouseId ?? null,
      },
    });

    await audit({
      actorUserId: user.id,
      action: "create",
      entity: "product",
      entityId: product.id,
      metadata: { name: product.name, codePrefix: product.codePrefix },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
