import bcrypt from 'bcrypt';
import { PrismaClient, RoleCode } from '@prisma/client';
const prisma = new PrismaClient();

const upsertInventory = (itemId: string, locationId: string, batch: string, physicalQuantity: number) => prisma.inventory.upsert({ where: { itemId_locationId_batch: { itemId, locationId, batch } }, update: {}, create: { itemId, locationId, batch, physicalQuantity } });

async function main() {
  const roles = Object.fromEntries(await Promise.all([
    [RoleCode.ADMIN, 'Administrator'], [RoleCode.OPERATIONS_USER, 'Operations User'], [RoleCode.SALES_USER, 'Sales User'],
  ].map(async ([code, label]) => [code, await prisma.role.upsert({ where: { code: code as RoleCode }, update: { label: label as string }, create: { code: code as RoleCode, label: label as string } })])));
  const passwordHash = await bcrypt.hash('OpsFlow!2026', 12);
  const users = Object.fromEntries(await Promise.all([
    ['admin@opsflow.demo', 'Avery Morgan', RoleCode.ADMIN], ['operations@opsflow.demo', 'Jordan Lee', RoleCode.OPERATIONS_USER], ['sales@opsflow.demo', 'Taylor Singh', RoleCode.SALES_USER],
  ].map(async ([email, name, role]) => [email, await prisma.user.upsert({ where: { email }, update: { name, roleId: roles[role as RoleCode].id }, create: { email, name, roleId: roles[role as RoleCode].id, passwordHash } })])));
  const locations = Object.fromEntries(await Promise.all([
    ['WH-A', 'Assembly Hub — Pune'], ['WH-B', 'Central Warehouse — Mumbai'], ['WH-C', 'Regional Depot — Bengaluru'],
  ].map(async ([code, name]) => [code, await prisma.location.upsert({ where: { code }, update: { name }, create: { code, name } })])));
  const categories = Object.fromEntries(await Promise.all([
    'Components', 'Fasteners', 'Electrical', 'Safety',
  ].map(async (name) => [name, await prisma.category.upsert({ where: { name }, update: {}, create: { name } })])));
  const itemData = [
    ['STL-100', 'Steel Component', 'Components'], ['ALM-200', 'Aluminum Bracket', 'Components'], ['FST-M8', 'M8 Fastener Kit', 'Fasteners'], ['CBL-050', 'Control Cable 5m', 'Electrical'], ['SNS-010', 'Proximity Sensor', 'Electrical'], ['GLV-001', 'Safety Gloves', 'Safety'], ['PNT-020', 'Industrial Paint 20L', 'Safety'], ['MTR-300', 'Drive Motor Assembly', 'Components'],
  ] as const;
  const items = Object.fromEntries(await Promise.all(itemData.map(async ([sku, name, category]) => [sku, await prisma.item.upsert({ where: { sku }, update: { name, categoryId: categories[category].id }, create: { sku, name, categoryId: categories[category].id } })])));
  await Promise.all([
    upsertInventory(items['STL-100'].id, locations['WH-A'].id, 'STEEL-2401', 40), upsertInventory(items['STL-100'].id, locations['WH-B'].id, 'STEEL-2401', 120), upsertInventory(items['STL-100'].id, locations['WH-C'].id, 'STEEL-2401', 18),
    upsertInventory(items['ALM-200'].id, locations['WH-A'].id, 'AL-2402', 80), upsertInventory(items['ALM-200'].id, locations['WH-B'].id, 'AL-2402', 150),
    upsertInventory(items['FST-M8'].id, locations['WH-A'].id, 'GENERAL', 500), upsertInventory(items['FST-M8'].id, locations['WH-B'].id, 'GENERAL', 800),
    upsertInventory(items['CBL-050'].id, locations['WH-A'].id, 'GENERAL', 15), upsertInventory(items['CBL-050'].id, locations['WH-C'].id, 'GENERAL', 90),
    upsertInventory(items['SNS-010'].id, locations['WH-B'].id, 'SENSOR-12', 25), upsertInventory(items['GLV-001'].id, locations['WH-A'].id, 'GENERAL', 120), upsertInventory(items['PNT-020'].id, locations['WH-C'].id, 'GENERAL', 44), upsertInventory(items['MTR-300'].id, locations['WH-B'].id, 'MOTOR-07', 12),
  ]);
  await Promise.all([
    ['Acme Industrial Ltd.', 'procurement@acme.demo'], ['Northstar Manufacturing', 'orders@northstar.demo'], ['Vertex Automation', 'supply@vertex.demo'],
  ].map(([name, email]) => prisma.customer.upsert({ where: { email }, update: { name }, create: { name, email } })));
  await prisma.workOrder.upsert({ where: { code: 'WO-DEMO-1001' }, update: {}, create: { code: 'WO-DEMO-1001', locationId: locations['WH-A'].id, assignedUserId: users['operations@opsflow.demo'].id, materials: { create: { itemId: items['STL-100'].id, requiredQuantity: 100 } } } });
  console.info('OpsFlow seed complete. Password for all demo users: OpsFlow!2026');
}
main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
