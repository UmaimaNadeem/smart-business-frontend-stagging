import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PurchasesTable from "@/components/tables/PurchasesTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Purchases | Smart Business Admin",
  description: "Manage purchases and inward gate",
};

export default function PurchasesPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Purchases" />
      <div className="space-y-6">
        <ComponentCard
          title="Purchases & Inward Gate"
          desc="Create and track purchases, confirm for inward, and tally gate receipts."
        >
          <PurchasesTable />
        </ComponentCard>
      </div>
    </div>
  );
}
