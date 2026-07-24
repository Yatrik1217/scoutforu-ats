import { loadFinance } from "@/lib/finance-data";
import { CategoryManager } from "@/components/finance/category-manager";

export default async function CategoriesPage() {
  const { categories } = await loadFinance();
  const personal = categories.filter((c) => c.scope === "personal");
  const company = categories.filter((c) => c.scope === "company");

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <p className="mb-5 max-w-2xl text-[13px] font-medium leading-relaxed text-[#8a94a6]">
        Organise expenses into heads for both books. For the company, mark Interest, Taxes and
        Depreciation as <span className="font-bold text-[#b45309]">&ldquo;below EBITDA&rdquo;</span> so
        they&apos;re excluded from operating expenses — that keeps your EBITDA figure correct.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryManager scope="personal" categories={personal} />
        <CategoryManager scope="company" categories={company} />
      </div>
    </div>
  );
}
