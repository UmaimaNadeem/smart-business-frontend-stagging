import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import RolesTable from "@/components/tables/RolesTable";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Roles | Smart Business Admin",
  description: "Manage user roles in Smart Business Admin",
};

export default function RolesPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Roles" />
      <div className="space-y-6">
        <ComponentCard
          title="Roles"
          desc="Define roles and assign them to users along with company and business access."
        >
          <RolesTable />
        </ComponentCard>
      </div>
    </div>
  );
}
