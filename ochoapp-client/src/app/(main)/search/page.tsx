import TrendsSidebar from "@/components/TrendsSidebar";
import { Metadata } from "next";
import SearchResults from "./SearchResults";
import { Search } from "lucide-react";
import SearchTrend from "@/components/search/SearchTrend";
import SetNavigation from "@/components/SetNavigation";
import { getTranslation } from "@/lib/language";
import { SearchFilter } from "@/lib/types";

export interface PageProps {
  searchParams: Promise<{ q: string; filter?: SearchFilter }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const { searchResultFor, search } = await getTranslation();
  return {
    title: q ? searchResultFor.replace("[q]", q) : search,
  };
}

export default async function Page({ searchParams }: PageProps) {
  const { q, filter } = await searchParams;
  const { searchResultFor, search, searchEmptyKeyword } = await getTranslation();

  return (
    <>
      <SetNavigation navPage="explore" />
      <div className="w-full min-w-0 sm:space-y-5 max-sm:pb-2 max-w-lg">
        <div className="sm:rounded-2xl bg-card/50 sm:bg-card p-5 shadow-sm">
          <h2 className="line-clamp-2 break-all text-center text-2xl font-bold">
            {q ? searchResultFor.replace("[q]", q) : search}
          </h2>
        </div>
        {q ? (
          <SearchResults query={q} filter={filter} />
        ) : (
          <div className="my-8 w-full text-center text-muted-foreground flex flex-col gap-2 items-center max-sm:hidden">
            <Search size={150} />
            <h2 className="text-xl">{searchEmptyKeyword}</h2>
          </div>
        )}
        {!q && <SearchTrend />}
      </div>
      <TrendsSidebar />
    </>
  );
}
