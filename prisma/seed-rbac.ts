import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma: any = new PrismaClient({ adapter });

// 1. Roles Definition (Employee / Internal Staff Roles ONLY)
const roles = [
  { id: 'role_super_admin', roleCode: 'SUPER_ADMIN', roleName: 'Super Admin', isActive: true },
  { id: 'role_admin', roleCode: 'ADMIN', roleName: 'Admin', isActive: true },
  { id: 'role_manager', roleCode: 'MANAGER', roleName: 'Manager', isActive: true },
  { id: 'role_employee', roleCode: 'EMPLOYEE', roleName: 'Employee', isActive: true },
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

  // Ensure new columns, types, tables, and validation triggers exist in database
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.role_master ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE public.role_page_master ADD COLUMN IF NOT EXISTS page_id text;
      ALTER TABLE public.role_page_master ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
      ALTER TABLE public.role_page_master ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

      -- Sync boolean capability flags for existing employee and seller users
      UPDATE public.users 
      SET is_seller = true
      WHERE email LIKE 'seller%' OR role::text IN ('SELLER', 'SELLER_OWNER', 'SELLER_STAFF') OR user_id IN (SELECT user_id FROM public.sellers);

      UPDATE public.users 
      SET is_employee = true
      WHERE is_employee = true OR role::text IN ('EMPLOYEE', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'NEST_WORKER');

      CREATE TABLE IF NOT EXISTS public.page_master (
        id text PRIMARY KEY,
        page_code text UNIQUE NOT NULL,
        page_name text NOT NULL,
        route text NOT NULL,
        description text,
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.user_role (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        role_id text NOT NULL,
        is_active boolean DEFAULT true,
        assigned_at timestamp DEFAULT now(),
        assigned_by text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT uq_user_role_pair UNIQUE (user_id, role_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_role_user_id ON public.user_role(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_role_role_id ON public.user_role(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_page_master_role_id ON public.role_page_master(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_page_master_page_id ON public.role_page_master(page_id);

      DO $$ BEGIN
        CREATE OR REPLACE FUNCTION public.fn_validate_employee_role_assignment()
        RETURNS TRIGGER AS $trg$
        DECLARE
          v_is_employee boolean;
          v_role text;
        BEGIN
          SELECT is_employee, role INTO v_is_employee, v_role
          FROM public.users
          WHERE user_id = NEW.user_id;

          IF v_is_employee = true OR v_role = 'EMPLOYEE' OR v_role = 'SUPER_ADMIN' OR v_role = 'ADMIN' OR v_role = 'MANAGER' THEN
            RETURN NEW;
          ELSE
            RAISE EXCEPTION 'Security Policy Violation: Cannot assign employee role (Role ID: %) to non-employee user (User ID: %). RBAC roles apply ONLY to employees.', 
              NEW.role_id, NEW.user_id;
          END IF;
        END;
        $trg$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_check_employee_role_assignment ON public.user_role;
        CREATE TRIGGER trg_check_employee_role_assignment
        BEFORE INSERT OR UPDATE ON public.user_role
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_validate_employee_role_assignment();
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
    `);
  } catch (err: any) {
    console.log('  ⚠️ Raw DDL notice:', err.message || err);
  }

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

  // Step 2: Seed Pages into page_master
  const pageIdMap = new Map<string, string>();
  for (const pageDef of pages) {
    const page = await prisma.pageMaster.upsert({
      where: { pageCode: pageDef.pageCode },
      update: { pageName: pageDef.pageName, route: pageDef.route },
      create: pageDef,
    });
    pageIdMap.set(page.pageCode, page.id);
    console.log(`  ✅ Page: ${page.pageCode} (${page.pageName}) -> ID: ${page.id}`);
  }

  // Step 3: Seed Role Pages into role_page_master
  for (const [roleCode, pageMap] of Object.entries(permissionsMatrix)) {
    const roleId = roleIdMap.get(roleCode);
    if (!roleId) continue;

    for (const pageDef of pages) {
      const perms = pageMap[pageDef.pageCode] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      const pageId = pageIdMap.get(pageDef.pageCode);

      await prisma.rolePageMaster.upsert({
        where: {
          roleId_pageCode: {
            roleId,
            pageCode: pageDef.pageCode,
          },
        },
        update: {
          pageId,
          pageName: pageDef.pageName,
          route: pageDef.route,
          canView: perms.canView,
          canCreate: perms.canCreate,
          canEdit: perms.canEdit,
          canDelete: perms.canDelete,
        },
        create: {
          roleId,
          pageId,
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

  // Step 4: Seed User Roles into user_role & user_page_role
  console.log('\n👥 Seeding User Role Assignments into user_role & user_page_role...');
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
      // Ensure user has isEmployee: true for RBAC trigger compliance
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmployee: true,
        },
      });

      await prisma.userRoleMapping.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId,
          },
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          roleId,
          isActive: true,
        },
      });

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
      console.log(`  ✅ Assigned Employee Role [${assignment.roleCode}] to User [${user.email}] (User ID: ${user.id})`);
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
