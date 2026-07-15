export interface Role {
  id: number;
  name: string;
  created_at?: string;
}

export interface CompanyOwner {
  id: number;
  name: string;
  email: string;
}

export interface Company {
  id: number;
  name: string;
  owner_id?: number;
  owner?: CompanyOwner | string;
  currency?: string;
  country?: string | null;
  status?: number | boolean;
  created_at?: string;
}

export interface BusinessMember {
  id: number;
  name: string;
  email: string;
  roles?: string[];
}

export interface Business {
  id: number;
  name: string;
  company_id?: number;
  company?: string | Company;
  type?: string;
  address?: string | null;
  status?: number | boolean;
  created_at?: string;
  members?: BusinessMember[];
}

export interface CompanyStructure {
  company: Company & { owner?: CompanyOwner };
  total_businesses: number;
  businesses: Business[];
}

export interface UserAssignment {
  company?: string;
  company_id?: number;
  business?: string;
  business_id?: number;
  business_type?: string;
  address?: string;
  role?: string;
  roles?: string[];
  company_status?: boolean | number;
  business_status?: boolean | number;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password?: string;
  image?: string;
  roles?: string[];
  companies?: string[];
  businesses?: string[];
  assignments?: UserAssignment[];
}

export interface Product {
  id: number;
  name: string;
  sku?: string;
  business_id?: number;
  business?: string | Business;
  price?: number | string;
  cost?: number | string;
  stock?: number;
  unit?: string;
  description?: string | null;
  status?: number | boolean;
  low_stock_threshold?: number;
  min_stock?: number;
  created_at?: string;
}

export interface PurchaseItem {
  product_id?: number;
  product_name?: string;
  quantity?: number;
  unit_price?: number | string;
}

export interface Purchase {
  id: number;
  business_id?: number;
  business?: string | Business;
  supplier?: string;
  supplier_name?: string;
  status?: string;
  total?: number | string;
  notes?: string | null;
  items?: PurchaseItem[];
  created_at?: string;
  confirmed_for_inward?: boolean;
}

export interface Inward {
  id: number;
  purchase_id?: number;
  business_id?: number;
  business?: string | Business;
  status?: string;
  items?: PurchaseItem[];
  notes?: string | null;
  created_at?: string;
  purchase?: Purchase;
}

export interface AssignAccessPayload {
  user_id: number;
  role_id: number;
  company_id: number;
  business_id: number;
}
