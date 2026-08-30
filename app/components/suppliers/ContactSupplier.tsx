"use client";

import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  formatSupplierLocationLines,
  optionalText,
} from "@/app/lib/supplierDisplay";
import {
  hasSupplierContactActions,
  normalizeSupplierContact,
  type NormalizedSupplierContact,
} from "@/app/lib/supplierContact";

export type ContactSupplierProps = {
  publicEmail?: string;
  phone?: string;
  website?: string;
  supplierName?: string;
  /** Optional location fields for the profile contact panel. */
  city?: string;
  region?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  /** `panel` matches the profile sidebar card; `inline` is a simple action list. */
  variant?: "inline" | "panel";
};

function primaryContactHref(contact: NormalizedSupplierContact): string | null {
  if (contact.email) return contact.email.href;
  if (contact.phone) return contact.phone.href;
  if (contact.website) return contact.website.href;
  return null;
}

const actionLinkClass =
  "inline-flex items-center gap-2 rounded text-sm font-medium text-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const inlineLinkClass =
  "btn btn-outline gap-2 !min-h-[40px] px-3 py-2 text-sm";

export default function ContactSupplier({
  publicEmail,
  phone,
  website,
  supplierName,
  city,
  region,
  country,
  address,
  postalCode,
  variant = "inline",
}: ContactSupplierProps) {
  const { t } = useTranslation();
  // publicEmail only — never accept accountEmail as a prop fallback.
  const contact = normalizeSupplierContact({ publicEmail, phone, website });
  const hasActions = hasSupplierContactActions(contact);
  const locationLines = formatSupplierLocationLines({
    city,
    region,
    country,
    address,
    postalCode,
  });
  const hasLocation = locationLines.length > 0;
  const name =
    optionalText(supplierName) || t("suppliers.title");
  const primaryHref = primaryContactHref(contact);
  const isPanel = variant === "panel";

  if (isPanel && !hasActions && !hasLocation) {
    return (
      <section
        className="card p-5 sm:p-6"
        data-testid="contact-supplier"
        aria-labelledby="contact-supplier-heading"
      >
        <h2
          id="contact-supplier-heading"
          className="font-display mb-4 text-xl font-semibold text-foreground"
        >
          {t("suppliers.contactDetails")}
        </h2>
        <p
          className="text-sm text-muted-foreground"
          data-testid="contact-supplier-unavailable"
        >
          {t("suppliers.contactUnavailable")}
        </p>
      </section>
    );
  }

  if (!isPanel && !hasActions) {
    return (
      <section
        className="mt-8"
        data-testid="contact-supplier"
        aria-labelledby="contact-supplier-heading"
      >
        <h2
          id="contact-supplier-heading"
          className="mb-3 font-display text-lg font-semibold text-foreground"
        >
          {t("suppliers.contactSupplier")}
        </h2>
        <p
          className="text-sm text-muted-foreground"
          data-testid="contact-supplier-unavailable"
        >
          {t("suppliers.contactUnavailable")}
        </p>
      </section>
    );
  }

  const linkClass = isPanel ? actionLinkClass : inlineLinkClass;

  const contactList = hasActions ? (
    <ul
      className={
        isPanel
          ? "space-y-3"
          : "flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      }
    >
      {contact.phone && (
        <li className={isPanel ? "flex items-start gap-3" : undefined}>
          {isPanel && (
            <Phone
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden
              strokeWidth={2}
            />
          )}
          <a
            href={contact.phone.href}
            data-testid="contact-supplier-phone"
            aria-label={t("suppliers.contactPhoneAria", { name })}
            className={linkClass}
          >
            {!isPanel && (
              <Phone className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            )}
            <span>{contact.phone.display}</span>
          </a>
        </li>
      )}

      {contact.email && (
        <li className={isPanel ? "flex items-start gap-3" : undefined}>
          {isPanel && (
            <Mail
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden
              strokeWidth={2}
            />
          )}
          <a
            href={contact.email.href}
            data-testid="contact-supplier-email"
            aria-label={t("suppliers.contactEmailAria", { name })}
            className={linkClass}
          >
            {!isPanel && (
              <Mail className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            )}
            <span>{contact.email.display}</span>
          </a>
        </li>
      )}

      {contact.website && (
        <li className={isPanel ? "flex items-start gap-3" : undefined}>
          {isPanel && (
            <Globe
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden
              strokeWidth={2}
            />
          )}
          <a
            href={contact.website.href}
            data-testid="contact-supplier-website"
            aria-label={t("suppliers.contactWebsiteAria", { name })}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {!isPanel && (
              <Globe className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            )}
            <span>{contact.website.display}</span>
          </a>
        </li>
      )}
    </ul>
  ) : null;

  if (!isPanel) {
    return (
      <section
        className="mt-8"
        data-testid="contact-supplier"
        aria-labelledby="contact-supplier-heading"
      >
        <h2
          id="contact-supplier-heading"
          className="mb-3 font-display text-lg font-semibold text-foreground"
        >
          {t("suppliers.contactSupplier")}
        </h2>
        {contactList}
      </section>
    );
  }

  return (
    <section
      className="card p-5 sm:p-6"
      data-testid="contact-supplier"
      aria-labelledby="contact-supplier-heading"
    >
      <h2
        id="contact-supplier-heading"
        className="font-display mb-5 text-xl font-semibold text-foreground"
      >
        {t("suppliers.contactDetails")}
      </h2>

      <div className="space-y-4">
        {hasLocation && (
          <div
            className="flex items-start gap-3"
            data-testid="supplier-profile-location"
          >
            <MapPin
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden
              strokeWidth={2}
            />
            <div className="space-y-0.5 text-sm text-foreground">
              {locationLines.map((line) => (
                <p key={line} className="!text-sm !leading-snug !text-foreground">
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {contactList}
      </div>

      {primaryHref ? (
        <a
          href={primaryHref}
          data-testid="contact-supplier-cta"
          className="btn btn-primary mt-6 flex w-full items-center justify-center text-center"
          {...(contact.website && primaryHref === contact.website.href
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {t("suppliers.contactSupplier")}
        </a>
      ) : null}
    </section>
  );
}
