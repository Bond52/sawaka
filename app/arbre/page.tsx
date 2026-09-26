"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listTools, Tool } from "@/app/lib/apiTools";

function expandTool(rootId: string, all: Tool[]) {
  const visited = new Set<string>();
  const result: Tool[] = [];

  function explore(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const node = all.find((t) => t.id === id);
    if (!node) return;

    result.push(node);
    node.children?.forEach((child) => explore(child));
  }

  explore(rootId);

  return result.filter((t) => t.id !== rootId);
}

export default function ArbrePage() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Tool[] | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listTools();
        setTools(data);
      } catch (e) {
        console.error("Erreur outils:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="py-12 text-center">{t("common.loadingShort")}</p>;

  const filtered = tools.filter((tool) =>
    tool.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold text-sawaka-700 mb-4">
        {t("toolsTree.title")}
      </h1>

      <p className="text-sawaka-700 mb-8 max-w-2xl">
        {t("toolsTree.selectHint")}
      </p>

      <input
        type="text"
        placeholder={t("toolsTree.searchPlaceholder")}
        className="w-full max-w-lg mb-10 p-3 border border-cream-300 rounded-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {filtered.map((tool) => (
          <div
            key={tool.id}
            onClick={() => {
              setSelectedRoot(tool);
              setSelected(expandTool(tool.id, tools));
            }}
            className="cursor-pointer bg-white border p-5 rounded-xl shadow-sm hover:shadow-lg transition"
          >
            <div className="font-bold text-sawaka-700">{tool.name}</div>
            <div className="text-sm text-sawaka-600 mt-1">
              {tool.vendor ? (
                <>
                  📍 {tool.vendor}
                  <br />
                  💰 {tool.price}
                </>
              ) : (
                <span className="text-red-600">{t("toolsTree.noManufacturer")}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && selectedRoot && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-cream-300">
          <h2 className="text-2xl font-bold text-sawaka-700 mb-4">
            {t("toolsTree.toolsNeeded", { name: selectedRoot.name })}
          </h2>

          <ul className="space-y-4">
            {selected.map((tool) => (
              <li key={tool.id} className="p-4 bg-cream-50 border rounded-lg">
                <div className="font-semibold">{tool.name}</div>

                {tool.id !== "main" ? (
                  <div className="text-sm mt-1 text-sawaka-600">
                    📍 {tool.vendor || t("common.notAvailable")}
                    <br />
                    💰 {tool.price || t("common.notAvailable")}
                  </div>
                ) : (
                  <div className="text-sm mt-1 text-sawaka-600">
                    🖐️ {t("toolsTree.finalTool")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
