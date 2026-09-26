# Architecture Rules

- Single source of truth per entity
- Supplier replaces any "fournisseur"
- Routes → Controllers → Services → Models
- No business logic in routes
- No direct DB calls outside services