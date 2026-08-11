import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma: any = new PrismaClient({ adapter });

// 1. Roles Definition
const roles = [
  { roleCode: 'SUPER_ADMIN', roleName: 'Super Admin', isActive: true },
  { roleCode: 'ADMIN', roleName: 'Admin', isActive: true },
  { roleCode: 'MANAGER', roleName: 'Manager', isActive: true },
  { roleCode: 'EMPLOYEE', roleName: 'Employee', isActive: true },
];

// 2. Pages Definition
const pages = [
  { pageCode: 'DASHBOARD', pageName: 'Dashboard', route: '/dashboard' },
  { pageCode: 'EMPLOYEES', pageName: 'Employees', route: '/employees' },
  { pageCode: 'CATALOGUE', pageName: 'Catalogue', route: '/catalogue' },
  { pageCode: 'ORDERS', pageName: 'Orders', route: '/orders' },
  { pageCode: 'SETTINGS', pageName: 'Settings', route: '/settings' },
];

// 3. Permissions Matrix
const permissionsMatrix: Record<string, Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>> = {
  SUPER_ADMIN: {
    DASHBOARD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    EMPLOYEES: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    CATALOGUE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    ORDERS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    SETTINGS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  },
  ADMIN: {
    DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    EMPLOYEES: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    CATALOGUE: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    ORDERS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    SETTINGS: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  },
  MANAGER: {
    DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    EMPLOYEES: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    CATALOGUE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    ORDERS: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    SETTINGS: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  },
  EMPLOYEE: {
    DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    EMPLOYEES: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    CATALOGUE: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    ORDERS: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    SETTINGS: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  },
};

async function seedRBAC() {
  console.log('🚀 Starting RBAC Data Seeding...');

  // Step 1: Seed Roles into role_master
  const roleIdMap = new Map<string, string>();

  for (const roleDef of roles) {
    const role = await prisma.roleMaster.upsert({
      where: { roleCode: roleDef.roleCode },
      update: { roleName: roleDef.roleName, isActive: roleDef.isActive },
      create: roleDef,
    });
    roleIdMap.set(role.roleCode, role.id);
    console.log(`  ✅ Role: ${role.roleCode} (${role.roleName}) -> ID: ${role.id}`);
  }

  // Step 2: Seed Role Pages into role_page_master
  for (const [roleCode, pageMap] of Object.entries(permissionsMatrix)) {
    const roleId = roleIdMap.get(roleCode);
    if (!roleId) continue;

    for (const pageDef of pages) {
      const perms = pageMap[pageDef.pageCode] || { canView: false, canCreate: false, canEdit: false, canDelete: false };

      await prisma.rolePageMaster.upsert({
        where: {
          roleId_pageCode: {
            roleId,
            pageCode: pageDef.pageCode,
          },
        },
        update: {
          pageName: pageDef.pageName,
          route: pageDef.route,
          canView: perms.canView,
          canCreate: perms.canCreate,
          canEdit: perms.canEdit,
          canDelete: perms.canDelete,
        },
        create: {
          roleId,
          pageCode: pageDef.pageCode,
          pageName: pageDef.pageName,
          route: pageDef.route,
          canView: perms.canView,
          canCreate: perms.canCreate,
          canEdit: perms.canEdit,
          canDelete: perms.canDelete,
        },
      });

      console.log(`  └─ Page Assignment: Role [${roleCode}] -> Page [${pageDef.pageCode}] (view: ${perms.canView}, create: ${perms.canCreate}, edit: ${perms.canEdit}, delete: ${perms.canDelete})`);
    }
  }

  // Step 3: Seed User Roles into user_page_role
  console.log('\n👥 Seeding User Role Assignments into user_page_role...');
  const userRoleAssignments = [
    { email: 'seller@haatza.com', roleCode: 'SUPER_ADMIN' },
    { email: 'john.doe@example.com', roleCode: 'ADMIN' },
    { email: 'arun@haatza.com', roleCode: 'MANAGER' },
    { email: 'seller@haatza11.com', roleCode: 'EMPLOYEE' },
  ];

  for (const assignment of userRoleAssignments) {
    const user = await prisma.user.findFirst({ where: { email: assignment.email } });
    const roleId = roleIdMap.get(assignment.roleCode);

    if (user && roleId) {
      await prisma.userPageRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId,
        },
      });
      console.log(`  ✅ Assigned Role [${assignment.roleCode}] to User [${user.email}] (User ID: ${user.id})`);
    } else {
      console.log(`  ⚠️ Could not assign [${assignment.roleCode}]: User (${assignment.email}) or Role not found.`);
    }
  }

  console.log('\n🎉 RBAC Seeding Completed Successfully!');
}

seedRBAC()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
