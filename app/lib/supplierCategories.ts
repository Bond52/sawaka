export type SupplierCategory =
  | "construction_materials"
  | "wood_lumber"
  | "metal_steel"
  | "electrical_supplies"
  | "plumbing_supplies"
  | "paints_finishes"
  | "hardware_fasteners"
  | "hand_tools"
  | "power_tools"
  | "industrial_machinery"
  | "safety_equipment"
  | "textiles_fabrics"
  | "leather_accessories"
  | "art_craft_materials"
  | "agro_raw_materials"
  | "food_processing_equipment"
  | "packaging_containers"
  | "equipment_rental"
  | "transport_logistics"
  | "import_wholesale_distribution";

export const SUPPLIER_CATEGORY_OPTIONS = [
  { value: "construction_materials" },
  { value: "wood_lumber" },
  { value: "metal_steel" },
  { value: "electrical_supplies" },
  { value: "plumbing_supplies" },
  { value: "paints_finishes" },
  { value: "hardware_fasteners" },
  { value: "hand_tools" },
  { value: "power_tools" },
  { value: "industrial_machinery" },
  { value: "safety_equipment" },
  { value: "textiles_fabrics" },
  { value: "leather_accessories" },
  { value: "art_craft_materials" },
  { value: "agro_raw_materials" },
  { value: "food_processing_equipment" },
  { value: "packaging_containers" },
  { value: "equipment_rental" },
  { value: "transport_logistics" },
  { value: "import_wholesale_distribution" },
] as const satisfies ReadonlyArray<{ value: SupplierCategory }>;

export const ALLOWED_SUPPLIER_CATEGORIES = new Set<string>(
  SUPPLIER_CATEGORY_OPTIONS.map((o) => o.value)
);

export function isSupplierCategory(value: string): value is SupplierCategory {
  return ALLOWED_SUPPLIER_CATEGORIES.has(value);
}
