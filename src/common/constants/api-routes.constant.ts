/**
 * Centralized API Routes Catalog
 * --------------------------------------------------
 * Single source of truth for all active API endpoints across the system.
 */

export const API_ROUTES = {
  // 1. Authentication & Device Sessions
  AUTH: {
    CHECK_USER: '/api/v1/auth/check-user',
    CHECK_USER_GET: '/api/v1/users/check',
    REGISTER: '/api/v1/auth/register',
    LOGIN: '/api/v1/auth/login',
    EMPLOYEE_LOGIN: '/api/v1/auth/employee-login',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    GENERATE_OTP: '/api/v1/auth/generate-otp',
    VERIFY_OTP: '/api/v1/auth/verify-otp',
    RESEND_OTP: '/api/v1/auth/resend-otp',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    GET_SESSIONS: '/api/v1/users/me/sessions',
    DELETE_SESSION: '/api/v1/users/me/sessions/:sessionId',
    REVOKE_OTHERS: '/api/v1/users/me/sessions/revoke-others',
    ME: '/api/v1/auth/me',
  },

  // 2. Products & Buyer Catalog
  PRODUCTS: {
    CREATE_PRODUCT: '/api/v1/products',
    SELLER_LISTING: '/api/v1/sellerlisting',
    PRODUCTS_LIST: '/api/v1/products-list',
    UPDATE_PRODUCT: '/api/v1/updateSellerProduct',
    DELETE_PRODUCT: '/api/v1/products/:product_id',
    SELLER_PRODUCT_DETAILS: '/api/v1/sellerProductDetails',
    PRODUCT_DETAILS: '/api/v1/productDetails',
    BY_SUBCATEGORY: '/api/v1/productsBySubCategoryId',
    BY_CATEGORY: '/api/v1/productsByCategory',
    SIMILAR_PRODUCTS: '/api/v1/similarProducts',
  },

  // 3. Category Master & Hierarchy
  CATEGORIES: {
    SUBCATEGORIES: '/api/v1/categories', // Primary: ?module=haatza&category_id=CAT_ELEC
    CREATE_CATEGORY: '/api/v1/create_category',
    GET_CATEGORY: '/api/v1/get_category',
    MAIN_CATEGORIES: '/api/v1/categories/main',
    HIERARCHY: '/api/v1/categories/hierarchy',
    UPDATE_CATEGORY: '/api/v1/update_category',
    UPDATE_STATUS: '/api/v1/update_category_status',
    DELETE_CATEGORY: '/api/v1/delete_category/:id',
    LEGACY_CATEGORY: '/api/v1/category',
    LEGACY_SUBCATEGORY: '/api/v1/subcategorylist',
  },


  // 4. Grow Plan & Subscriptions
  GROW_PLAN_SUBSCRIPTION: {
    CREATE_ORDER: '/api/v1/subscription/create-order',
    VERIFY_PAYMENT: '/api/v1/subscription/verify-payment',
    PROCESS_ORDER: '/api/v1/subscription/process-order',
    RESCHEDULE: '/api/v1/subscription/reschedule',
    SELLER_SUBSCRIPTION: '/api/v1/subscription/seller-subscription',
    GET_PLANS: '/api/v1/getPlans',
    CREATE_SUBSCRIPTION: '/api/v1/createSubscription',
    CREATE_RAZORPAY_ORDER: '/api/v1/createRazorpayOrder',
    GROW_PLANS: '/api/v1/grow-plans',
  },

  // 5. AppBar Categories
  APPBAR_CATEGORIES: {
    ACTIVE: '/api/v1/appbar-categories/active',
    LIST: '/api/v1/appbar-categories',
    CREATE: '/api/v1/appbar-categories',
  },

  // 6. Dashboard
  DASHBOARD: {
    WIDGETS: '/api/v1/dashboard',
    WIDGETS_GET: '/api/v1/dashboard/widgets',
    GET_DASHBOARD: '/api/v1/dashboard/get_dashboard',
    PING: '/api/v1/dashboard/ping',
    DELETE: '/api/v1/dashboard/:id',
  },
};
