import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sawaka Privacy Policy",
  description:
    "Privacy Policy explaining how Sawaka collects, uses, stores, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-10 pb-8 border-b border-sawaka-200">
        <h1 className="text-3xl md:text-4xl font-bold text-sawaka-900 mb-4">
          Sawaka Privacy Policy
        </h1>
        <div className="flex flex-col sm:flex-row sm:gap-6 text-sm text-sawaka-700">
          <p>
            <span className="font-semibold text-sawaka-800">Version:</span> 1.0
          </p>
          <p>
            <span className="font-semibold text-sawaka-800">Last Updated:</span>{" "}
            June 22, 2026
          </p>
        </div>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            1. Purpose of this Privacy Policy
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              This Privacy Policy explains how Sawaka collects, uses, stores,
              and protects personal information when visitors and users access
              the platform.
            </p>
            <p>
              By using Sawaka, you acknowledge that your personal information
              may be processed as described in this policy.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            2. Personal Information We Collect
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka may collect the following types of personal information,
              depending on how you use the platform:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Name and email address;</li>
              <li>Account information and credentials;</li>
              <li>
                Supplier or business profile information, including descriptions,
                categories, and contact details;
              </li>
              <li>Location or region;</li>
              <li>User-submitted project information;</li>
              <li>
                Technical information such as browser type, device information,
                IP address, and usage logs.
              </li>
            </ul>
            <p>
              Some information is provided directly by users; other information
              may be collected automatically when the platform is accessed.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            3. How We Use Personal Information
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>Sawaka uses personal information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create and manage user accounts;</li>
              <li>
                Display supplier and project-related information on the
                platform;
              </li>
              <li>Support platform features and improve usability;</li>
              <li>Generate project ideas and related suggestions;</li>
              <li>Maintain security and prevent misuse;</li>
              <li>
                Communicate with users when necessary regarding their account or
                platform activity.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            4. How Information Is Stored
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Personal information is stored using platform databases and
              technical service providers used to operate Sawaka.
            </p>
            <p>
              Access to stored information is limited to authorized persons or
              systems needed to operate, maintain, and improve the platform.
            </p>
            <p>
              Sawaka takes reasonable measures to protect stored information,
              though no system can guarantee absolute security.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            5. Data Retention
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka keeps personal information only as long as reasonably
              necessary to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Operate the platform and support user accounts;</li>
              <li>Maintain records and improve services;</li>
              <li>Resolve issues or disputes;</li>
              <li>Meet applicable legal or operational obligations.</li>
            </ul>
            <p>
              Users may request assistance regarding deletion or correction of
              their personal information by contacting Sawaka through the
              methods described in this policy.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            6. Sharing of Information
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>Sawaka does not sell personal information.</p>
            <p>
              Information may be visible to other users when intentionally
              published as part of a supplier profile, project, or community
              interaction on the platform.
            </p>
            <p>
              Information may also be processed by technical service providers
              that help operate Sawaka, such as hosting, database, or
              infrastructure providers. These providers are expected to handle
              information only as needed to support platform operations.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            7. User Responsibilities
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>Users are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Providing accurate information to the best of their knowledge;
              </li>
              <li>
                Ensuring that information they publish on the platform does not
                violate the rights or privacy of others;
              </li>
              <li>
                Protecting the confidentiality of their account credentials;
              </li>
              <li>
                Reviewing what they choose to share publicly through supplier
                profiles, projects, or community interactions.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            8. AI and Data Use
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka may use submitted information to support AI-assisted
              project idea generation, supplier discovery, and resource
              estimation.
            </p>
            <p>
              AI-generated outputs may rely on assumptions, including typical
              products associated with supplier categories, average local market
              prices, publicly available information, and information
              voluntarily provided by users.
            </p>
            <p>
              AI-generated suggestions are provided for informational and
              exploratory purposes only. Users should verify AI-generated outputs
              before making business decisions.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            9. Cookies and Technical Data
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              For the MVP, Sawaka may use only essential technical cookies or
              similar technologies needed for authentication, security, and
              platform operation.
            </p>
            <p>
              Advanced advertising or tracking cookies are out of scope for the
              current version of the platform.
            </p>
            <p>
              Technical data such as session identifiers and usage logs may be
              collected to maintain platform functionality and security.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            10. User Requests and Privacy Assistance
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Users can request assistance regarding privacy-related matters,
              including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Questions about how personal information is handled;</li>
              <li>Requests to correct inaccurate information;</li>
              <li>Requests to delete personal information.</li>
            </ul>
            <p>
              To submit a request, contact Sawaka through the contact method
              made available on the platform or by email at{" "}
              <a
                href="mailto:privacy@sawaka.org"
                className="text-sawaka-700 underline hover:text-sawaka-800"
              >
                privacy@sawaka.org
              </a>
              .
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            11. Changes to this Privacy Policy
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Sawaka may update this Privacy Policy from time to time to reflect
              changes in platform features, legal requirements, or operational
              practices.
            </p>
            <p>
              When material changes are made, the updated version and date will
              be published on this page. Continued use of the platform after
              changes take effect constitutes acknowledgment of the updated
              policy.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            12. Contact
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              Questions regarding this Privacy Policy may be directed to Sawaka
              through the contact methods made available on the platform or by
              email at{" "}
              <a
                href="mailto:privacy@sawaka.org"
                className="text-sawaka-700 underline hover:text-sawaka-800"
              >
                privacy@sawaka.org
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
