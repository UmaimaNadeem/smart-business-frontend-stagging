export interface NavItem { name: string; path: string; perm?: string | string[] }
export interface NavSection { key: string; name: string; icon: string; items: NavItem[]; platform?: boolean }

export const NAV: NavSection[] = [
  { key: "dashboard", name: "Dashboard", icon: "grid", items: [{ name: "Overview", path: "/" }] },
  { key: "inventory", name: "Inventory", icon: "box", items: [
    { name: "Products", path: "/products", perm: "products.view" },
    { name: "Units", path: "/units", perm: "products.view" },
    { name: "Warehouses", path: "/warehouses", perm: "warehouses.view" },
    { name: "Stock balances", path: "/stock/balances", perm: "products.view" },
    { name: "Stock movements", path: "/stock/movements", perm: "products.view" },
    { name: "Adjustments", path: "/stock/adjustments", perm: "stock.adjust" },
    { name: "Transfers", path: "/stock/transfers", perm: "stock.transfer" },
  ] },
  { key: "purchasing", name: "Purchasing", icon: "cart", items: [
    { name: "Suppliers", path: "/suppliers", perm: "suppliers.view" },
    { name: "Purchase orders", path: "/purchases", perm: "purchases.view" },
    { name: "Inwards (receiving)", path: "/inwards", perm: ["inward.view", "inward.tally"] },
    { name: "Supplier returns", path: "/purchase-returns", perm: "returns.manage" },
    { name: "Supplier payments", path: "/supplier-payments", perm: "payments.view" },
  ] },
  { key: "sales", name: "Sales", icon: "dollar", items: [
    { name: "Customers", path: "/customers", perm: "customers.view" },
    { name: "Sales orders", path: "/sales", perm: "sales.view" },
    { name: "Outwards (dispatch)", path: "/outwards", perm: ["outward.view", "outward.dispatch"] },
    { name: "Sales returns", path: "/sales-returns", perm: "returns.manage" },
    { name: "Customer receipts", path: "/customer-receipts", perm: "payments.view" },
  ] },
  { key: "finance", name: "Finance", icon: "wallet", items: [
    { name: "Expenses", path: "/expenses", perm: "expenses.view" },
    { name: "Expense categories", path: "/expense-categories", perm: "expenses.manage" },
    { name: "Cash & bank", path: "/cash-bank", perm: "payments.view" },
    { name: "Payment methods", path: "/payment-methods", perm: "payments.manage" },
    { name: "Reconciliation", path: "/reconciliation", perm: "payments.view" },
    { name: "Receivables", path: "/receivables", perm: "payments.view" },
    { name: "Payables", path: "/payables", perm: "payments.view" },
  ] },
  { key: "accounting", name: "Accounting", icon: "book", items: [
    { name: "Chart of accounts", path: "/accounting/accounts", perm: "accounting.view" },
    { name: "Journals", path: "/accounting/journals", perm: "accounting.view" },
    { name: "General ledger", path: "/accounting/ledger", perm: "accounting.view" },
    { name: "Trial balance", path: "/accounting/trial-balance", perm: "accounting.view" },
  ] },
  { key: "reports", name: "Reports", icon: "chart", items: [
    { name: "Profit & loss", path: "/reports/profit-loss", perm: "reports.view" },
    { name: "Balance sheet", path: "/reports/balance-sheet", perm: "reports.view" },
    { name: "Cash flow", path: "/reports/cash-flow", perm: "reports.view" },
    { name: "Sales report", path: "/reports/sales", perm: "reports.view" },
    { name: "Purchases report", path: "/reports/purchases", perm: "reports.view" },
    { name: "Expenses report", path: "/reports/expenses", perm: "reports.view" },
    { name: "Stock valuation", path: "/reports/stock-valuation", perm: "reports.view" },
    { name: "Low stock", path: "/reports/low-stock", perm: "products.view" },
  ] },
  { key: "org", name: "Organization", icon: "users", items: [
    { name: "Companies", path: "/companies" },
    { name: "Branches", path: "/businesses" },
    { name: "Business members", path: "/business-members", perm: "users.manage" },
    { name: "Users", path: "/users", perm: "users.view" },
    { name: "Roles & permissions", path: "/roles", perm: "users.view" },
    { name: "Invitations", path: "/invitations", perm: "users.manage" },
  ] },
  { key: "billing", name: "Subscription", icon: "card", items: [
    { name: "Plan & usage", path: "/billing",  },
    { name: "Invoices", path: "/billing/invoices", perm: "subscription.manage" },
  ] },
  { key: "platform", name: "Platform admin", icon: "shield", platform: true, items: [
    { name: "Tenants", path: "/platform/tenants" },
    { name: "Users", path: "/platform/users" },
    { name: "Plans", path: "/platform/plans" },
    { name: "Subscriptions", path: "/platform/subscriptions" },
    { name: "Payments", path: "/platform/payments" },
    { name: "Settings", path: "/platform/settings" },
  ] },
];
