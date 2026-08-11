import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma: any = new PrismaClient({ adapter });

const rolesData = [
  { name: 'SELLER_OWNER', code: 'seller_owner', description: 'Primary Seller Account Owner with full store administration', isSystemRole: true, isDefault: true },
  { name: 'SELLER_STAFF', code: 'seller_staff', description: 'Seller Store Staff with operational permissions', isSystemRole: true, isDefault: false },
  { name: 'ACCOUNT_MANAGER', code: 'account_manager', description: 'Assigned Haatza Account Manager supporting seller stores', isSystemRole: true, isDefault: false },
  { name: 'ADMIN', code: 'admin', description: 'System Administrator with full platform permissions', isSystemRole: true, isDefault: false },
  { name: 'SUPPORT', code: 'support', description: 'Customer and Seller Support Representative', isSystemRole: true, isDefault: false },
  { name: 'EMPLOYEE', code: 'employee', description: 'Company Employee with internal operational permissions', isSystemRole: true, isDefault: false },
];

const permissionsData = [
  // Orders
  { name: 'View Orders', code: 'ORDER_VIEW', module: 'ORDER', action: 'VIEW', description: 'View seller store orders' },
  { name: 'Update Orders', code: 'ORDER_UPDATE', module: 'ORDER', action: 'UPDATE', description: 'Update order fulfillment status' },

  // Products
  { name: 'View Products', code: 'PRODUCT_VIEW', module: 'PRODUCT', action: 'VIEW', description: 'View product listings' },
  { name: 'Create Products', code: 'PRODUCT_CREATE', module: 'PRODUCT', action: 'CREATE', description: 'Create new product listings' },
  { name: 'Update Products', code: 'PRODUCT_UPDATE', module: 'PRODUCT', action: 'UPDATE', description: 'Update product details' },
  { name: 'Delete Products', code: 'PRODUCT_DELETE', module: 'PRODUCT', action: 'DELETE', description: 'Delete product listings' },

  // Wallet
  { name: 'View Wallet', code: 'WALLET_VIEW', module: 'WALLET', action: 'VIEW', description: 'View seller wallet balance and transaction logs' },
  { name: 'Add Wallet Funds', code: 'WALLET_ADD_FUNDS', module: 'WALLET', action: 'MANAGE', description: 'Deposit funds into seller wallet' },

  // Campaigns
  { name: 'View Campaigns', code: 'CAMPAIGN_VIEW', module: 'CAMPAIGN', action: 'VIEW', description: 'View ad campaigns' },
  { name: 'Manage Campaigns', code: 'CAMPAIGN_MANAGE', module: 'CAMPAIGN', action: 'MANAGE', description: 'Create and pause ad campaigns' },

  // Returns & Exchanges
  { name: 'View Returns', code: 'RETURN_VIEW', module: 'RETURN', action: 'VIEW', description: 'View order returns and exchanges' },
  { name: 'Update Returns', code: 'RETURN_UPDATE', module: 'RETURN', action: 'UPDATE', description: 'Approve or reject customer return requests' },

  // Staff Management
  { name: 'View Staff', code: 'STAFF_VIEW', module: 'STAFF', action: 'VIEW', description: 'View store staff accounts' },
  { name: 'Manage Staff', code: 'STAFF_MANAGE', module: 'STAFF', action: 'MANAGE', description: 'Create and assign staff permissions' },

  // Role & Permission Management
  { name: 'View Roles', code: 'ROLE_VIEW', module: 'ROLE', action: 'VIEW', description: 'View roles' },
  { name: 'Manage Roles', code: 'ROLE_MANAGE', module: 'ROLE', action: 'MANAGE', description: 'Manage role assignments' },
];

async function main() {
  console.log('🌱 Starting Database Seeding...');

  // 1. Seed Roles
  const rolesMap = new Map<string, string>();
  for (const roleDef of rolesData) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description, isDefault: roleDef.isDefault },
      create: roleDef,
    });
    rolesMap.set(role.name, role.id);
    console.log(`  └ Role created/updated: ${role.name}`);
  }

  // 2. Seed Permissions
  const permissionsMap = new Map<string, string>();
  for (const permDef of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { code: permDef.code },
      update: { name: permDef.name, description: permDef.description, module: permDef.module, action: permDef.action },
      create: permDef,
    });
    permissionsMap.set(permission.code, permission.id);
    console.log(`  └ Permission created/updated: ${permission.code}`);
  }

  // 3. Assign Permissions to Roles
  const rolePermissionAssignments: Array<{ roleName: string; permissionCodes: string[] }> = [
    {
      roleName: 'ADMIN',
      permissionCodes: permissionsData.map((p) => p.code),
    },
    {
      roleName: 'SELLER_OWNER',
      permissionCodes: permissionsData.map((p) => p.code),
    },
    {
      roleName: 'SELLER_STAFF',
      permissionCodes: [
        'ORDER_VIEW', 'ORDER_UPDATE',
        'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE',
        'RETURN_VIEW', 'RETURN_UPDATE',
      ],
    },
    {
      roleName: 'ACCOUNT_MANAGER',
      permissionCodes: [
        'ORDER_VIEW', 'PRODUCT_VIEW', 'WALLET_VIEW', 'CAMPAIGN_VIEW', 'RETURN_VIEW',
      ],
    },
    {
      roleName: 'SUPPORT',
      permissionCodes: [
        'ORDER_VIEW', 'PRODUCT_VIEW', 'RETURN_VIEW',
      ],
    },
  ];

  for (const assignment of rolePermissionAssignments) {
    const roleId = rolesMap.get(assignment.roleName);
    if (!roleId) continue;

    for (const code of assignment.permissionCodes) {
      const permissionId = permissionsMap.get(code);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
    }
    console.log(`  └ Mapped ${assignment.permissionCodes.length} permissions to role ${assignment.roleName}`);
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
