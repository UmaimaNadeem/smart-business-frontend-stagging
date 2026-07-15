import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ProductsTable from "@/components/tables/ProductsTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Products | Smart Business Admin",
  description: "Manage products, stock, and inventory",
};

export default function ProductsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Products" />
      <div className="space-y-6">
        <ComponentCard
          title="Products"
          desc="Create products, filter by business, manage stock increase/decrease, and monitor low stock."
        >
          <ProductsTable />
        </ComponentCard>
      </div>
    </div>
  );
}
