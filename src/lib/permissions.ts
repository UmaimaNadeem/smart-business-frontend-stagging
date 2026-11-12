/**
 * Permission catalogue. Keys that already exist in backend config/permissions.php are marked [backend];
 * everything else is NEW and must be added to config/permissions.php (see API_CONTRACT.md §Permissions).
 */
export const PERMISSIONS: { key: string; label: string; group: string }[] = [
  // [backend]
  { key: "products.view", label: "View products", group: "Inventory" },
  { key: "products.create", label: "Create products", group: "Inventory" },
  { key: "products.update", label: "Edit products", group: "Inventory" },
  { key: "products.delete", label: "Delete products", group: "Inventory" },
  // new
  { key: "warehouses.view", label: "View warehouses & stock", group: "Inventory" },
  { key: "warehouses.manage", label: "Manage warehouses & units", group: "Inventory" },
  { key: "stock.adjust", label: "Post stock adjustments", group: "Inventory" },
  { key: "stock.transfer", label: "Transfer stock between warehouses", group: "Inventory" },
  // new
  { key: "suppliers.view", label: "View suppliers", group: "Purchasing" },
  { key: "suppliers.manage", label: "Manage suppliers", group: "Purchasing" },
  // [backend]
  { key: "purchases.view", label: "View purchases", group: "Purchasing" },
  { key: "purchases.create", label: "Create purchases", group: "Purchasing" },
  { key: "purchases.update", label: "Edit purchases", group: "Purchasing" },
  { key: "purchases.delete", label: "Delete purchases", group: "Purchasing" },
  { key: "purchases.confirm", label: "Confirm / cancel purchases", group: "Purchasing" },
  { key: "inward.view", label: "View warehouse inwards", group: "Purchasing" },
  { key: "inward.tally", label: "Tally warehouse inwards", group: "Purchasing" },
  // new
  { key: "customers.view", label: "View customers", group: "Sales" },
  { key: "customers.manage", label: "Manage customers", group: "Sales" },
  // [backend]
  { key: "sales.view", label: "View sales", group: "Sales" },
  { key: "sales.create", label: "Create sales", group: "Sales" },
  { key: "sales.update", label: "Edit sales", group: "Sales" },
  { key: "sales.delete", label: "Delete sales", group: "Sales" },
  { key: "sales.confirm", label: "Confirm / cancel sales", group: "Sales" },
  { key: "outward.view", label: "View warehouse outwards", group: "Sales" },
  { key: "outward.dispatch", label: "Dispatch warehouse outwards", group: "Sales" },
  { key: "outward.deliver", label: "Mark outwards delivered", group: "Sales" },
  // new
  { key: "returns.manage", label: "Record purchase & sales returns", group: "Sales" },
  { key: "payments.view", label: "View receipts & payments", group: "Finance" },
  { key: "payments.manage", label: "Record receipts & payments", group: "Finance" },
  { key: "expenses.view", label: "View expenses", group: "Finance" },
  { key: "expenses.manage", label: "Record expenses", group: "Finance" },
  { key: "accounting.view", label: "View accounts, journals & ledgers", group: "Finance" },
  { key: "accounting.manage", label: "Manage chart of accounts & journals", group: "Finance" },
  // [backend]
  { key: "reports.view", label: "View reports", group: "Reports" },
  { key: "users.view", label: "View users", group: "Administration" },
  { key: "users.manage", label: "Manage users, invitations and role assignments", group: "Administration" },
  { key: "roles.manage", label: "Manage custom roles", group: "Administration" },
  { key: "branches.manage", label: "Manage branches", group: "Administration" },
  { key: "company.manage", label: "Manage company settings", group: "Administration" },
  // new
  { key: "subscription.manage", label: "Manage subscription & billing", group: "Administration" },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const OPERATIONAL = [
  "products.view", "products.create", "products.update", "products.delete",
  "warehouses.view", "warehouses.manage", "stock.adjust", "stock.transfer",
  "suppliers.view", "suppliers.manage", "customers.view", "customers.manage",
  "purchases.view", "purchases.create", "purchases.update", "purchases.delete", "purchases.confirm",
  "sales.view", "sales.create", "sales.update", "sales.delete", "sales.confirm",
  "inward.view", "inward.tally", "outward.view", "outward.dispatch", "outward.deliver",
  "returns.manage", "payments.view", "payments.manage", "expenses.view", "expenses.manage",
];

export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  "Super Admin": ["*"],
  "Company Owner": ["*"],
  Manager: [...OPERATIONAL, "reports.view", "users.view"],
  Staff: ["products.view", "warehouses.view", "suppliers.view", "customers.view", "purchases.view", "sales.view", "inward.view", "outward.view", "inward.tally", "outward.dispatch"],
};

export function expandPermissions(perms: string[]): string[] {
  return perms.includes("*") ? ALL_PERMISSION_KEYS : perms;
}
