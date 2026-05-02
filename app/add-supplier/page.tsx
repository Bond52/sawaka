import SupplierForm from "./components/SupplierForm";

export default function AddSupplierPage() {
  return (
    <div className="bg-cream-100 min-h-[70vh] py-10 md:py-14">
      <div className="wrap max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold text-sawaka-800 mb-2">
          Ajouter un fournisseur
        </h1>
        <p className="text-sawaka-700 text-sm md:text-base mb-8">
          Renseignez le profil du fournisseur. Les champs marqués d’un astérisque sont
          obligatoires.
        </p>
        <SupplierForm />
      </div>
    </div>
  );
}
