import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@warehouse.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const ownerEmail = process.env.REPORT_OWNER_EMAIL || "owner@warehouse.local";

  // --- Warehouse + Store ---
  const warehouse = await prisma.warehouse.upsert({
    where: { id: "wh_main" },
    update: {},
    create: { id: "wh_main", name: "Main Warehouse", location: "HQ" },
  });

  const store = await prisma.store.upsert({
    where: { id: "store_downtown" },
    update: {},
    create: { id: "store_downtown", name: "Downtown Store", location: "City Center" },
  });

  // --- Admin user ---
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: "admin", isActive: true },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      name: "System Admin",
      role: "admin",
      isActive: true,
    },
  });

  // --- Owner user (receives weekly report) ---
  const ownerHash = await bcrypt.hash("Owner123!", 10);
  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { role: "owner", isActive: true },
    create: {
      email: ownerEmail,
      passwordHash: ownerHash,
      name: "Warehouse Owner",
      role: "owner",
      isActive: true,
      invitedById: admin.id,
    },
  });

  // --- Staff user ---
  const staffHash = await bcrypt.hash("Staff123!", 10);
  await prisma.user.upsert({
    where: { email: "staff@warehouse.local" },
    update: { role: "staff", isActive: true, warehouseId: warehouse.id },
    create: {
      email: "staff@warehouse.local",
      passwordHash: staffHash,
      name: "Warehouse Staff",
      role: "staff",
      isActive: true,
      warehouseId: warehouse.id,
      invitedById: admin.id,
    },
  });

  // --- Sample products ---
  await prisma.product.upsert({
    where: { codePrefix: "MILK1L" },
    update: {},
    create: {
      name: "Milk 1L",
      description: "Full-cream milk carton 1 litre",
      category: "Dairy",
      unit: "carton",
      codePrefix: "MILK1L",
      defaultWarehouseId: warehouse.id,
    },
  });

  await prisma.product.upsert({
    where: { codePrefix: "SOAP200" },
    update: {},
    create: {
      name: "Soap Bar 200g",
      description: "Moisturizing soap bar 200g",
      category: "Personal Care",
      unit: "bar",
      codePrefix: "SOAP200",
      defaultWarehouseId: warehouse.id,
    },
  });

  console.log("Seed complete.");
  console.log(`  Admin:  ${adminEmail} / ${adminPassword}`);
  console.log(`  Owner:  ${ownerEmail} / Owner123!`);
  console.log(`  Staff:  staff@warehouse.local / Staff123!`);
  console.log(`  Store:  ${store.name} (${store.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
