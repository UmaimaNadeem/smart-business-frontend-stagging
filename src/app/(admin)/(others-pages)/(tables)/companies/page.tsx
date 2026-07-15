import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CompaniesTable from "@/components/tables/CompaniesTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Companies | Smart Business Admin",
  description: "Manage companies in Smart Business Admin",
};

export default function CompaniesPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Companies" />
      <div className="space-y-6">
        <ComponentCard
          title="Companies"
          desc="Create and manage companies. Users can be assigned access to companies and their businesses."
        >
          <CompaniesTable />
        </ComponentCard>
      </div>
    </div>
  );
}
