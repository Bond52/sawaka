import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sawaka Terms of Use",
  description: "Terms of Use for the Sawaka collaborative platform.",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-10 pb-8 border-b border-sawaka-200">
        <h1 className="text-3xl md:text-4xl font-bold text-sawaka-900 mb-4">
          Sawaka Terms of Use
        </h1>
        <div className="flex flex-col sm:flex-row sm:gap-6 text-sm text-sawaka-700">
          <p>
            <span className="font-semibold text-sawaka-800">Version:</span> 1.0
          </p>
          <p>
            <span className="font-semibold text-sawaka-800">Effective Date:</span>{" "}
            June 22, 2026
          </p>
        </div>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            1. Purpose
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka is a collaborative platform intended to help artisans,
              entrepreneurs, suppliers, and community members explore project
              ideas, discover resources, share knowledge, and facilitate
              collaboration.
            </p>
            <p>
              By accessing or using Sawaka, you agree to comply with these
              Terms of Use.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            2. Eligibility
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              You must be legally able to enter into agreements in your
              jurisdiction to use the platform.
            </p>
            <p>
              By creating an account, you represent that the information you
              provide is accurate and that you are authorized to use the
              platform.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            3. User Accounts
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>Users are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintaining the confidentiality of their credentials;</li>
              <li>Keeping their account information reasonably up to date;</li>
              <li>Activities conducted under their account.</li>
            </ul>
            <p>
              Users must not share accounts or impersonate other individuals or
              organizations.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            4. Acceptable Use
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Users agree to use Sawaka in a respectful and lawful manner.
            </p>
            <p>Users must not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide intentionally misleading information;</li>
              <li>Publish illegal, fraudulent, or harmful content;</li>
              <li>Attempt to disrupt platform operations;</li>
              <li>Upload malicious software or harmful code;</li>
              <li>
                Misrepresent supplier availability, products, or capabilities;
              </li>
              <li>
                Use automated tools in a manner that degrades platform
                performance.
              </li>
            </ul>
            <p>
              Sawaka reserves the right to remove content or suspend accounts
              that violate these rules.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            5. Supplier Information
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Users may submit supplier information, including business
              descriptions, categories, contact details, and locations.
            </p>
            <p>
              Users are responsible for ensuring that information they provide
              is accurate to the best of their knowledge.
            </p>
            <p>
              Supplier listings do not constitute endorsements by Sawaka.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            6. AI-Generated Suggestions
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka may use artificial intelligence to generate project ideas,
              estimate required resources, suggest materials, and identify
              potential suppliers.
            </p>
            <p>These suggestions may rely on assumptions, including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Typical products associated with supplier categories;</li>
              <li>Average local market prices;</li>
              <li>Publicly available information;</li>
              <li>Information voluntarily provided by users.</li>
            </ul>
            <p>
              AI-generated suggestions are provided for informational and
              exploratory purposes only.
            </p>
            <p>Users remain responsible for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Verifying supplier availability;</li>
              <li>Confirming pricing;</li>
              <li>Evaluating alternatives;</li>
              <li>
                Conducting their own due diligence before making business
                decisions.
              </li>
            </ul>
            <p>
              Sawaka does not guarantee the accuracy, completeness, or
              suitability of AI-generated recommendations.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            7. Intellectual Property
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Users retain ownership of content they submit to the platform.
            </p>
            <p>
              By submitting content, users grant Sawaka a non-exclusive license
              to store, display, and process such content solely for operating
              and improving platform services.
            </p>
            <p>
              The Sawaka name, logo, software, and related materials remain the
              property of Sawaka or their respective owners.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            8. Privacy
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Use of the platform is subject to the Sawaka Privacy Policy.
            </p>
            <p>
              Users are encouraged to review the Privacy Policy to understand
              how personal information is collected and processed.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            9. Service Availability
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>Sawaka is provided on a best-effort basis.</p>
            <p>
              The platform may evolve, be modified, experience interruptions, or
              be discontinued at any time.
            </p>
            <p>
              No guarantee is made regarding uninterrupted access, availability,
              or performance.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            10. Limitation of Liability
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>Sawaka shall not be liable for losses resulting from:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Reliance on supplier information;</li>
              <li>Reliance on AI-generated suggestions;</li>
              <li>Supplier disputes;</li>
              <li>Inaccurate data;</li>
              <li>Service interruptions;</li>
              <li>
                Decisions made by users based on information available on the
                platform.
              </li>
            </ul>
            <p>
              Users assume responsibility for their own business, purchasing, and
              project decisions.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            11. Changes to the Terms
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka may update these Terms of Use from time to time.
            </p>
            <p>
              Material changes may require users to review and accept an updated
              version before continuing to use certain services.
            </p>
            <p>
              Accepted versions of the Terms may be recorded for compliance
              purposes.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            12. Contact
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Questions regarding these Terms may be directed to Sawaka through
              the contact methods made available on the platform.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
