"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type EditTab = {
  id: string;
  label: string;
};

const defaultTabs: EditTab[] = [
  { id: "main", label: "MAIN EDIT" },
  { id: "edit1a", label: "EDIT1" },
  { id: "edit1b", label: "EDIT1" },
  { id: "edit1c", label: "EDIT1" },
];

type GalleryEditNavProps = {
  tabs?: EditTab[];
};

function toTitleCase(value: string) {
  if (!value) return value;
  return value
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

export function GalleryEditNav({ tabs = defaultTabs }: GalleryEditNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");
  const defaultTab = tabs[0]?.id ?? "main";
  const resolvedActiveTab = editParam && tabs.some((tab) => tab.id === editParam)
    ? editParam
    : defaultTab;

  const setActiveTab = (tabId: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tabId === defaultTab) {
      nextParams.delete("edit");
    } else {
      nextParams.set("edit", tabId);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  return (
    <div className="relative z-20 flex h-12 w-max items-end gap-[47px]" data-gallery-edit-nav="true">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`font-ui relative inline-flex h-10 items-center whitespace-nowrap px-0 text-[14px] leading-5 tracking-[0.28px] transition-colors ${
              resolvedActiveTab === tab.id
                ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
                : "font-medium text-inactive hover:text-meta"
            }`}
          >
            {toTitleCase(tab.label)}
          </button>
        ))}
    </div>
  );
}
